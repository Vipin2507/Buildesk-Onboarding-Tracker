import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { canViewCrmAccount } from "@/lib/crm-account-access";
import type { PaymentStatus } from "@/lib/crm-payment-allocation";
import { isAdminRoleKey } from "@/lib/permissions";
import { ApiError, nowIso, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import {
  buildAccountPaymentSnapshot,
  getAccountPaymentReceived,
  insertPaymentTransaction,
  listAccountInstallmentsWithStatus,
  listAccountPaymentTransactions,
  queryPaymentListItems,
  summarizePaymentList,
  type PaymentsListFilters,
} from "@/server/lib/crm-payments";
import { appendServerCrmAutomationLog, loadCrmAutomationConfig } from "@/server/crm-booking-automation";

const paymentStatusSchema = z.enum([
  "all",
  "overdue",
  "due_this_week",
  "upcoming",
  "fully_paid",
  "not_started",
]);

const listFiltersSchema = z.object({
  status: paymentStatusSchema.optional(),
  salesManagerName: z.string().optional(),
  dueDateFrom: z.string().optional(),
  dueDateTo: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  sortBy: z.enum(["nextDueDate", "overdueAmount", "collectionPercent"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

function allowedAccountIdsForUser(user: { name: string; role: string }) {
  if (isAdminRoleKey(user.role)) return null;
  const db = getDb();
  const accounts = db.select().from(t.crmAccounts).all();
  return new Set(
    accounts
      .filter((row) =>
        canViewCrmAccount(
          {
            salesManagerName: row.salesManagerName ?? undefined,
            supportManager1: row.supportManager1 ?? undefined,
            supportManager2: row.supportManager2 ?? undefined,
          },
          user,
        ),
      )
      .map((row) => row.id),
  );
}

function assertCanViewAccountId(user: { name: string; role: string }, accountId: string) {
  const db = getDb();
  const row = db.select().from(t.crmAccounts).where(eq(t.crmAccounts.id, accountId)).get();
  if (!row) throw new ApiError(404, "CRM account not found");
  if (
    !isAdminRoleKey(user.role) &&
    !canViewCrmAccount(
      {
        salesManagerName: row.salesManagerName ?? undefined,
        supportManager1: row.supportManager1 ?? undefined,
        supportManager2: row.supportManager2 ?? undefined,
      },
      user,
    )
  ) {
    throw new ApiError(403, "You do not have permission to view this account");
  }
  return row;
}

function buildN8nUrl(base: string, segment: string) {
  const trimmed = base.replace(/\/+$/, "");
  return `${trimmed}/${segment.replace(/^\/+/, "")}`;
}

function toListFilters(data: z.infer<typeof listFiltersSchema>): PaymentsListFilters {
  return {
    status: (data.status ?? "all") as PaymentStatus | "all",
    salesManagerName: data.salesManagerName,
    dueDateFrom: data.dueDateFrom,
    dueDateTo: data.dueDateTo,
    search: data.search,
    page: data.page,
    pageSize: data.pageSize,
    sortBy: data.sortBy,
    sortDir: data.sortDir,
  };
}

export const listCrmPayments = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => listFiltersSchema.optional().parse(data ?? {}))
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const filters = toListFilters(data ?? {});
    const allowed = allowedAccountIdsForUser(user);
    const { rows, total } = queryPaymentListItems(db, filters, allowed);
    return { rows, total, page: filters.page ?? 1, pageSize: filters.pageSize ?? 15 };
  });

export const getCrmPaymentsSummary = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => listFiltersSchema.optional().parse(data ?? {}))
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const filters = toListFilters(data ?? {});
    const allowed = allowedAccountIdsForUser(user);
    return summarizePaymentList(db, filters, allowed);
  });

export const getCrmPaymentInstallments = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ accountId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    assertCanViewAccountId(user, data.accountId);
    const db = getDb();
    const rows = listAccountInstallmentsWithStatus(db, data.accountId);
    if (!rows) throw new ApiError(404, "CRM account not found");
    return rows;
  });

