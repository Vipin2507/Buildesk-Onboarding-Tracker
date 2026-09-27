import { eq } from "drizzle-orm";

import { absoluteAppUrl } from "@/lib/app-base-url";
import { phoneToWahaChatId } from "@/lib/automationEndpoints";
import {
  crmRenewalWindowLabel,
  daysUntilYmd,
  nextRenewalStartDate,
  todayYmd,
} from "@/lib/crm-account-renewal";
import { formatDate } from "@/lib/utils";
import { listActiveAdminUserIds } from "@/server/api/notifications";
import {
  appendServerCrmAutomationLog,
  loadCrmAutomationConfig,
} from "@/server/crm-booking-automation";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { renderAutomationTemplate } from "@/services/automationTemplate";
import { nowIso } from "@/types";
import type { AutomationLog, AutomationRule, WahaConfig } from "@/types/automation";

function trimSlash(url: string) {
  return url.replace(/\/+$/, "");
}

function summarizeResponse(text: string, max = 200) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

function serverLogId() {
  return `REN-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

async function sendServerWahaText(waha: WahaConfig, chatId: string, text: string) {
  const res = await fetch(`${trimSlash(waha.apiUrl)}/api/sendText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Api-Key": waha.apiKey,
    },
    body: JSON.stringify({
      session: waha.sessionName,
      chatId,
      text,
    }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, text: body };
}

function buildRenewalTemplateVars(input: {
  accountName: string;
  endDate: string;
  nextStartDate: string | null;
  renewUrl: string;
  recipientName: string;
  salesManagerName?: string | null;
  supportManager1?: string | null;
  supportManager2?: string | null;
}): Record<string, string> {
  const today = todayYmd();
  const daysUntilEnd = daysUntilYmd(input.endDate, today);
  const windowLabel =
    crmRenewalWindowLabel({ endDate: input.endDate }, today) ??
    (daysUntilEnd < 0
      ? `Expired ${Math.abs(daysUntilEnd)}d ago`
      : daysUntilEnd === 0
        ? "Expires today"
        : `Renewal in ${daysUntilEnd}d`);

  return {
    recipientName: input.recipientName,
    executiveName: input.recipientName,
    assigneeName: input.recipientName,
    accountName: input.accountName,
    companyName: input.accountName,
    customerName: input.accountName,
    endDate: formatDate(input.endDate),
    nextStartDate: input.nextStartDate ? formatDate(input.nextStartDate) : "—",
    renewUrl: input.renewUrl,
    ticketUrl: input.renewUrl,
    renewalWindowLabel: windowLabel,
    daysUntilEnd: String(daysUntilEnd),
    status: "renewal-window",
    salesManagerName: input.salesManagerName?.trim() || "—",
    supportManager1: input.supportManager1?.trim() || "—",
    supportManager2: input.supportManager2?.trim() || "—",
  };
}

