import { roundMoney } from "@/lib/crm-account-commercial";
import type { CrmAccountInstallment } from "@/types/crm-account";

export const PAYMENT_BACKFILL_NOTE = "migration:initial-backfill";

export type PaymentStatus =
  | "overdue"
  | "due_this_week"
  | "upcoming"
  | "fully_paid"
  | "not_started";

export type InstallmentDerivedStatus = "paid" | "partially_paid" | "pending" | "overdue";

export type AllocatedInstallment = CrmAccountInstallment & {
  index: number;
  status: InstallmentDerivedStatus;
  paidAmount: number;
  remainingAmount: number;
};

export type NextDueInstallment = {
  amount: number;
  remainingAmount: number;
  dueDate: string;
};

export type PaymentAllocationResult = {
  installments: AllocatedInstallment[];
  nextDueInstallment: NextDueInstallment | null;
  paymentStatus: PaymentStatus;
  overdueDays: number | null;
  overdueAmount: number;
  collectionPercent: number;
};

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = new Date(`${fromYmd.slice(0, 10)}T12:00:00`);
  const b = new Date(`${toYmd.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

function startOfWeekMonday(ymd: string): string {
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function endOfWeekSunday(ymd: string): string {
  const mon = startOfWeekMonday(ymd);
  const d = new Date(`${mon}T12:00:00`);
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

export function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd.slice(0, 10);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function startOfMonthYmd(ymd: string): string {
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd.slice(0, 10);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${month}-01`;
}

export function endOfMonthYmd(ymd: string): string {
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd.slice(0, 10);
  d.setMonth(d.getMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}

/** List filter tabs — superset of row-level PaymentStatus. */
export type PaymentListFilterStatus =
  | PaymentStatus
  | "all"
  | "due_this_month"
  | "due_in_45_days"
  | "due_in_90_days";

export function matchesPaymentDueFilter(
  row: {
    paymentStatus: PaymentStatus;
    nextDueInstallment: { dueDate: string; remainingAmount?: number } | null;
  },
  filter: PaymentListFilterStatus,
  todayYmd?: string,
): boolean {
  if (filter === "all") return true;

  const today = (todayYmd ?? new Date().toISOString()).slice(0, 10);
  const due = row.nextDueInstallment?.dueDate.slice(0, 10);

  if (filter === "fully_paid") return row.paymentStatus === "fully_paid";
  if (filter === "not_started") return row.paymentStatus === "not_started";

  if (!due) return false;

  if (filter === "overdue") return due < today;

  if (filter === "due_this_week") {
    return due >= today && due >= startOfWeekMonday(today) && due <= endOfWeekSunday(today);
  }

  if (filter === "due_this_month") {
    return due >= startOfMonthYmd(today) && due <= endOfMonthYmd(today);
  }

  if (filter === "due_in_45_days") {
    return due >= today && due <= addDaysYmd(today, 45);
  }

  if (filter === "due_in_90_days") {
    return due >= today && due <= addDaysYmd(today, 90);
  }

  if (filter === "upcoming") {
    return due > addDaysYmd(today, 90);
  }

  return row.paymentStatus === filter;
}

/**
 * Installments are scheduled against pending amount only (see installmentBaseAmount).
 * Upfront payment at account creation (= deal − installment total) must not consume
 * installment #1 — only ledger payments beyond that baseline allocate FIFO.
 */
export function installmentAllocatablePool(
  totalReceived: number,
  totalDealValue: number,
  installments: CrmAccountInstallment[],
): number {
  const received = roundMoney(Math.max(0, totalReceived));
  const deal = roundMoney(Math.max(0, totalDealValue));
  const installmentTotal = roundMoney(
    installments.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
  );
  const upfrontBaseline = roundMoney(Math.max(0, deal - installmentTotal));
  return roundMoney(Math.max(0, received - upfrontBaseline));
}

/** FIFO allocation of post-upfront received amount across ordered installments. */
export function allocateAccountPayments(input: {
  installments: CrmAccountInstallment[];
  totalReceived: number;
  totalDealValue: number;
  todayYmd?: string;
}): PaymentAllocationResult {
  const today = (input.todayYmd ?? new Date().toISOString()).slice(0, 10);
  const totalReceived = roundMoney(Math.max(0, input.totalReceived));
  const totalDealValue = roundMoney(Math.max(0, input.totalDealValue));
  const ordered = [...input.installments].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  let pool = installmentAllocatablePool(totalReceived, totalDealValue, ordered);
  const allocated: AllocatedInstallment[] = [];
  let overdueAmount = 0;

  for (let i = 0; i < ordered.length; i++) {
    const row = ordered[i]!;
    const amount = roundMoney(Number(row.amount) || 0);
    let paidAmount = 0;
    let remainingAmount = amount;
    let status: InstallmentDerivedStatus = "pending";

    if (pool >= amount && amount > 0) {
      paidAmount = amount;
      remainingAmount = 0;
      pool = roundMoney(pool - amount);
      status = "paid";
    } else if (pool > 0) {
      paidAmount = pool;
      remainingAmount = roundMoney(amount - pool);
      pool = 0;
      status = "partially_paid";
    }

    if (remainingAmount > 0) {
      const isOverdue = row.dueDate.slice(0, 10) < today;
      if (isOverdue) {
        status = pool === 0 && paidAmount === 0 ? "overdue" : status === "partially_paid" ? "partially_paid" : "overdue";
        if (status === "overdue" || status === "partially_paid") {
          overdueAmount = roundMoney(overdueAmount + remainingAmount);
        }
      } else if (status === "pending") {
        status = "pending";
      }
    }

    allocated.push({
      index: i + 1,
      amount,
      dueDate: row.dueDate,
      status,
      paidAmount,
      remainingAmount,
    });
  }

  const nextRow = allocated.find((r) => r.remainingAmount > 0);
  const nextDueInstallment: NextDueInstallment | null = nextRow
    ? {
        amount: nextRow.amount,
        remainingAmount: nextRow.remainingAmount,
        dueDate: nextRow.dueDate,
      }
    : null;

  let overdueDays: number | null = null;
  if (nextDueInstallment && nextDueInstallment.dueDate.slice(0, 10) < today) {
    overdueDays = daysBetween(nextDueInstallment.dueDate, today);
  }

  let paymentStatus: PaymentStatus;
  if (totalDealValue > 0 && totalReceived >= totalDealValue - 0.01) {
    paymentStatus = "fully_paid";
  } else if (totalReceived <= 0 && !nextDueInstallment) {
    paymentStatus = "not_started";
  } else if (nextDueInstallment && nextDueInstallment.dueDate.slice(0, 10) < today) {
    paymentStatus = "overdue";
  } else if (
    nextDueInstallment &&
    nextDueInstallment.dueDate.slice(0, 10) >= startOfWeekMonday(today) &&
    nextDueInstallment.dueDate.slice(0, 10) <= endOfWeekSunday(today)
  ) {
    paymentStatus = "due_this_week";
  } else if (nextDueInstallment) {
    paymentStatus = "upcoming";
  } else if (totalReceived > 0) {
    paymentStatus = "fully_paid";
  } else {
    paymentStatus = "not_started";
  }

  const collectionPercent =
    totalDealValue > 0 ? roundMoney((totalReceived / totalDealValue) * 100) : 0;

  return {
    installments: allocated,
    nextDueInstallment,
    paymentStatus,
    overdueDays,
    overdueAmount: roundMoney(overdueAmount),
    collectionPercent,
  };
}

export function sumPaymentTransactions(
  rows: { amount: number | null | undefined }[],
): number {
  return roundMoney(rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0));
}
