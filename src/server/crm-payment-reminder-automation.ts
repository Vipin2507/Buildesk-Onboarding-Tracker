import { eq } from "drizzle-orm";

import {
  DEFAULT_CRM_AUTOMATION_SETTINGS,
  N8N_EMAIL_SEGMENT,
} from "@/data/crm-automation-defaults";
import { crmSalesManagerNamesMatch } from "@/lib/crm-account-access";
import { phoneToWahaChatId } from "@/lib/automationEndpoints";
import { buildExecutiveDigestTemplateVars } from "@/lib/crm-payment-executive-digest";
import { resolveUserWorkEmail } from "@/lib/user-email";
import {
  renderAutomationSubject,
  renderAutomationTemplate,
} from "@/services/automationTemplate";
import { appendServerCrmAutomationLog, loadCrmAutomationConfig } from "@/server/crm-booking-automation";
import { buildServerCrmN8nEmailBody } from "@/server/crm-n8n-email-payload";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { buildAccountPaymentSnapshot, getAccountPaymentReceived } from "@/server/lib/crm-payments";
import { nowIso } from "@/types";
import type { AutomationLog, AutomationTrigger, WahaConfig } from "@/types/automation";

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
  return `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function listActiveCrmUsers(db: ReturnType<typeof getDb>) {
  return db
    .select()
    .from(t.users)
    .all()
    .filter((u) => u.active !== false && (u.productScope || "erp") === "crm");
}

function resolveExecutiveRecipients(
  db: ReturnType<typeof getDb>,
  account: typeof t.crmAccounts.$inferSelect,
) {
  const roles: { label: string; name?: string | null }[] = [
    { label: "Support 1", name: account.supportManager1 },
    { label: "Support 2", name: account.supportManager2 },
    { label: "Sales manager", name: account.salesManagerName },
  ];
  const seen = new Set<string>();
  const recipients: { name: string; email: string; phone?: string; role: string }[] = [];

  for (const role of roles) {
    const displayName = role.name?.trim();
    if (!displayName) continue;
    for (const user of listActiveCrmUsers(db)) {
      if (!crmSalesManagerNamesMatch(displayName, user.name)) continue;
      const email = resolveUserWorkEmail(user);
      if (!email || seen.has(email)) continue;
      seen.add(email);
      recipients.push({
        name: user.name,
        email,
        phone: user.phone ?? undefined,
        role: role.label,
      });
    }
  }

  return recipients;
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

function buildPaymentTemplateVars(
  account: typeof t.crmAccounts.$inferSelect,
  snap: ReturnType<typeof buildAccountPaymentSnapshot>,
  recipientName: string,
) {
  const due = snap.nextDueInstallment;
  const digestVars = buildExecutiveDigestTemplateVars(recipientName, [
    {
      accountId: account.id,
      accountName: account.name,
      overdueAmount: snap.overdueAmount,
      overdueDays: snap.overdueDays,
      dueDate: due?.dueDate ?? null,
      pendingAmount: snap.pendingAmount,
      paymentReceived: snap.paymentReceived,
      totalDealValue: snap.totalDealValue,
      salesManager: account.salesManagerName ?? undefined,
      supportManager1: account.supportManager1 ?? undefined,
      supportManager2: account.supportManager2 ?? undefined,
    },
  ]);
  return {
    ...digestVars,
    customerName: account.pocName?.trim() || account.contact?.trim() || account.name,
    accountName: account.name,
    companyName: account.name,
    salesManagerName: account.salesManagerName?.trim() || "—",
    supportManager1: account.supportManager1?.trim() || "—",
    supportManager2: account.supportManager2?.trim() || "—",
    executiveName: recipientName,
    dueAmount: due ? String(due.remainingAmount) : "0",
    dueDate: due?.dueDate ?? "—",
    paymentReceived: String(snap.paymentReceived),
    pendingAmount: String(snap.pendingAmount),
    totalDealValue: String(snap.totalDealValue),
    overdueAmount: String(snap.overdueAmount),
    overdueDays: snap.overdueDays != null ? String(snap.overdueDays) : "0",
    status: snap.paymentStatus,
  };
}

async function dispatchPaymentEmailRule(
  db: ReturnType<typeof getDb>,
  opts: {
    trigger: Extract<AutomationTrigger, "payment-overdue" | "payment-executive-remind">;
    account: typeof t.crmAccounts.$inferSelect;
    recipientEmail: string;
    recipientName: string;
    recipientPhone?: string;
    vars: Record<string, string>;
  },
): Promise<boolean> {
  const config = loadCrmAutomationConfig(db);
  if (!config.settings.automationsEnabled) return false;

  const rules = config.rules.filter(
    (r) => r.isActive && r.trigger === opts.trigger && r.channel === "email",
  );
  if (rules.length === 0) return false;

  const emailEndpoint = config.endpoints.find((e) => e.channel === "email" && e.isEnabled);
  if (!emailEndpoint) return false;

  const n8nBase = config.settings.n8nWebhookBase || DEFAULT_CRM_AUTOMATION_SETTINGS.n8nWebhookBase;
  const url = buildN8nUrl(n8nBase, N8N_EMAIL_SEGMENT);
  let sent = false;

  for (const rule of rules) {
    const message = renderAutomationTemplate(rule.templateBody, opts.vars);
    const subject = renderAutomationSubject(rule.templateSubject, opts.vars);
    const body = buildServerCrmN8nEmailBody({
      rule,
      settings: config.settings,
      waha: config.waha,
      trigger: opts.trigger,
      recipientEmail: opts.recipientEmail,
      recipientName: opts.recipientName,
      recipientPhone: opts.recipientPhone,
      messageBody: message,
      emailSubject: subject,
      entityType: "crm-payment",
      entityId: opts.account.id,
      entityName: opts.account.name,
      companyName: opts.account.name,
      status: opts.vars.status,
      fields: {
        accountName: opts.account.name,
        accountId: opts.account.id,
        salesManagerName: opts.vars.salesManagerName,
        supportManager1: opts.vars.supportManager1,
        supportManager2: opts.vars.supportManager2,
        executiveName: opts.vars.executiveName,
        dueAmount: opts.vars.dueAmount,
        dueDate: opts.vars.dueDate,
        paymentReceived: opts.vars.paymentReceived,
        pendingAmount: opts.vars.pendingAmount,
        totalDealValue: opts.vars.totalDealValue,
        overdueAmount: opts.vars.overdueAmount,
        overdueDays: opts.vars.overdueDays,
      },
    });

    const attemptedAt = nowIso();
    const logId = serverLogId();
    const baseLog: AutomationLog = {
      id: logId,
      companyId: opts.account.id,
      channel: "email",
      trigger: opts.trigger,
      status: "retrying",
      requestPayload: body as unknown as Record<string, unknown>,
      attemptedAt,
      retryCount: 0,
    };

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
        });
        continue;
      }
      appendServerCrmAutomationLog(db, {
        ...baseLog,
        status: "success",
        responseSummary: summarizeResponse(text),
      });
      sent = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      appendServerCrmAutomationLog(db, {
        ...baseLog,
        status: "failed",
        errorMessage: message,
      });
    }
  }

  return sent;
}

async function dispatchPaymentWhatsappRule(
  db: ReturnType<typeof getDb>,
  opts: {
    trigger: Extract<AutomationTrigger, "payment-overdue" | "payment-executive-remind">;
    account: typeof t.crmAccounts.$inferSelect;
    recipientPhone?: string;
    vars: Record<string, string>;
  },
): Promise<boolean> {
  const config = loadCrmAutomationConfig(db);
  if (!config.settings.automationsEnabled) return false;

  const rules = config.rules.filter(
    (r) => r.isActive && r.trigger === opts.trigger && r.channel === "whatsapp",
  );
  if (rules.length === 0) return false;

  const wahaEndpoint = config.endpoints.find((e) => e.channel === "whatsapp" && e.isEnabled);
  if (!wahaEndpoint || !config.waha.isEnabled) return false;

  const chatId = phoneToWahaChatId(opts.recipientPhone ?? undefined);
  if (!chatId) return false;

  let sent = false;
  for (const rule of rules) {
    const message = renderAutomationTemplate(rule.templateBody, opts.vars);
    const attemptedAt = nowIso();
    const baseLog: AutomationLog = {
      id: serverLogId(),
      companyId: opts.account.id,
      channel: "whatsapp",
      trigger: opts.trigger,
      status: "retrying",
      requestPayload: { chatId, ruleId: rule.id },
      attemptedAt,
      retryCount: 0,
    };

    try {
      const res = await sendServerWahaText(config.waha, chatId, message);
      if (!res.ok) {
        appendServerCrmAutomationLog(db, {
          ...baseLog,
          status: "failed",
          errorMessage: `HTTP ${res.status}: ${summarizeResponse(res.text, 240)}`,
          responseSummary: summarizeResponse(res.text),
        });
        continue;
      }
      appendServerCrmAutomationLog(db, {
        ...baseLog,
        status: "success",
        responseSummary: summarizeResponse(res.text),
      });
      sent = true;
    } catch (err) {
      appendServerCrmAutomationLog(db, {
        ...baseLog,
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  return sent;
}

export type ExecutivePaymentChannelResult = { email: boolean; whatsapp: boolean };

/** Sends active payment-executive-remind email and/or WhatsApp rules for one recipient. */
export async function dispatchExecutivePaymentChannels(
  db: ReturnType<typeof getDb>,
  opts: {
    account: typeof t.crmAccounts.$inferSelect;
    recipientEmail: string;
    recipientName: string;
    recipientPhone?: string;
    vars: Record<string, string>;
    entityType?: string;
    entityId?: string;
  },
): Promise<ExecutivePaymentChannelResult> {
  const email = await dispatchPaymentEmailRule(db, {
    trigger: "payment-executive-remind",
    account: opts.account,
    recipientEmail: opts.recipientEmail,
    recipientName: opts.recipientName,
    recipientPhone: opts.recipientPhone,
    vars: opts.vars,
  });
  const whatsapp = await dispatchPaymentWhatsappRule(db, {
    trigger: "payment-executive-remind",
    account: opts.account,
    recipientPhone: opts.recipientPhone,
    vars: opts.vars,
  });
  return { email, whatsapp };
}

export async function dispatchServerPaymentClientReminder(
  db: ReturnType<typeof getDb>,
  accountId: string,
): Promise<{ ok: boolean; error?: string }> {
  const account = db.select().from(t.crmAccounts).where(eq(t.crmAccounts.id, accountId)).get();
  if (!account) return { ok: false, error: "CRM account not found" };

  const received = getAccountPaymentReceived(db, accountId);
  const snap = buildAccountPaymentSnapshot(account, received);
  const recipientEmail = (account.pocEmail || account.email)?.trim();
  if (!recipientEmail) {
    return { ok: false, error: "Account has no client email" };
  }

  const recipientName =
    account.pocName?.trim() || account.contact?.trim() || account.name;
  const vars = buildPaymentTemplateVars(account, snap, recipientName);
  const sent = await dispatchPaymentEmailRule(db, {
    trigger: "payment-overdue",
    account,
    recipientEmail,
    recipientName,
    recipientPhone: account.pocMobile || account.phone || undefined,
    vars,
  });

  if (!sent) {
    return { ok: false, error: "No active payment reminder rules or email endpoint" };
  }
  return { ok: true };
}

export async function dispatchServerPaymentExecutiveReminder(
  db: ReturnType<typeof getDb>,
  accountId: string,
): Promise<{ ok: boolean; error?: string; recipientCount?: number }> {
  const account = db.select().from(t.crmAccounts).where(eq(t.crmAccounts.id, accountId)).get();
  if (!account) return { ok: false, error: "CRM account not found" };

  const executives = resolveExecutiveRecipients(db, account);
  if (executives.length === 0) {
    return { ok: false, error: "No executive emails found for this account" };
  }

  const received = getAccountPaymentReceived(db, accountId);
  const snap = buildAccountPaymentSnapshot(account, received);

  let anySent = false;
  for (const executive of executives) {
    const vars = buildPaymentTemplateVars(account, snap, executive.name);
    const result = await dispatchExecutivePaymentChannels(db, {
      account,
      recipientEmail: executive.email,
      recipientName: executive.name,
      recipientPhone: executive.phone,
      vars,
    });
    if (result.email || result.whatsapp) anySent = true;
  }

  if (!anySent) {
    return { ok: false, error: "No active executive reminder rules or endpoints" };
  }
  return { ok: true, recipientCount: executives.length };
}