async function dispatchRenewalForRule(
  db: ReturnType<typeof getDb>,
  config: ReturnType<typeof loadCrmAutomationConfig>,
  rule: AutomationRule,
  input: {
    accountId: string;
    accountName: string;
    endDate: string;
    nextStartDate: string | null;
    renewUrl: string;
    salesManagerName?: string | null;
    supportManager1?: string | null;
    supportManager2?: string | null;
    recipient: { id: string; name: string; phone?: string | null };
  },
): Promise<boolean> {
  const vars = buildRenewalTemplateVars({
    accountName: input.accountName,
    endDate: input.endDate,
    nextStartDate: input.nextStartDate,
    renewUrl: input.renewUrl,
    recipientName: input.recipient.name,
    salesManagerName: input.salesManagerName,
    supportManager1: input.supportManager1,
    supportManager2: input.supportManager2,
  });
  const message = renderAutomationTemplate(rule.templateBody, vars);

  const userRow = db.select().from(t.users).where(eq(t.users.id, input.recipient.id)).get();
  const recipientPhone = userRow?.phone ?? input.recipient.phone ?? undefined;

  const attemptedAt = nowIso();
  const logId = serverLogId();
  const baseLog: AutomationLog = {
    id: logId,
    companyId: input.accountId,
    channel: rule.channel,
    trigger: "account-renewal-remind",
    status: "retrying",
    requestPayload: {
      accountId: input.accountId,
      ruleId: rule.id,
      recipientUserId: input.recipient.id,
    },
    attemptedAt,
    retryCount: 0,
  };

  if (rule.channel !== "whatsapp") {
    appendServerCrmAutomationLog(db, {
      ...baseLog,
      status: "failed",
      errorMessage: "Account renewal automation currently supports WhatsApp only",
    });
    return false;
  }

  const wahaEndpoint = config.endpoints.find((e) => e.channel === "whatsapp" && e.isEnabled);
  if (!wahaEndpoint || !config.waha.isEnabled) {
    appendServerCrmAutomationLog(db, {
      ...baseLog,
      status: "failed",
      errorMessage: "WhatsApp endpoint disabled",
    });
    return false;
  }

  const chatId = phoneToWahaChatId(recipientPhone ?? undefined);
  if (!chatId) {
    appendServerCrmAutomationLog(db, {
      ...baseLog,
      status: "failed",
      errorMessage: "Recipient has no valid phone for WhatsApp",
    });
    return false;
  }

  try {
    const res = await sendServerWahaText(config.waha, chatId, message);
    if (!res.ok) {
      appendServerCrmAutomationLog(db, {
        ...baseLog,
        status: "failed",
        errorMessage: `HTTP ${res.status}: ${summarizeResponse(res.text, 240)}`,
        responseSummary: summarizeResponse(res.text),
        requestPayload: { chatId, message },
      });
      return false;
    }
    appendServerCrmAutomationLog(db, {
      ...baseLog,
      status: "success",
      responseSummary: summarizeResponse(res.text),
      requestPayload: { chatId, message },
    });
    return true;
  } catch (err) {
    appendServerCrmAutomationLog(db, {
      ...baseLog,
      status: "failed",
      errorMessage: err instanceof Error ? err.message : "Network error",
    });
    return false;
  }
}

/**
 * WhatsApp CRM admins only when an account enters the renewal window.
 * Template/channel come from Automation → Rules (`account-renewal-remind`).
 */
export async function dispatchCrmAccountRenewalAutomation(
  db: ReturnType<typeof getDb>,
  input: {
    accountId: string;
    accountName: string;
    endDate: string;
    salesManagerName?: string | null;
    supportManager1?: string | null;
    supportManager2?: string | null;
  },
): Promise<number> {
  const config = loadCrmAutomationConfig(db);
  if (!config.settings.automationsEnabled) return 0;

  const rules = config.rules.filter(
    (r) => r.isActive && r.trigger === "account-renewal-remind" && r.channel === "whatsapp",
  );
  if (rules.length === 0) return 0;

  const adminIds = listActiveAdminUserIds(db, "crm");
  if (!adminIds.length) return 0;

  const users = db.select().from(t.users).all();
  const recipients = adminIds
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u && u.active !== false))
    .map((u) => ({ id: u.id, name: u.name, phone: u.phone }));

  if (!recipients.length) return 0;

  const nextStart = nextRenewalStartDate(input.endDate);
  const renewUrl = absoluteAppUrl(`/crm/accounts/${input.accountId}`);
  let sent = 0;

  for (const rule of rules) {
    for (const recipient of recipients) {
      const ok = await dispatchRenewalForRule(db, config, rule, {
        accountId: input.accountId,
        accountName: input.accountName,
        endDate: input.endDate,
        nextStartDate: nextStart,
        renewUrl,
        salesManagerName: input.salesManagerName,
        supportManager1: input.supportManager1,
        supportManager2: input.supportManager2,
        recipient,
      });
      if (ok) sent += 1;
    }
  }

  return sent;
}
