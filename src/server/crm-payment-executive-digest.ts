import { eq } from "drizzle-orm";

import { crmSalesManagerNamesMatch } from "@/lib/crm-account-access";
import {
  buildExecutiveDigestTemplateVars,
  type ExecutiveDigestAccountLine,
  type ExecutiveDigestDelivery,
  type ExecutiveOverdueDigestPreview,
} from "@/lib/crm-payment-executive-digest";
import { resolveUserWorkEmail } from "@/lib/user-email";
import { listActiveAdminUserIds } from "@/server/api/notifications";
import { loadCrmAutomationConfig } from "@/server/crm-booking-automation";
import {
  dispatchExecutivePaymentChannels,
  PAYMENT_AUTOMATION_SEND_PAUSE_MS,
} from "@/server/crm-payment-reminder-automation";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { queryPaymentListItems, type PaymentListItem } from "@/server/lib/crm-payments";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const digestRecipientPauseMs = PAYMENT_AUTOMATION_SEND_PAUSE_MS;

function listActiveCrmUsers(db: ReturnType<typeof getDb>) {
  return db
    .select()
    .from(t.users)
    .all()
    .filter((u) => u.active !== false && (u.productScope || "erp") === "crm");
}

function usersMatchingManagerLabel(
  db: ReturnType<typeof getDb>,
  label?: string | null,
): typeof t.users.$inferSelect[] {
  const needle = label?.trim();
  if (!needle) return [];
  return listActiveCrmUsers(db).filter((u) => crmSalesManagerNamesMatch(needle, u.name));
}

function toAccountLine(row: PaymentListItem): ExecutiveDigestAccountLine {
  return {
    accountId: row.id,
    accountName: row.accountName,
    overdueAmount: row.overdueAmount,
    overdueDays: row.overdueDays,
    dueDate: row.nextDueInstallment?.dueDate ?? null,
    pendingAmount: row.pendingAmount,
    paymentReceived: row.paymentReceived,
    totalDealValue: row.totalDealValue,
    salesManager: row.salesManager,
    supportManager1: row.supportManager1,
    supportManager2: row.supportManager2,
  };
}

function loadOverduePaymentRows(
  db: ReturnType<typeof getDb>,
  allowedAccountIds: Set<string> | null,
  accountIdsFilter?: string[],
): PaymentListItem[] {
  const { rows } = queryPaymentListItems(
    db,
    { status: "overdue", pageSize: 10_000, sortBy: "overdueAmount", sortDir: "desc" },
    allowedAccountIds,
  );
  let overdue = rows.filter((r) => r.paymentStatus === "overdue" && r.overdueAmount > 0.009);
  if (accountIdsFilter?.length) {
    const pick = new Set(accountIdsFilter);
    overdue = overdue.filter((r) => pick.has(r.id));
  }
  return overdue;
}

function assignAccountToRecipient(
  map: Map<
    string,
    { user: typeof t.users.$inferSelect; roles: Set<string>; accountIds: Set<string> }
  >,
  user: typeof t.users.$inferSelect,
  role: string,
  accountId: string,
) {
  const email = resolveUserWorkEmail(user);
  if (!email?.trim()) return;
  let entry = map.get(user.id);
  if (!entry) {
    entry = { user, roles: new Set<string>(), accountIds: new Set<string>() };
    map.set(user.id, entry);
  }
  entry.roles.add(role);
  entry.accountIds.add(accountId);
}

export function buildExecutiveOverdueDigestPreview(
  db: ReturnType<typeof getDb>,
  allowedAccountIds: Set<string> | null,
  accountIdsFilter?: string[],
): ExecutiveOverdueDigestPreview {
  const overdueRows = loadOverduePaymentRows(db, allowedAccountIds, accountIdsFilter);
  const accounts = overdueRows.map(toAccountLine);

  const recipientMap = new Map<
    string,
    { user: typeof t.users.$inferSelect; roles: Set<string>; accountIds: Set<string> }
  >();

  for (const row of overdueRows) {
    const account = db.select().from(t.crmAccounts).where(eq(t.crmAccounts.id, row.id)).get();
    if (!account) continue;

    for (const adminId of listActiveAdminUserIds(db, "crm")) {
      const admin = db.select().from(t.users).where(eq(t.users.id, adminId)).get();
      if (admin) assignAccountToRecipient(recipientMap, admin, "Admin", row.id);
    }

    for (const user of usersMatchingManagerLabel(db, account.salesManagerName)) {
      assignAccountToRecipient(recipientMap, user, "Sales manager", row.id);
    }
    for (const user of usersMatchingManagerLabel(db, account.supportManager1)) {
      assignAccountToRecipient(recipientMap, user, "Support 1", row.id);
    }
    for (const user of usersMatchingManagerLabel(db, account.supportManager2)) {
      assignAccountToRecipient(recipientMap, user, "Support 2", row.id);
    }
  }

  const recipients = [...recipientMap.values()]
    .map((entry) => ({
      userId: entry.user.id,
      name: entry.user.name,
      email: resolveUserWorkEmail(entry.user) ?? "",
      phone: entry.user.phone ?? undefined,
      roles: [...entry.roles].sort(),
      accountIds: [...entry.accountIds].sort((a, b) => {
        const an = accounts.find((x) => x.accountId === a)?.accountName ?? "";
        const bn = accounts.find((x) => x.accountId === b)?.accountName ?? "";
        return an.localeCompare(bn);
      }),
    }))
    .filter((r) => r.email.trim())
    .sort((a, b) => a.name.localeCompare(b.name));

  return { accounts, recipients };
}

