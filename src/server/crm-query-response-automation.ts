import { eq } from "drizzle-orm";

import { N8N_EMAIL_SEGMENT } from "@/data/crm-automation-defaults";
import { phoneToWahaChatId } from "@/lib/automationEndpoints";
import { resolveUserWorkEmail } from "@/lib/user-email";
import {
  appendServerCrmAutomationLog,
  loadCrmAutomationConfig,
} from "@/server/crm-booking-automation";
import { buildServerCrmN8nEmailBody } from "@/server/crm-n8n-email-payload";
import { resolveCrmQueryResponseRecipientUserIds } from "@/server/api/notifications";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import {
  renderAutomationSubject,
  renderAutomationTemplate,
} from "@/services/automationTemplate";
import { nowIso } from "@/types";
import type { AutomationLog, AutomationRule, WahaConfig } from "@/types/automation";

function trimSlash(url: string) {
  return url.replace(/\/+$/, "");
}

function buildN8nUrl(base: string, segment: string) {
  return `${trimSlash(base)}/${segment.replace(/^\/+/, "")}`;
}

function summarizeResponse(text: string, max = 200) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

function serverLogId() {
  return `QRY-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
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

function buildQueryResponseVars(input: {
  accountName: string;
  queryTitle: string;
  queryStatus: string;
  authorName: string;
  messageSnippet: string;
  queryUrl: string;
  recipientName: string;
  salesManagerName?: string | null;
  supportManager1?: string | null;
  supportManager2?: string | null;
}): Record<string, string> {
  return {
    customerName: input.recipientName,
    recipientName: input.recipientName,
    executiveName: input.recipientName,
    assigneeName: input.recipientName,
    accountName: input.accountName,
    companyName: input.accountName,
    title: input.queryTitle,
    subject: input.queryTitle,
    status: input.queryStatus,
    authorName: input.authorName,
    messageSnippet: input.messageSnippet,
    queryUrl: input.queryUrl,
    ticketUrl: input.queryUrl,
    ticketNumber: input.queryTitle,
    salesManagerName: input.salesManagerName?.trim() || "—",
    supportManager1: input.supportManager1?.trim() || "—",
    supportManager2: input.supportManager2?.trim() || "—",
  };
}

async function dispatchQueryResponseForRule(
  db: ReturnType<typeof getDb>,
  config: ReturnType<typeof loadCrmAutomationConfig>,
  rule: AutomationRule,
  input: {
    accountId: string;
    accountName: string;
    queryId: string;
    queryTitle: string;
    queryStatus: string;
    authorName: string;
    messageSnippet: string;
    queryUrl: string;
    salesManagerName?: string | null;
    supportManager1?: string | null;
    supportManager2?: string | null;
    recipient: { id: string; name: string; phone?: string | null };
  },
): Promise<boolean> {
  const vars = buildQueryResponseVars({
    accountName: input.accountName,
    queryTitle: input.queryTitle,
    queryStatus: input.queryStatus,
    authorName: input.authorName,
    messageSnippet: input.messageSnippet,
    queryUrl: input.queryUrl,
    recipientName: input.recipient.name,
    salesManagerName: input.salesManagerName,
    supportManager1: input.supportManager1,
    supportManager2: input.supportManager2,
  });
  const message = renderAutomationTemplate(rule.templateBody, vars);
  const subject = renderAutomationSubject(rule.templateSubject, vars);

  const userRow = db.select().from(t.users).where(eq(t.users.id, input.recipient.id)).get();
  const recipientEmail = resolveUserWorkEmail(userRow ?? undefined);
  const recipientPhone = userRow?.phone ?? input.recipient.phone ?? undefined;

  const attemptedAt = nowIso();
  const logId = serverLogId();
  const baseLog: AutomationLog = {
    id: logId,
    ticketNumber: input.queryId,
    companyId: input.accountId,
    channel: rule.channel,
    trigger: "query-response",
    status: "retrying",
    requestPayload: {
      queryId: input.queryId,
      ruleId: rule.id,
      recipientUserId: input.recipient.id,
    },
    attemptedAt,
    retryCount: 0,
  };

  if (rule.channel === "email") {
    const emailEndpoint = config.endpoints.find((e) => e.channel === "email" && e.isEnabled);
    if (!emailEndpoint || !recipientEmail?.trim()) {
      appendServerCrmAutomationLog(db, {
        ...baseLog,
        status: "failed",
        errorMessage: recipientEmail ? "Email endpoint disabled" : "Recipient has no email",
      });
      return false;
    }

    const n8nBase = config.settings.n8nWebhookBase;
    const url = buildN8nUrl(n8nBase, N8N_EMAIL_SEGMENT);
    const body = buildServerCrmN8nEmailBody({
      rule,
      settings: config.settings,
      waha: config.waha,
      trigger: "query-response",
      recipientEmail,
      recipientName: input.recipient.name,
      recipientPhone: recipientPhone ?? undefined,
      messageBody: message,
      emailSubject: subject,
      entityType: "crm-account-query",
      entityId: input.queryId,
      entityName: input.queryTitle,
      companyName: input.accountName,
      status: input.queryStatus,
      fields: {
        accountName: input.accountName,
        queryUrl: input.queryUrl,
        title: input.queryTitle,
        authorName: input.authorName,
        messageSnippet: input.messageSnippet,
        salesManagerName: vars.salesManagerName,
        supportManager1: vars.supportManager1,
        supportManager2: vars.supportManager2,
      },
    });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) {
        appendServerCrmAutomationLog(db, {
          ...baseLog,
          status: "failed",
          errorMessage: `HTTP ${res.status}: ${summarizeResponse(text, 240)}`,
          responseSummary: summarizeResponse(text),
          requestPayload: body as unknown as Record<string, unknown>,
        });
        return false;
      }
      appendServerCrmAutomationLog(db, {
        ...baseLog,
        status: "success",
        responseSummary: summarizeResponse(text),
        requestPayload: body as unknown as Record<string, unknown>,
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

/** WhatsApp / email for admins and account executives when someone replies on a CRM account query. */
export async function dispatchCrmQueryResponseAutomation(
  db: ReturnType<typeof getDb>,
  input: {
    accountId: string;
    queryId: string;
    queryTitle: string;
    queryStatus: string;
    authorName: string;
    messageBody: string;
    excludeUserId: string;
  },
): Promise<void> {
  const config = loadCrmAutomationConfig(db);
  if (!config.settings.automationsEnabled) return;

  const rules = config.rules.filter((r) => r.isActive && r.trigger === "query-response");
  if (rules.length === 0) return;

  const account = db
    .select()
    .from(t.crmAccounts)
    .where(eq(t.crmAccounts.id, input.accountId))
    .get();
  if (!account) return;

  const recipientIds = resolveCrmQueryResponseRecipientUserIds(
    db,
    input.accountId,
    input.excludeUserId,
  );
  if (!recipientIds.length) return;

  const users = db.select().from(t.users).all();
  const recipients = recipientIds
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u && u.active !== false))
    .map((u) => ({ id: u.id, name: u.name, phone: u.phone }));

  const queryUrl = `/crm/accounts/${input.accountId}?tab=queries&queryId=${input.queryId}`;
  const messageSnippet = input.messageBody.trim().slice(0, 160);

  for (const rule of rules) {
    for (const recipient of recipients) {
      await dispatchQueryResponseForRule(db, config, rule, {
        accountId: input.accountId,
        accountName: account.name,
        queryId: input.queryId,
        queryTitle: input.queryTitle,
        queryStatus: input.queryStatus,
        authorName: input.authorName,
        messageSnippet,
        queryUrl,
        salesManagerName: account.salesManagerName,
        supportManager1: account.supportManager1,
        supportManager2: account.supportManager2,
        recipient,
      });
    }
  }
}
