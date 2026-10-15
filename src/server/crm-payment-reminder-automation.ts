import { eq } from "drizzle-orm";

import {
  DEFAULT_CRM_AUTOMATION_SETTINGS,
  N8N_EMAIL_SEGMENT,
} from "@/data/crm-automation-defaults";
import { crmSalesManagerNamesMatch } from "@/lib/crm-account-access";
import { phoneToWahaChatId } from "@/lib/automationEndpoints";
import type {
  PaymentClientReminderPreview,
  PaymentClientReminderSendInput,
} from "@/lib/crm-payment-client-reminder";
import { buildExecutiveDigestTemplateVars } from "@/lib/crm-payment-executive-digest";
import { resolveUserWorkEmail } from "@/lib/user-email";
import {
  renderAutomationSubject,
  renderAutomationTemplate,
} from "@/services/automationTemplate";
import { listActiveAdminUserIds } from "@/server/api/notifications";
import { appendServerCrmAutomationLog, loadCrmAutomationConfig } from "@/server/crm-booking-automation";
import {
  buildServerCrmN8nEmailBody,
  mergeServerEmailCc,
} from "@/server/crm-n8n-email-payload";
import { pickInternalTeamEmailTargets } from "@/server/lib/internal-team-email";
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

/** Delay between payment automation sends (email ↔ WhatsApp, recipient ↔ recipient). */
export const PAYMENT_AUTOMATION_SEND_PAUSE_MS = 400;