function recipientMayReceiveAccounts(
  db: ReturnType<typeof getDb>,
  allowedAccountIds: Set<string> | null,
  recipientUserId: string,
  accountIds: string[],
): boolean {
  const preview = buildExecutiveOverdueDigestPreview(db, allowedAccountIds, accountIds);
  const recipient = preview.recipients.find((r) => r.userId === recipientUserId);
  if (!recipient) return false;
  const allowed = new Set(recipient.accountIds);
  return accountIds.every((id) => allowed.has(id));
}

function executivePaymentRulesActive(db: ReturnType<typeof getDb>) {
  const config = loadCrmAutomationConfig(db);
  if (!config.settings.automationsEnabled) return { any: false, email: false, whatsapp: false };
  const rules = config.rules.filter(
    (r) => r.isActive && r.trigger === "payment-executive-remind",
  );
  return {
    any: rules.length > 0,
    email: rules.some((r) => r.channel === "email"),
    whatsapp: rules.some((r) => r.channel === "whatsapp"),
  };
}

async function sendDigestToRecipient(
  db: ReturnType<typeof getDb>,
  recipient: typeof t.users.$inferSelect,
  accountLines: ExecutiveDigestAccountLine[],
): Promise<{ ok: boolean; error?: string; email?: boolean; whatsapp?: boolean }> {
  const rules = executivePaymentRulesActive(db);
  if (!rules.any) {
    return { ok: false, error: "No active executive payment automation rules" };
  }

  const recipientEmail = resolveUserWorkEmail(recipient);
  if (rules.email && !recipientEmail?.trim()) {
    return { ok: false, error: "Recipient has no email for executive email rule" };
  }

  const primaryId = accountLines[0]?.accountId;
  const accountRow = primaryId
    ? db.select().from(t.crmAccounts).where(eq(t.crmAccounts.id, primaryId)).get()
    : undefined;
  if (!accountRow) {
    return { ok: false, error: "Account not found for digest" };
  }

  const vars = buildExecutiveDigestTemplateVars(recipient.name, accountLines);
  const channels = await dispatchExecutivePaymentChannels(db, {
    account: accountRow,
    recipientEmail: recipientEmail ?? "",
    recipientName: recipient.name,
    recipientPhone: recipient.phone ?? undefined,
    vars,
  });

  const ok =
    (rules.email && channels.email) || (rules.whatsapp && channels.whatsapp);

  if (!ok) {
    const parts: string[] = [];
    if (rules.email && !channels.email) parts.push("email failed or skipped");
    if (rules.whatsapp && !channels.whatsapp) parts.push("WhatsApp failed or skipped (check phone)");
    return {
      ok: false,
      error: parts.join("; ") || "No messages sent",
      email: channels.email,
      whatsapp: channels.whatsapp,
    };
  }

  return { ok: true, email: channels.email, whatsapp: channels.whatsapp };
}

export async function sendExecutiveOverdueDigest(
  db: ReturnType<typeof getDb>,
  deliveries: ExecutiveDigestDelivery[],
  allowedAccountIds: Set<string> | null,
): Promise<{ sent: number; failed: number; results: { recipientUserId: string; ok: boolean; error?: string }[] }> {
  const allAccountIds = [...new Set(deliveries.flatMap((d) => d.accountIds))];
  const preview = buildExecutiveOverdueDigestPreview(db, allowedAccountIds, allAccountIds);
  const accountById = new Map(preview.accounts.map((a) => [a.accountId, a]));

  const results: { recipientUserId: string; ok: boolean; error?: string }[] = [];
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < deliveries.length; i++) {
    const delivery = deliveries[i]!;
    if (i > 0) await sleep(digestRecipientPauseMs);

    const recipient = db.select().from(t.users).where(eq(t.users.id, delivery.recipientUserId)).get();
    if (!recipient) {
      failed += 1;
      results.push({ recipientUserId: delivery.recipientUserId, ok: false, error: "User not found" });
      continue;
    }

    if (
      !recipientMayReceiveAccounts(
        db,
        allowedAccountIds,
        delivery.recipientUserId,
        delivery.accountIds,
      )
    ) {
      failed += 1;
      results.push({
        recipientUserId: delivery.recipientUserId,
        ok: false,
        error: "Recipient not assigned to one or more accounts",
      });
      continue;
    }

    const lines = delivery.accountIds
      .map((id) => accountById.get(id))
      .filter((line): line is ExecutiveDigestAccountLine => Boolean(line));

    const result = await sendDigestToRecipient(db, recipient, lines);
    if (result.ok) sent += 1;
    else failed += 1;
    results.push({ recipientUserId: delivery.recipientUserId, ok: result.ok, error: result.error });
  }

  return { sent, failed, results };
}
