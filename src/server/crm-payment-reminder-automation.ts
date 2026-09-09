import { eq } from "drizzle-orm";

import {
  DEFAULT_CRM_AUTOMATION_SETTINGS,
  N8N_EMAIL_SEGMENT,
} from "@/data/crm-automation-defaults";
import { resolveUserWorkEmail } from "@/lib/user-email";
import {
  renderAutomationSubject,
  renderAutomationTemplate,
} from "@/services/automationTemplate";
import { appendServerCrmAutomationLog, loadCrmAutomationConfig } from "@/server/crm-booking-automation";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { buildAccountPaymentSnapshot, getAccountPaymentReceived } from "@/server/lib/crm-payments";
import { nowIso } from "@/types";
import type { AutomationLog, AutomationTrigger } from "@/types/automation";

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

function findUserByDisplayName(db: ReturnType<typeof getDb>, name?: string | null) {
  const needle = name?.trim();
  if (!needle) return undefined;
  const lower = needle.toLowerCase();
  return db
    .select()
    .from(t.users)
    .all()
    .find((user) => user.name.trim().toLowerCase() === lower);
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
  const recipients: { name: string; email: string; role: string }[] = [];

  for (const role of roles) {
    const displayName = role.name?.trim();
    if (!displayName) continue;
    const user = findUserByDisplayName(db, displayName);
    const email = resolveUserWorkEmail(user);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    recipients.push({
      name: user?.name ?? displayName,
      email,
      role: role.label,
    });
  }

  return recipients;
}

function buildPaymentTemplateVars(
  account: typeof t.crmAccounts.$inferSelect,
  snap: ReturnType<typeof buildAccountPaymentSnapshot>,
  recipientName: string,
) {
  const due = snap.nextDueInstallment;
  return {
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
    const body = {
      channel: "email" as const,
      templateId: rule.id,
      templateName: rule.name,
      trigger: opts.trigger,
      recipientEmail: opts.recipientEmail,
      recipientName: opts.recipientName,
      messageBody: message,
      emailSubject: subject,
      entityType: "crm-payment",
      productScope: "crm",
      entityId: opts.account.id,
      entityName: opts.account.name,
      companyName: opts.account.name,
      accountName: opts.account.name,
      customerName: opts.vars.customerName,
      salesManagerName: opts.vars.salesManagerName,
      supportManager1: opts.vars.supportManager1,
      supportManager2: opts.vars.supportManager2,
      dueAmount: opts.vars.dueAmount,
      dueDate: opts.vars.dueDate,
      paymentReceived: opts.vars.paymentReceived,
      pendingAmount: opts.vars.pendingAmount,
      totalDealValue: opts.vars.totalDealValue,
      overdueAmount: opts.vars.overdueAmount,
    };

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
  const recipientEmail = executives.map((e) => e.email).join(", ");
  const recipientName = executives.map((e) => e.name).join(", ");
  const vars = buildPaymentTemplateVars(account, snap, recipientName);

  const sent = await dispatchPaymentEmailRule(db, {
    trigger: "payment-executive-remind",
    account,
    recipientEmail,
    recipientName,
    vars,
  });

  if (!sent) {
    return { ok: false, error: "No active executive reminder rules or email endpoint" };
  }
  return { ok: true, recipientCount: executives.length };
}