export const listCrmPaymentTransactions = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ accountId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    assertCanViewAccountId(user, data.accountId);
    const db = getDb();
    return listAccountPaymentTransactions(db, data.accountId);
  });

export const recordCrmPaymentTransaction = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        accountId: z.string(),
        amount: z.coerce.number().positive(),
        paidDate: z.string().min(1),
        note: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    assertCanViewAccountId(user, data.accountId);
    const db = getDb();
    const txn = insertPaymentTransaction(db, {
      accountId: data.accountId,
      amount: data.amount,
      paidDate: data.paidDate,
      note: data.note,
      createdBy: user.id,
    });
    const account = db
      .select()
      .from(t.crmAccounts)
      .where(eq(t.crmAccounts.id, data.accountId))
      .get()!;
    const received = getAccountPaymentReceived(db, data.accountId);
    const snapshot = buildAccountPaymentSnapshot(account, received);
    return { transaction: txn, snapshot };
  });

async function sendPaymentReminderForAccount(accountId: string, userId: string) {
  const db = getDb();
  const account = db.select().from(t.crmAccounts).where(eq(t.crmAccounts.id, accountId)).get();
  if (!account) throw new ApiError(404, "CRM account not found");

  const received = getAccountPaymentReceived(db, accountId);
  const snap = buildAccountPaymentSnapshot(account, received);
  const due = snap.nextDueInstallment;

  const config = loadCrmAutomationConfig(db);
  const emailEndpoint = config.endpoints.find((e) => e.channel === "email" && e.isEnabled);
  const to = account.pocEmail || account.email;
  const subject = `Payment reminder — ${account.name}`;
  const body = due
    ? `Reminder: ₹${due.remainingAmount.toLocaleString("en-IN")} due by ${due.dueDate} for ${account.name}.`
    : `Payment reminder for ${account.name}.`;

  if (emailEndpoint?.webhookUrl) {
    const url = buildN8nUrl(config.settings.n8nWebhookBase, emailEndpoint.webhookUrl);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject,
          body,
          event: "payment.overdue",
          accountId,
          accountName: account.name,
        }),
      });
      appendServerCrmAutomationLog(db, {
        id: `PAY-${Date.now()}`,
        companyId: accountId,
        channel: "email",
        trigger: "booking-status-changed",
        status: res.ok ? "success" : "failed",
        requestPayload: {
          event: "payment.overdue",
          accountId,
          accountName: account.name,
          to,
          subject,
        },
        responseSummary: res.ok ? `Reminder sent to ${to}` : undefined,
        errorMessage: res.ok ? undefined : `HTTP ${res.status}`,
        attemptedAt: nowIso(),
        retryCount: 0,
      });
    } catch (e) {
      appendServerCrmAutomationLog(db, {
        id: `PAY-${Date.now()}`,
        companyId: accountId,
        channel: "email",
        trigger: "booking-status-changed",
        status: "failed",
        requestPayload: {
          event: "payment.overdue",
          accountId,
          accountName: account.name,
          to,
          subject,
        },
        errorMessage: e instanceof Error ? e.message : "Reminder failed",
        attemptedAt: nowIso(),
        retryCount: 0,
      });
      throw new ApiError(502, "Failed to send payment reminder");
    }
  }

  return { ok: true as const, accountId, triggeredBy: userId };
}

export const remindCrmPaymentAccount = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ accountId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    assertCanViewAccountId(user, data.accountId);
    return sendPaymentReminderForAccount(data.accountId, user.id);
  });

export const remindCrmPaymentsBulk = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ accountIds: z.array(z.string()).min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const results: { accountId: string; ok: boolean; error?: string }[] = [];
    for (const accountId of data.accountIds) {
      try {
        assertCanViewAccountId(user, accountId);
        await sendPaymentReminderForAccount(accountId, user.id);
        results.push({ accountId, ok: true });
      } catch (e) {
        results.push({
          accountId,
          ok: false,
          error: e instanceof Error ? e.message : "Failed",
        });
      }
    }
    return { results, sent: results.filter((r) => r.ok).length };
  });