function pauseBetweenPaymentSends() {
  return new Promise<void>((resolve) => setTimeout(resolve, PAYMENT_AUTOMATION_SEND_PAUSE_MS));
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
  const recipients: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role: string;
    isAdmin: boolean;
  }[] = [];

  for (const adminId of listActiveAdminUserIds(db, "crm")) {
    const user = db.select().from(t.users).where(eq(t.users.id, adminId)).get();
    if (!user || user.active === false) continue;
    const email = resolveUserWorkEmail(user);
    if (!email || seen.has(email.toLowerCase())) continue;
    seen.add(email.toLowerCase());
    recipients.push({
      id: user.id,
      name: user.name,
      email,
      phone: user.phone ?? undefined,
      role: "Admin",
      isAdmin: true,
    });
  }

  for (const role of roles) {
    const displayName = role.name?.trim();
    if (!displayName) continue;
    for (const user of listActiveCrmUsers(db)) {
      if (!crmSalesManagerNamesMatch(displayName, user.name)) continue;
      const email = resolveUserWorkEmail(user);
      if (!email || seen.has(email.toLowerCase())) continue;
      seen.add(email.toLowerCase());
      recipients.push({
        id: user.id,
        name: user.name,
        email,
        phone: user.phone ?? undefined,
        role: role.label,
        isAdmin: false,
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
    extraCc?: string[];
    /** When set, use instead of rendering the rule template (dialog edits). */
    overrideSubject?: string;
    overrideBody?: string;
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
    const message =
      opts.overrideBody?.trim() ||
      renderAutomationTemplate(rule.templateBody, opts.vars);
    const subject =
      opts.overrideSubject?.trim() ||
      renderAutomationSubject(rule.templateSubject, opts.vars);
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
      extraCc: opts.extraCc,
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
  for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex++) {
    const rule = rules[ruleIndex]!;
    if (ruleIndex > 0) await pauseBetweenPaymentSends();
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
    extraCc?: string[];
    /** Skip email when a shared To+CC mail was already sent for the team. */
    skipEmail?: boolean;
    /** Skip WhatsApp (e.g. when only consolidating email). */
    skipWhatsapp?: boolean;
  },
): Promise<ExecutivePaymentChannelResult> {
  const config = loadCrmAutomationConfig(db);
  const emailRulesActive = config.rules.some(
    (r) => r.isActive && r.trigger === "payment-executive-remind" && r.channel === "email",
  );
  const whatsappRulesActive = config.rules.some(
    (r) => r.isActive && r.trigger === "payment-executive-remind" && r.channel === "whatsapp",
  );

  let email = false;
  let whatsapp = false;

  if (!opts.skipEmail && emailRulesActive && opts.recipientEmail.trim()) {
    email = await dispatchPaymentEmailRule(db, {
      trigger: "payment-executive-remind",
      account: opts.account,
      recipientEmail: opts.recipientEmail,
      recipientName: opts.recipientName,
      recipientPhone: opts.recipientPhone,
      vars: opts.vars,
      extraCc: opts.extraCc,
    });
  }

  if (!opts.skipWhatsapp && whatsappRulesActive) {
    if (email) await pauseBetweenPaymentSends();
    whatsapp = await dispatchPaymentWhatsappRule(db, {
      trigger: "payment-executive-remind",
      account: opts.account,
      recipientPhone: opts.recipientPhone,
      vars: opts.vars,
    });
  }

  return { email, whatsapp };
}

export type { PaymentClientReminderPreview };
export type PaymentClientReminderOverrides = Omit<PaymentClientReminderSendInput, "accountId">;

/** Preview client payment reminder email (editable in Payments UI before send). */
export function previewServerPaymentClientReminder(
  db: ReturnType<typeof getDb>,
  accountId: string,
): { ok: true; preview: PaymentClientReminderPreview } | { ok: false; error: string } {
  const account = db.select().from(t.crmAccounts).where(eq(t.crmAccounts.id, accountId)).get();
  if (!account) return { ok: false, error: "CRM account not found" };

  const config = loadCrmAutomationConfig(db);
  if (!config.settings.automationsEnabled) {
    return { ok: false, error: "CRM automations are disabled" };
  }

  const rule = config.rules.find(
    (r) => r.isActive && r.trigger === "payment-overdue" && r.channel === "email",
  );
  if (!rule) {
    return { ok: false, error: "No active Payment reminder (client) email rule" };
  }

  const emailEndpoint = config.endpoints.find((e) => e.channel === "email" && e.isEnabled);
  if (!emailEndpoint) {
    return { ok: false, error: "Email endpoint is disabled" };
  }

  const recipientEmail = (account.pocEmail || account.email)?.trim() || "";
  const recipientName =
    account.pocName?.trim() || account.contact?.trim() || account.name;
  const received = getAccountPaymentReceived(db, accountId);
  const snap = buildAccountPaymentSnapshot(account, received);
  const vars = buildPaymentTemplateVars(account, snap, recipientName);

  return {
    ok: true,
    preview: {
      accountId: account.id,
      accountName: account.name,
      recipientName,
      recipientEmail,
      subject: renderAutomationSubject(rule.templateSubject, vars),
      body: renderAutomationTemplate(rule.templateBody, vars),
      defaultCc: mergeServerEmailCc(config.settings.emailCc, rule.emailCc),
      ruleName: rule.name,
    },
  };
}

export async function dispatchServerPaymentClientReminder(
  db: ReturnType<typeof getDb>,
  accountId: string,
  overrides?: PaymentClientReminderOverrides,
): Promise<{ ok: boolean; error?: string }> {
  const account = db.select().from(t.crmAccounts).where(eq(t.crmAccounts.id, accountId)).get();
  if (!account) return { ok: false, error: "CRM account not found" };

  const received = getAccountPaymentReceived(db, accountId);
  const snap = buildAccountPaymentSnapshot(account, received);
  const recipientEmail =
    overrides?.recipientEmail?.trim() ||
    (account.pocEmail || account.email)?.trim();
  if (!recipientEmail) {
    return { ok: false, error: "Account has no client email" };
  }

  const recipientName =
    overrides?.recipientName?.trim() ||
    account.pocName?.trim() ||
    account.contact?.trim() ||
    account.name;
  const vars = buildPaymentTemplateVars(account, snap, recipientName);
  const sent = await dispatchPaymentEmailRule(db, {
    trigger: "payment-overdue",
    account,
    recipientEmail,
    recipientName,
    recipientPhone: account.pocMobile || account.phone || undefined,
    vars,
    extraCc: overrides?.extraCc,
    overrideSubject: overrides?.subject,
    overrideBody: overrides?.body,
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

  // Email: one message to an admin, other eligible teammates on CC.
  const emailTargets = pickInternalTeamEmailTargets(executives);
  if (emailTargets) {
    const vars = buildPaymentTemplateVars(account, snap, emailTargets.to.name);
    const result = await dispatchExecutivePaymentChannels(db, {
      account,
      recipientEmail: emailTargets.to.email,
      recipientName: emailTargets.to.name,
      recipientPhone: emailTargets.to.phone,
      vars,
      extraCc: emailTargets.ccEmails,
      skipWhatsapp: true,
    });
    if (result.email) anySent = true;
  }

  // WhatsApp still goes per person (no CC equivalent).
  for (let i = 0; i < executives.length; i++) {
    const executive = executives[i]!;
    if (!executive.phone?.trim()) continue;
    if (anySent || i > 0) await pauseBetweenPaymentSends();
    const vars = buildPaymentTemplateVars(account, snap, executive.name);
    const result = await dispatchExecutivePaymentChannels(db, {
      account,
      recipientEmail: executive.email,
      recipientName: executive.name,
      recipientPhone: executive.phone,
      vars,
      skipEmail: true,
    });
    if (result.whatsapp) anySent = true;
  }

  if (!anySent) {
    return { ok: false, error: "No active executive reminder rules or endpoints" };
  }
  return { ok: true, recipientCount: executives.length };
}
