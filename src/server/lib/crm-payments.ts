import { eq, sql } from "drizzle-orm";

import { parseInstallmentsJson, roundMoney } from "@/lib/crm-account-commercial";
import {
  allocateAccountPayments,
  PAYMENT_BACKFILL_NOTE,
  sumPaymentTransactions,
  type PaymentAllocationResult,
  type PaymentStatus,
} from "@/lib/crm-payment-allocation";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { newId, nowIso } from "@/types";
import type { CrmAccountInstallment } from "@/types/crm-account";

export type PaymentTransactionRow = {
  id: string;
  accountId: string;
  amount: number;
  paidDate: string;
  note?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
};

export function getAccountPaymentReceived(db: ReturnType<typeof getDb>, accountId: string): number {
  const rows = db
    .select({ amount: t.paymentTransactions.amount })
    .from(t.paymentTransactions)
    .where(eq(t.paymentTransactions.accountId, accountId))
    .all();
  return sumPaymentTransactions(rows);
}

/** Denormalize payment_received + pending_amount from the ledger. */
export function syncAccountPaymentTotals(db: ReturnType<typeof getDb>, accountId: string) {
  const account = db.select().from(t.crmAccounts).where(eq(t.crmAccounts.id, accountId)).get();
  if (!account) return;

  const received = getAccountPaymentReceived(db, accountId);
  const dealSize = roundMoney(Number(account.dealSize) || 0);
  const pending = roundMoney(Math.max(0, dealSize - received));

  db.update(t.crmAccounts)
    .set({
      paymentReceived: received,
      pendingAmount: pending,
      updatedAt: nowIso(),
    })
    .where(eq(t.crmAccounts.id, accountId))
    .run();
}

