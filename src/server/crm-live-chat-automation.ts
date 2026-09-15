import { eq } from "drizzle-orm";

import { phoneToWahaChatId } from "@/lib/automationEndpoints";
import {
  appendServerCrmAutomationLog,
  loadCrmAutomationConfig,
} from "@/server/crm-booking-automation";
import { resolveCrmQueryResponseRecipientUserIds } from "@/server/api/notifications";
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
  return `CHAT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
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

function buildLiveChatStartedVars(input: {
  accountName: string;
  visitorName: string;
  sessionId: string;
  chatUrl: string;
  recipientName: string;
  salesManagerName?: string | null;
  supportManager1?: string | null;
  supportManager2?: string | null;
}): Record<string, string> {
  return {
    customerName: input.visitorName,
    visitorName: input.visitorName,
    recipientName: input.recipientName,
    executiveName: input.recipientName,
    assigneeName: input.recipientName,
    accountName: input.accountName,
    companyName: input.accountName,
    sessionId: input.sessionId,
    chatUrl: input.chatUrl,
    ticketUrl: input.chatUrl,
    ticketNumber: input.sessionId,
    status: "bot-handling",
    salesManagerName: input.salesManagerName?.trim() || "—",
    supportManager1: input.supportManager1?.trim() || "—",
    supportManager2: input.supportManager2?.trim() || "—",
  };
}

async function dispatchLiveChatStartedForRule(
  db: ReturnType<typeof getDb>,
  config: ReturnType<typeof loadCrmAutomationConfig>,
  rule: AutomationRule,
  input: {
    accountId: string;
    accountName: string;
    sessionId: string;
    visitorName: string;
    chatUrl: string;
    salesManagerName?: string | null;
    supportManager1?: string | null;
    supportManager2?: string | null;
    recipient: { id: string; name: string; phone?: string | null };
  },
): Promise<boolean> {
  const vars = buildLiveChatStartedVars({
    accountName: input.accountName,
    visitorName: input.visitorName,
    sessionId: input.sessionId,
    chatUrl: input.chatUrl,
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
    ticketNumber: input.sessionId,
    companyId: input.accountId,
    channel: rule.channel,
    trigger: "live-chat-started",
    status: "retrying",
    requestPayload: {
      sessionId: input.sessionId,
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
      errorMessage: "Live chat started automation currently supports WhatsApp only",
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

/** WhatsApp CRM admins + account executives when a customer starts a portal live chat. */
export async function dispatchCrmLiveChatStartedAutomation(
  db: ReturnType<typeof getDb>,
  input: {
    accountId: string;
    sessionId: string;
    visitorName: string;
  },
): Promise<void> {
  const config = loadCrmAutomationConfig(db);
  if (!config.settings.automationsEnabled) return;

  const rules = config.rules.filter(
    (r) => r.isActive && r.trigger === "live-chat-started" && r.channel === "whatsapp",
  );
  if (rules.length === 0) return;

  const account = db
    .select()
    .from(t.crmAccounts)
    .where(eq(t.crmAccounts.id, input.accountId))
    .get();
  if (!account) return;

  const recipientIds = resolveCrmQueryResponseRecipientUserIds(db, input.accountId);
  if (!recipientIds.length) return;

  const users = db.select().from(t.users).all();
  const recipients = recipientIds
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u && u.active !== false))
    .map((u) => ({ id: u.id, name: u.name, phone: u.phone }));

  const chatUrl = "/crm/live-chat";

  for (const rule of rules) {
    for (const recipient of recipients) {
      await dispatchLiveChatStartedForRule(db, config, rule, {
        accountId: input.accountId,
        accountName: account.name,
        sessionId: input.sessionId,
        visitorName: input.visitorName,
        chatUrl,
        salesManagerName: account.salesManagerName,
        supportManager1: account.supportManager1,
        supportManager2: account.supportManager2,
        recipient,
      });
    }
  }
}
