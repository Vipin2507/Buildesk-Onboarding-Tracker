import { desc, eq, sql } from "drizzle-orm";

import { parseInstallmentsJson, roundMoney } from "@/lib/crm-account-commercial";
import {
  allocateAccountPayments,
  classifyPaymentTransactionRenewal,
  isInactiveCrmAccountForPayments,
  isRenewalPaymentAccount,
  matchesPaymentDueFilter,
  PAYMENT_BACKFILL_NOTE,
  sumPaymentTransactions,
  type PaymentAllocationResult,
  type PaymentListFilterStatus,
  type PaymentStatus,
} from "@/lib/crm-payment-allocation";
import type { CrmAccount } from "@/types/crm-account";
import type { PaymentRemark, PaymentRemarkImage } from "@/types/payment-remark";
import {
  deletePaymentRemarkImageFromDisk,
  decodePaymentRemarkImagePayload,
  decodePaymentTransactionImagePayload,
  savePaymentRemarkImage,
  savePaymentTransactionImage,
  deletePaymentTransactionImageFromDisk,
} from "@/server/lib/crm-payment-remark-storage";
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
  image?: PaymentRemarkImage;
  createdAt: string;
  updatedAt: string;
  /** Portion of this payment that applies to the original deal. */
  dealAmount?: number;
  /** Portion beyond deal value (renewal). */
  renewalAmount?: number;
  /** True when any part of this payment is beyond deal value. */
  isRenewal?: boolean;
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
    image?: {
      fileName: string;
      mimeType: string;
      dataBase64: string;
    };
  },
): PaymentTransactionRow {
  const now = nowIso();
  const id = newId();
  const amount = roundMoney(input.amount);
  if (amount <= 0) throw new Error("Payment amount must be greater than zero");

  let imageFileName: string | null = null;
  let imageMimeType: string | null = null;
  let imageSizeBytes: number | null = null;
  let imageStorageKey: string | null = null;

  if (input.image) {
    const buffer = decodePaymentTransactionImagePayload(input.image.dataBase64);
    const saved = savePaymentTransactionImage({
      accountId: input.accountId,
      transactionId: id,
      fileName: input.image.fileName,
      mimeType: input.image.mimeType,
      buffer,
    });
    imageFileName = input.image.fileName.trim();
    imageMimeType = input.image.mimeType.trim();
    imageSizeBytes = buffer.length;
    imageStorageKey = saved.storageKey;
  }

  db.insert(t.paymentTransactions)
    .values({
      id,
      accountId: input.accountId,
      amount,
      paidDate: input.paidDate.slice(0, 10),
      note: input.note?.trim() || null,
      createdBy: input.createdBy ?? null,
      imageFileName,
      imageMimeType,
      imageSizeBytes,
      imageStorageKey,
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

export function updatePaymentTransaction(
  db: ReturnType<typeof getDb>,
  input: {
    id: string;
    accountId: string;
    amount: number;
    paidDate: string;
    note?: string | null;
    image?: {
      fileName: string;
      mimeType: string;
      dataBase64: string;
    };
    /** Clear existing receipt image when no new image is provided. */
    clearImage?: boolean;
  },
): PaymentTransactionRow {
  const existing = db
    .select()
    .from(t.paymentTransactions)
    .where(eq(t.paymentTransactions.id, input.id))
    .get();
  if (!existing || existing.accountId !== input.accountId) {
    throw new Error("Payment not found");
  }

  const amount = roundMoney(input.amount);
  if (amount <= 0) throw new Error("Payment amount must be greater than zero");

  let imageFileName = existing.imageFileName;
  let imageMimeType = existing.imageMimeType;
  let imageSizeBytes = existing.imageSizeBytes;
  let imageStorageKey = existing.imageStorageKey;

  if (input.image) {
    if (existing.imageStorageKey) {
      deletePaymentTransactionImageFromDisk(existing.imageStorageKey);
    }
    const buffer = decodePaymentTransactionImagePayload(input.image.dataBase64);
    const saved = savePaymentTransactionImage({
      accountId: input.accountId,
      transactionId: input.id,
      fileName: input.image.fileName,
      mimeType: input.image.mimeType,
      buffer,
    });
    imageFileName = input.image.fileName.trim();
    imageMimeType = input.image.mimeType.trim();
    imageSizeBytes = buffer.length;
    imageStorageKey = saved.storageKey;
  } else if (input.clearImage) {
    if (existing.imageStorageKey) {
      deletePaymentTransactionImageFromDisk(existing.imageStorageKey);
    }
    imageFileName = null;
    imageMimeType = null;
    imageSizeBytes = null;
    imageStorageKey = null;
  }

  db.update(t.paymentTransactions)
    .set({
      amount,
      paidDate: input.paidDate.slice(0, 10),
      note: input.note?.trim() || null,
      imageFileName,
      imageMimeType,
      imageSizeBytes,
      imageStorageKey,
      updatedAt: nowIso(),
    })
    .where(eq(t.paymentTransactions.id, input.id))
    .run();

  syncAccountPaymentTotals(db, input.accountId);

  const row = db
    .select()
    .from(t.paymentTransactions)
    .where(eq(t.paymentTransactions.id, input.id))
    .get();
  if (!row) throw new Error("Failed to update payment transaction");
  return mapTransactionRow(row);
}

export function deletePaymentTransaction(
  db: ReturnType<typeof getDb>,
  id: string,
  accountId: string,
): void {
  const existing = db
    .select()
    .from(t.paymentTransactions)
    .where(eq(t.paymentTransactions.id, id))
    .get();
  if (!existing || existing.accountId !== accountId) {
    throw new Error("Payment not found");
  }
  if (existing.imageStorageKey) {
    deletePaymentTransactionImageFromDisk(existing.imageStorageKey);
  }
  db.delete(t.paymentTransactions).where(eq(t.paymentTransactions.id, id)).run();
  syncAccountPaymentTotals(db, accountId);
}

function publicTransactionImageUrl(storageKey: string) {
  return `/api/crm-payment-transaction-files/${encodeURIComponent(storageKey).replace(/%2F/g, "/")}`;
}

export function mapTransactionRow(
  row: typeof t.paymentTransactions.$inferSelect,
): PaymentTransactionRow {
  const image =
    row.imageStorageKey && row.imageFileName && row.imageMimeType
      ? {
          fileName: row.imageFileName,
          mimeType: row.imageMimeType,
          sizeBytes: row.imageSizeBytes ?? 0,
          storageKey: row.imageStorageKey,
          url: publicTransactionImageUrl(row.imageStorageKey),
        }
      : undefined;

  return {
    id: row.id,
    accountId: row.accountId,
    amount: row.amount ?? 0,
    paidDate: row.paidDate,
    note: row.note ?? undefined,
    createdBy: row.createdBy ?? undefined,
    image,
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

export const PAYMENT_SHEET_IMPORT_NOTE = "Bulk payment sheet import";

/** Replace ledger with a single entry matching imported Paid (bulk sheet only). */
export function replaceAccountPaymentLedgerForImport(
  db: ReturnType<typeof getDb>,
  accountId: string,
  targetPaid: number,
  paidDate: string,
  createdBy?: string,
) {
  const target = roundMoney(Math.max(0, targetPaid));
  db.delete(t.paymentTransactions)
    .where(eq(t.paymentTransactions.accountId, accountId))
    .run();

  if (target > 0) {
    const now = nowIso();
    db.insert(t.paymentTransactions)
      .values({
        id: newId(),
        accountId,
        amount: target,
        paidDate: paidDate.slice(0, 10),
        note: PAYMENT_SHEET_IMPORT_NOTE,
        createdBy: createdBy ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  syncAccountPaymentTotals(db, accountId);
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
  status?: PaymentListFilterStatus;
  salesManagerName?: string;
  supportManager1?: string;
  supportManager2?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "nextDueDate" | "overdueAmount" | "collectionPercent" | "renewalDate";
  sortDir?: "asc" | "desc";
};

function matchesNamedManagerFilter(
  value: string | undefined,
  filter: string | undefined,
): boolean {
  if (!filter || filter === "all") return true;
  if (filter === "unassigned") return !value?.trim();
  return value === filter;
}

function applyPaymentsToolbarFilters(
  items: PaymentListItem[],
  filters: PaymentsListFilters,
): PaymentListItem[] {
  let rows = items;

  const search = filters.search?.trim().toLowerCase();
  if (search) {
    rows = rows.filter(
      (row) =>
        row.accountName.toLowerCase().includes(search) ||
        (row.salesManager ?? "").toLowerCase().includes(search) ||
        (row.supportManager1 ?? "").toLowerCase().includes(search) ||
        (row.supportManager2 ?? "").toLowerCase().includes(search),
    );
  }

  if (filters.salesManagerName) {
    rows = rows.filter((row) =>
      matchesNamedManagerFilter(row.salesManager, filters.salesManagerName),
    );
  }
  if (filters.supportManager1) {
    rows = rows.filter((row) =>
      matchesNamedManagerFilter(row.supportManager1, filters.supportManager1),
    );
  }
  if (filters.supportManager2) {
    rows = rows.filter((row) =>
      matchesNamedManagerFilter(row.supportManager2, filters.supportManager2),
    );
  }

  const useRenewalDates = filters.status === "renewal";
  if (filters.dueDateFrom) {
    const from = filters.dueDateFrom.slice(0, 10);
    rows = rows.filter((row) => {
      if (useRenewalDates) {
        return Boolean(row.renewalDate && row.renewalDate.slice(0, 10) >= from);
      }
      return (
        row.nextDueInstallment &&
        row.nextDueInstallment.dueDate.slice(0, 10) >= from
      );
    });
  }
  if (filters.dueDateTo) {
    const to = filters.dueDateTo.slice(0, 10);
    rows = rows.filter((row) => {
      if (useRenewalDates) {
        return Boolean(row.renewalDate && row.renewalDate.slice(0, 10) <= to);
      }
      return (
        row.nextDueInstallment &&
        row.nextDueInstallment.dueDate.slice(0, 10) <= to
      );
    });
  }

  return rows;
}

function applyPaymentsStatusFilter(
  items: PaymentListItem[],
  status: PaymentListFilterStatus,
  today: string,
): PaymentListItem[] {
  if (status === "lost") {
    return items.filter((row) => isInactiveCrmAccountForPayments(row.accountStatus));
  }

  const active = items.filter((row) => !isInactiveCrmAccountForPayments(row.accountStatus));
  if (status === "all") return active;
  if (status === "renewal") {
    return active.filter((row) => isRenewalPaymentAccount(row));
  }
  if (status === "fully_paid") {
    return active.filter((row) => row.paymentStatus === "fully_paid");
  }
  return active.filter((row) => matchesPaymentDueFilter(row, status, today));
}

function applyPaymentsListFilters(
  items: PaymentListItem[],
  filters: PaymentsListFilters,
  today: string,
): PaymentListItem[] {
  const rows = applyPaymentsToolbarFilters(items, filters);
  const status = filters.status ?? "all";
  return applyPaymentsStatusFilter(rows, status, today);
}

export type PaymentListItem = {
  id: string;
  accountName: string;
  accountStatus: CrmAccount["status"];
  supportManager1?: string;
  supportManager2?: string;
  salesManager?: string;
  totalDealValue: number;
  paymentReceived: number;
  pendingAmount: number;
  nextDueInstallment: {
    amount: number;
    remainingAmount: number;
    dueDate: string;
  } | null;
  /** Account end date — used as renewal date for fully paid accounts. */
  renewalDate?: string;
  overdueAmount: number;
  overdueDays: number | null;
  collectionPercent: number;
  paymentStatus: PaymentStatus;
  /** Collections beyond deal value. */
  renewalAmount: number;
};

function mapAccountsToPaymentListItems(
  accounts: (typeof t.crmAccounts.$inferSelect)[],
  receivedByAccount: Map<string, number>,
  today: string,
): PaymentListItem[] {
  return accounts.map((account) => {
    const received = receivedByAccount.get(account.id) ?? 0;
    const snap = buildAccountPaymentSnapshot(account, received, today);
    const endDate = account.endDate?.slice(0, 10) || undefined;
    return {
      id: account.id,
      accountName: account.name,
      accountStatus: account.status as CrmAccount["status"],
      supportManager1: account.supportManager1 ?? undefined,
      supportManager2: account.supportManager2 ?? undefined,
      salesManager: account.salesManagerName ?? undefined,
      totalDealValue: snap.totalDealValue,
      paymentReceived: snap.paymentReceived,
      pendingAmount: snap.pendingAmount,
      nextDueInstallment: snap.nextDueInstallment,
      renewalDate: endDate,
      overdueAmount: snap.overdueAmount,
      overdueDays: snap.overdueDays,
      collectionPercent: snap.collectionPercent,
      paymentStatus: snap.paymentStatus,
      renewalAmount: snap.renewalAmount,
    };
  });
}

function paymentReceivedByAccount(db: ReturnType<typeof getDb>): Map<string, number> {
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
  return receivedByAccount;
}

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

  const receivedByAccount = paymentReceivedByAccount(db);

  let items = mapAccountsToPaymentListItems(accounts, receivedByAccount, today);

  items = applyPaymentsListFilters(items, filters, today);

  const sortBy =
    filters.sortBy ?? (filters.status === "renewal" ? "renewalDate" : "nextDueDate");
  const sortDir = filters.sortDir ?? "asc";
  const dir = sortDir === "desc" ? -1 : 1;

  items.sort((a, b) => {
    if (sortBy === "overdueAmount") {
      return (a.overdueAmount - b.overdueAmount) * dir;
    }
    if (sortBy === "collectionPercent") {
      return (a.collectionPercent - b.collectionPercent) * dir;
    }
    if (sortBy === "renewalDate" || filters.status === "renewal") {
      const ad = a.renewalDate ?? "9999-12-31";
      const bd = b.renewalDate ?? "9999-12-31";
      return ad.localeCompare(bd) * dir;
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

function sumDueAmount(rows: PaymentListItem[]) {
  return roundMoney(rows.reduce((s, r) => s + (r.nextDueInstallment?.remainingAmount ?? 0), 0));
}

function countByStatusTab(rows: PaymentListItem[], filter: PaymentListFilterStatus, today: string) {
  return applyPaymentsStatusFilter(rows, filter, today).length;
}

export function summarizePaymentList(
  db: ReturnType<typeof getDb>,
  filters: PaymentsListFilters,
  allowedAccountIds?: Set<string> | null,
) {
  const today = new Date().toISOString().slice(0, 10);
  const { rows: tableRows } = queryPaymentListItems(
    db,
    { ...filters, page: 1, pageSize: 100000 },
    allowedAccountIds,
  );

  // Tab counts: same toolbar filters, but ignore active status tab.
  runPaymentsBackfillIfNeeded(db);
  let countAccounts = db.select().from(t.crmAccounts).all();
  if (allowedAccountIds) {
    countAccounts = countAccounts.filter((a) => allowedAccountIds.has(a.id));
  }
  const countScope = applyPaymentsToolbarFilters(
    mapAccountsToPaymentListItems(countAccounts, paymentReceivedByAccount(db), today),
    filters,
  );

  const totalContractValue = roundMoney(tableRows.reduce((s, r) => s + r.totalDealValue, 0));
  const totalReceived = roundMoney(tableRows.reduce((s, r) => s + r.paymentReceived, 0));
  const totalPending = roundMoney(tableRows.reduce((s, r) => s + r.pendingAmount, 0));
  const totalOverdueAmount = roundMoney(tableRows.reduce((s, r) => s + r.overdueAmount, 0));
  const overdueRows = tableRows.filter((r) => matchesPaymentDueFilter(r, "overdue", today));
  const overdueAccountCount = overdueRows.length;
  const dueThisWeekRows = tableRows.filter((r) =>
    matchesPaymentDueFilter(r, "due_this_week", today),
  );
  const dueThisMonthRows = tableRows.filter((r) =>
    matchesPaymentDueFilter(r, "due_this_month", today),
  );
  const dueIn45Rows = tableRows.filter((r) =>
    matchesPaymentDueFilter(r, "due_in_45_days", today),
  );
  const dueThisWeekAmount = sumDueAmount(dueThisWeekRows);
  const dueThisWeekCount = dueThisWeekRows.length;
  const dueThisMonthAmount = sumDueAmount(dueThisMonthRows);
  const dueThisMonthCount = dueThisMonthRows.length;
  const dueIn45DaysAmount = sumDueAmount(dueIn45Rows);
  const dueIn45DaysCount = dueIn45Rows.length;
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
    dueThisMonthAmount,
    dueThisMonthCount,
    dueIn45DaysAmount,
    dueIn45DaysCount,
    collectionRatePercent,
    statusCounts: {
      all: countByStatusTab(countScope, "all", today),
      overdue: countByStatusTab(countScope, "overdue", today),
      due_this_week: countByStatusTab(countScope, "due_this_week", today),
      due_this_month: countByStatusTab(countScope, "due_this_month", today),
      due_in_45_days: countByStatusTab(countScope, "due_in_45_days", today),
      due_in_90_days: countByStatusTab(countScope, "due_in_90_days", today),
      upcoming: countByStatusTab(countScope, "upcoming", today),
      fully_paid: countByStatusTab(countScope, "fully_paid", today),
      not_started: countByStatusTab(countScope, "not_started", today),
      lost: countByStatusTab(countScope, "lost", today),
      renewal: countByStatusTab(countScope, "renewal", today),
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
  const account = db.select().from(t.crmAccounts).where(eq(t.crmAccounts.id, accountId)).get();
  const dealValue = roundMoney(Number(account?.dealSize) || 0);
  const rows = db
    .select()
    .from(t.paymentTransactions)
    .where(eq(t.paymentTransactions.accountId, accountId))
    .orderBy(sql`${t.paymentTransactions.paidDate} DESC, ${t.paymentTransactions.createdAt} DESC`)
    .all()
    .map(mapTransactionRow);

  const classification = classifyPaymentTransactionRenewal(rows, dealValue);
  return rows.map((row) => {
    const parts = classification.get(row.id);
    const renewalAmount = parts?.renewalAmount ?? 0;
    return {
      ...row,
      dealAmount: parts?.dealAmount ?? row.amount,
      renewalAmount,
      isRenewal: renewalAmount > 0.01,
    };
  });
}

function publicRemarkImageUrl(storageKey: string) {
  return `/api/crm-payment-remark-files/${encodeURIComponent(storageKey).replace(/%2F/g, "/")}`;
}

function mapRemarkRow(row: typeof t.paymentRemarks.$inferSelect): PaymentRemark {
  const image =
    row.imageStorageKey && row.imageFileName && row.imageMimeType
      ? {
          fileName: row.imageFileName,
          mimeType: row.imageMimeType,
          sizeBytes: row.imageSizeBytes ?? 0,
          storageKey: row.imageStorageKey,
          url: publicRemarkImageUrl(row.imageStorageKey),
        }
      : undefined;

  return {
    id: row.id,
    accountId: row.accountId,
    body: row.body,
    image,
    createdByUserId: row.createdByUserId ?? undefined,
    createdByName: row.createdByName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function listAccountPaymentRemarks(
  db: ReturnType<typeof getDb>,
  accountId: string,
): PaymentRemark[] {
  return db
    .select()
    .from(t.paymentRemarks)
    .where(eq(t.paymentRemarks.accountId, accountId))
    .orderBy(desc(t.paymentRemarks.createdAt))
    .all()
    .map(mapRemarkRow);
}

export function insertPaymentRemark(
  db: ReturnType<typeof getDb>,
  input: {
    accountId: string;
    body: string;
    createdByUserId?: string;
    createdByName: string;
    image?: {
      fileName: string;
      mimeType: string;
      dataBase64: string;
    };
  },
): PaymentRemark {
  const body = input.body.trim();
  if (!body) throw new Error("Remark cannot be empty");

  const account = db
    .select({ id: t.crmAccounts.id })
    .from(t.crmAccounts)
    .where(eq(t.crmAccounts.id, input.accountId))
    .get();
  if (!account) throw new Error("CRM account not found");

  const id = newId();
  const now = nowIso();
  let imageFileName: string | null = null;
  let imageMimeType: string | null = null;
  let imageSizeBytes: number | null = null;
  let imageStorageKey: string | null = null;

  if (input.image) {
    const buffer = decodePaymentRemarkImagePayload(input.image.dataBase64);
    const saved = savePaymentRemarkImage({
      accountId: input.accountId,
      remarkId: id,
      fileName: input.image.fileName,
      mimeType: input.image.mimeType,
      buffer,
    });
    imageFileName = input.image.fileName.trim();
    imageMimeType = input.image.mimeType.trim();
    imageSizeBytes = buffer.length;
    imageStorageKey = saved.storageKey;
  }

  db.insert(t.paymentRemarks)
    .values({
      id,
      accountId: input.accountId,
      body,
      imageFileName,
      imageMimeType,
      imageSizeBytes,
      imageStorageKey,
      createdByUserId: input.createdByUserId ?? null,
      createdByName: input.createdByName.trim() || "Unknown",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const row = db.select().from(t.paymentRemarks).where(eq(t.paymentRemarks.id, id)).get();
  if (!row) throw new Error("Failed to save payment remark");
  return mapRemarkRow(row);
}

export function deletePaymentRemark(db: ReturnType<typeof getDb>, remarkId: string) {
  const existing = db
    .select()
    .from(t.paymentRemarks)
    .where(eq(t.paymentRemarks.id, remarkId))
    .get();
  if (!existing) return false;
  db.delete(t.paymentRemarks).where(eq(t.paymentRemarks.id, remarkId)).run();
  if (existing.imageStorageKey) {
    deletePaymentRemarkImageFromDisk(existing.imageStorageKey);
  }
  return true;
}
