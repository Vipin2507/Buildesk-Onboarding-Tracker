import { eq } from "drizzle-orm";

import { absoluteAppUrl } from "@/lib/app-base-url";
import { phoneToWahaChatId } from "@/lib/automationEndpoints";
import { resolveCrmQueryResponseRecipientUserIds } from "@/server/api/notifications";
import {
  appendServerCrmAutomationLog,
  loadCrmAutomationConfig,
} from "@/server/crm-booking-automation";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { renderAutomationTemplate } from "@/services/automationTemplate";
import { nowIso } from "@/types";
import type { AutomationLog, AutomationRule, WahaConfig } from "@/types/automation";
import type { DesignTicket } from "@/types/design-ticket";

function trimSlash(url: string) {
  return url.replace(/\/+$/, "");
}

function summarizeResponse(text: string, max = 200) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

function serverLogId() {
  return `PTK-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
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

function buildPortalTicketVars(input: {
  accountName: string;
  ticketNumber: string;
  title: string;
  priority: string;
  authorName: string;
  ticketUrl: string;
  recipientName: string;
  salesManagerName?: string | null;
  supportManager1?: string | null;
  supportManager2?: string | null;
}): Record<string, string> {
  return {
    customerName: input.authorName,
    authorName: input.authorName,
    recipientName: input.recipientName,
    executiveName: input.recipientName,
    assigneeName: input.recipientName,
    accountName: input.accountName,
    companyName: input.accountName,
    ticketNumber: input.ticketNumber,
    title: input.title,
    subject: input.title,
    status: "open",
    priority: input.priority,
    ticketUrl: input.ticketUrl,
    salesManagerName: input.salesManagerName?.trim() || "—",
    supportManager1: input.supportManager1?.trim() || "—",
    supportManager2: input.supportManager2?.trim() || "—",
  };
}

async function dispatchPortalTicketCreatedForRule(
  db: ReturnType<typeof getDb>,
  config: ReturnType<typeof loadCrmAutomationConfig>,
  rule: AutomationRule,
  input: {
    accountId: string;
    accountName: string;
    ticketId: string;
    ticketNumber: string;
    title: string;
    priority: string;
    authorName: string;
    ticketUrl: string;
    salesManagerName?: string | null;
    supportManager1?: string | null;
    supportManager2?: string | null;
    recipient: { id: string; name: string; phone?: string | null };
  },
): Promise<boolean> {
  const vars = buildPortalTicketVars({
    accountName: input.accountName,
    ticketNumber: input.ticketNumber,
    title: input.title,
    priority: input.priority,
    authorName: input.authorName,
    ticketUrl: input.ticketUrl,
    recipientName: input.recipient.name,
    salesManagerName: input.salesManagerName,
    supportManager1: input.supportManager1,
    supportManager2: input.supportManager2,
  });
  const message = renderAutomationTemplate(rule.templateBody, vars);

  const userRow = db.select().from(t.users).where(eq(t.users.id, input.recipient.id)).get();
  const recipientPhone = userRow?.phone ?? input.recipient.phone ?? undefined;

  const attemptedAt = nowIso();
  const baseLog: AutomationLog = {
    id: serverLogId(),
    ticketId: input.ticketId,
    ticketNumber: input.ticketNumber,
    companyId: input.accountId,
    channel: rule.channel,
    trigger: "portal-ticket-created",
    status: "retrying",
    requestPayload: {
      ticketId: input.ticketId,
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
      errorMessage: "Portal ticket created automation currently supports WhatsApp only",
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

/** WhatsApp CRM admins + account executives when a client creates a portal ticket. */
export async function dispatchCrmPortalTicketCreatedAutomation(
  db: ReturnType<typeof getDb>,
  ticket: DesignTicket,
): Promise<void> {
  const config = loadCrmAutomationConfig(db);
  if (!config.settings.automationsEnabled) return;

  const rules = config.rules.filter(
    (r) => r.isActive && r.trigger === "portal-ticket-created" && r.channel === "whatsapp",
  );
  if (rules.length === 0) return;

  const account = db
    .select()
    .from(t.crmAccounts)
    .where(eq(t.crmAccounts.id, ticket.companyId))
    .get();
  if (!account) return;

  const recipientIds = resolveCrmQueryResponseRecipientUserIds(db, ticket.companyId);
  if (!recipientIds.length) return;

  const users = db.select().from(t.users).all();
  const recipients = recipientIds
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u && u.active !== false))
    .map((u) => ({ id: u.id, name: u.name, phone: u.phone }));

  const ticketUrl = absoluteAppUrl(`/crm/tickets/${ticket.id}`);

  for (const rule of rules) {
    for (const recipient of recipients) {
      await dispatchPortalTicketCreatedForRule(db, config, rule, {
        accountId: ticket.companyId,
        accountName: account.name,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        title: ticket.subject,
        priority: ticket.priority,
        authorName: ticket.createdBy.name,
        ticketUrl,
        salesManagerName: account.salesManagerName,
        supportManager1: account.supportManager1,
        supportManager2: account.supportManager2,
        recipient,
      });
    }
  }
}