export function insertPaymentTransaction(
  db: ReturnType<typeof getDb>,
  input: {
    accountId: string;
    amount: number;
    paidDate: string;
    note?: string;
    createdBy?: string;
  },
): PaymentTransactionRow {
  const now = nowIso();
  const id = newId();
  const amount = roundMoney(input.amount);
  if (amount <= 0) throw new Error("Payment amount must be greater than zero");

  db.insert(t.paymentTransactions)
    .values({
      id,
      accountId: input.accountId,
      amount,
      paidDate: input.paidDate.slice(0, 10),
      note: input.note?.trim() || null,
      createdBy: input.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  syncAccountPaymentTotals(db, input.accountId);

  const row = db
    .select()
    .from(t.paymentTransactions)
    .where(eq(t.paymentTransactions.id, id))
    .get();
  if (!row) throw new Error("Failed to save payment transaction");
  return mapTransactionRow(row);
}

export function mapTransactionRow(
  row: typeof t.paymentTransactions.$inferSelect,
): PaymentTransactionRow {
  return {
    id: row.id,
    accountId: row.accountId,
    amount: row.amount ?? 0,
    paidDate: row.paidDate,
    note: row.note ?? undefined,
    createdBy: row.createdBy ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function buildAccountPaymentSnapshot(
  account: typeof t.crmAccounts.$inferSelect,
  totalReceived: number,
  todayYmd?: string,
): PaymentAllocationResult & {
  totalDealValue: number;
  paymentReceived: number;
  pendingAmount: number;
} {
  const installments = parseInstallmentsJson(account.installmentsJson);
  const totalDealValue = roundMoney(Number(account.dealSize) || 0);
  const paymentReceived = roundMoney(totalReceived);
  const pendingAmount = roundMoney(Math.max(0, totalDealValue - paymentReceived));
  const allocation = allocateAccountPayments({
    installments,
    totalReceived: paymentReceived,
    totalDealValue,
    todayYmd,
  });
  return {
    ...allocation,
    totalDealValue,
    paymentReceived,
    pendingAmount,
  };
}

export function ensureInitialPaymentOnAccountCreate(
  db: ReturnType<typeof getDb>,
  accountId: string,
  initialReceived: number,
  paidDate: string,
  createdBy?: string,
) {
  const amount = roundMoney(initialReceived);
  if (amount <= 0) {
    syncAccountPaymentTotals(db, accountId);
    return;
  }

  const existing = db
    .select({ id: t.paymentTransactions.id })
    .from(t.paymentTransactions)
    .where(eq(t.paymentTransactions.accountId, accountId))
    .get();
  if (existing) {
    syncAccountPaymentTotals(db, accountId);
    return;
  }

  insertPaymentTransaction(db, {
    accountId,
    amount,
    paidDate,
    note: "Initial payment (account creation)",
    createdBy,
  });
}

export const PAYMENTS_BACKFILL_CONFIG_KEY = "payments-backfill-v1";

export function runPaymentsBackfillIfNeeded(db: ReturnType<typeof getDb>) {
  const marker = db
    .select()
    .from(t.appConfig)
    .where(eq(t.appConfig.key, PAYMENTS_BACKFILL_CONFIG_KEY))
    .get();
  if (marker) return;

  const accounts = db
    .select({
      id: t.crmAccounts.id,
      paymentReceived: t.crmAccounts.paymentReceived,
      startDate: t.crmAccounts.startDate,
    })
    .from(t.crmAccounts)
    .all();

  let inserted = 0;
  let skippedZero = 0;

  for (const account of accounts) {
    const received = roundMoney(Number(account.paymentReceived) || 0);
    if (received <= 0) {
      skippedZero += 1;
      continue;
    }

    const already = db
      .select({ id: t.paymentTransactions.id })
      .from(t.paymentTransactions)
      .where(eq(t.paymentTransactions.accountId, account.id))
      .get();
    if (already) continue;

    const now = nowIso();
    db.insert(t.paymentTransactions)
      .values({
        id: newId(),
        accountId: account.id,
        amount: received,
        paidDate: (account.startDate ?? now).slice(0, 10),
        note: PAYMENT_BACKFILL_NOTE,
        createdBy: null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    inserted += 1;
    syncAccountPaymentTotals(db, account.id);
  }

  const now = nowIso();
  db.insert(t.appConfig)
    .values({
      key: PAYMENTS_BACKFILL_CONFIG_KEY,
      valueJson: JSON.stringify({ inserted, skippedZero, ranAt: now }),
      updatedAt: now,
    })
    .run();

  console.log(
    `[payments-backfill] inserted=${inserted} skippedZeroPaymentReceived=${skippedZero}`,
  );
}

export type PaymentsListFilters = {
  status?: PaymentStatus | "all";
  salesManagerName?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "nextDueDate" | "overdueAmount" | "collectionPercent";
  sortDir?: "asc" | "desc";
};

export type PaymentListItem = {
  id: string;
  accountName: string;
  salesManager?: string;
  totalDealValue: number;
  paymentReceived: number;
  pendingAmount: number;
  nextDueInstallment: {
    amount: number;
    remainingAmount: number;
    dueDate: string;
  } | null;
  overdueAmount: number;
  overdueDays: number | null;
  collectionPercent: number;
  paymentStatus: PaymentStatus;
};

export function queryPaymentListItems(
  db: ReturnType<typeof getDb>,
  filters: PaymentsListFilters,
  allowedAccountIds?: Set<string> | null,
): { rows: PaymentListItem[]; total: number } {
  runPaymentsBackfillIfNeeded(db);

  const today = new Date().toISOString().slice(0, 10);
  let accounts = db.select().from(t.crmAccounts).all();

  if (allowedAccountIds) {
    accounts = accounts.filter((a) => allowedAccountIds.has(a.id));
  }

  const receivedByAccount = new Map<string, number>();
  const txnRows = db
    .select({
      accountId: t.paymentTransactions.accountId,
      amount: t.paymentTransactions.amount,
    })
    .from(t.paymentTransactions)
    .all();
  for (const row of txnRows) {
    receivedByAccount.set(
      row.accountId,
      roundMoney((receivedByAccount.get(row.accountId) ?? 0) + (Number(row.amount) || 0)),
    );
  }

  let items: PaymentListItem[] = accounts.map((account) => {
    const received = receivedByAccount.get(account.id) ?? 0;
    const snap = buildAccountPaymentSnapshot(account, received, today);
    return {
      id: account.id,
      accountName: account.name,
      salesManager: account.salesManagerName ?? undefined,
      totalDealValue: snap.totalDealValue,
      paymentReceived: snap.paymentReceived,
      pendingAmount: snap.pendingAmount,
      nextDueInstallment: snap.nextDueInstallment,
      overdueAmount: snap.overdueAmount,
      overdueDays: snap.overdueDays,
      collectionPercent: snap.collectionPercent,
      paymentStatus: snap.paymentStatus,
    };
  });

  const search = filters.search?.trim().toLowerCase();
  if (search) {
    items = items.filter(
      (row) =>
        row.accountName.toLowerCase().includes(search) ||
        (row.salesManager ?? "").toLowerCase().includes(search),
    );
  }

  if (filters.salesManagerName && filters.salesManagerName !== "all") {
    if (filters.salesManagerName === "unassigned") {
      items = items.filter((row) => !row.salesManager?.trim());
    } else {
      items = items.filter((row) => row.salesManager === filters.salesManagerName);
    }
  }

  if (filters.status && filters.status !== "all") {
    items = items.filter((row) => row.paymentStatus === filters.status);
  }

  if (filters.dueDateFrom) {
    items = items.filter(
      (row) =>
        row.nextDueInstallment &&
        row.nextDueInstallment.dueDate.slice(0, 10) >= filters.dueDateFrom!.slice(0, 10),
    );
  }
  if (filters.dueDateTo) {
    items = items.filter(
      (row) =>
        row.nextDueInstallment &&
        row.nextDueInstallment.dueDate.slice(0, 10) <= filters.dueDateTo!.slice(0, 10),
    );
  }

  const sortBy = filters.sortBy ?? "nextDueDate";
  const sortDir = filters.sortDir ?? "asc";
  const dir = sortDir === "desc" ? -1 : 1;

  items.sort((a, b) => {
    if (sortBy === "overdueAmount") {
      return (a.overdueAmount - b.overdueAmount) * dir;
    }
    if (sortBy === "collectionPercent") {
      return (a.collectionPercent - b.collectionPercent) * dir;
    }
    const ad = a.nextDueInstallment?.dueDate ?? "9999-12-31";
    const bd = b.nextDueInstallment?.dueDate ?? "9999-12-31";
    return ad.localeCompare(bd) * dir;
  });

  const total = items.length;
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 15));
  const start = (page - 1) * pageSize;
  items = items.slice(start, start + pageSize);

  return { rows: items, total };
}

export function summarizePaymentList(
  db: ReturnType<typeof getDb>,
  filters: PaymentsListFilters,
  allowedAccountIds?: Set<string> | null,
) {
  const { rows: allRows } = queryPaymentListItems(
    db,
    { ...filters, page: 1, pageSize: 100000 },
    allowedAccountIds,
  );

  const totalContractValue = roundMoney(allRows.reduce((s, r) => s + r.totalDealValue, 0));
  const totalReceived = roundMoney(allRows.reduce((s, r) => s + r.paymentReceived, 0));
  const totalPending = roundMoney(allRows.reduce((s, r) => s + r.pendingAmount, 0));
  const totalOverdueAmount = roundMoney(allRows.reduce((s, r) => s + r.overdueAmount, 0));
  const overdueAccountCount = allRows.filter((r) => r.paymentStatus === "overdue").length;
  const dueThisWeekRows = allRows.filter((r) => r.paymentStatus === "due_this_week");
  const dueThisWeekAmount = roundMoney(
    dueThisWeekRows.reduce((s, r) => s + (r.nextDueInstallment?.remainingAmount ?? 0), 0),
  );
  const dueThisWeekCount = dueThisWeekRows.length;
  const collectionRatePercent =
    totalContractValue > 0 ? roundMoney((totalReceived / totalContractValue) * 100) : 0;

  return {
    totalContractValue,
    totalReceived,
    totalPending,
    totalOverdueAmount,
    overdueAccountCount,
    dueThisWeekAmount,
    dueThisWeekCount,
    collectionRatePercent,
    statusCounts: {
      all: allRows.length,
      overdue: allRows.filter((r) => r.paymentStatus === "overdue").length,
      due_this_week: dueThisWeekRows.length,
      upcoming: allRows.filter((r) => r.paymentStatus === "upcoming").length,
      fully_paid: allRows.filter((r) => r.paymentStatus === "fully_paid").length,
      not_started: allRows.filter((r) => r.paymentStatus === "not_started").length,
    },
  };
}

export function listAccountInstallmentsWithStatus(
  db: ReturnType<typeof getDb>,
  accountId: string,
) {
  const account = db.select().from(t.crmAccounts).where(eq(t.crmAccounts.id, accountId)).get();
  if (!account) return null;
  const received = getAccountPaymentReceived(db, accountId);
  const snap = buildAccountPaymentSnapshot(account, received);
  return snap.installments;
}

export function listAccountPaymentTransactions(
  db: ReturnType<typeof getDb>,
  accountId: string,
): PaymentTransactionRow[] {
  return db
    .select()
    .from(t.paymentTransactions)
    .where(eq(t.paymentTransactions.accountId, accountId))
    .orderBy(sql`${t.paymentTransactions.paidDate} DESC, ${t.paymentTransactions.createdAt} DESC`)
    .all()
    .map(mapTransactionRow);
}
