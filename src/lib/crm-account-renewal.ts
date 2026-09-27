import { addDaysYmd } from "@/lib/crm-payment-allocation";
import {
  addMonthsYmd,
  buildInstallmentSchedule,
  calcValuePerUserExGst,
  originalInstallments,
  renewalInstallments,
  roundMoney,
  serializeInstallments,
} from "@/lib/crm-account-commercial";
import type { CrmAccount, CrmAccountInstallment } from "@/types/crm-account";

/** Reminder / highlight opens this many days before the next renewal start. */
export const CRM_RENEWAL_REMINDER_DAYS = 30;

export function todayYmd(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Next service period starts the day after current end date. */
export function nextRenewalStartDate(endDate: string | undefined | null): string | null {
  const end = endDate?.trim().slice(0, 10);
  if (!end) return null;
  return addDaysYmd(end, 1);
}

/** First day the renewal window / reminder is active. */
export function renewalReminderStartDate(endDate: string | undefined | null): string | null {
  const nextStart = nextRenewalStartDate(endDate);
  if (!nextStart) return null;
  return addDaysYmd(nextStart, -CRM_RENEWAL_REMINDER_DAYS);
}

export function daysUntilYmd(targetYmd: string, today = todayYmd()): number {
  const a = new Date(`${today}T12:00:00`);
  const b = new Date(`${targetYmd.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

/** Account is in the 30-day (or overdue) renewal follow-up window. */
export function isCrmAccountInRenewalWindow(
  account: Pick<CrmAccount, "endDate">,
  today = todayYmd(),
): boolean {
  const reminderFrom = renewalReminderStartDate(account.endDate);
  if (!reminderFrom) return false;
  return today >= reminderFrom;
}

export function crmRenewalWindowLabel(
  account: Pick<CrmAccount, "endDate">,
  today = todayYmd(),
): string | null {
  if (!isCrmAccountInRenewalWindow(account, today)) return null;
  const end = account.endDate?.slice(0, 10);
  if (!end) return null;
  const days = daysUntilYmd(end, today);
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return "Expires today";
  return `Renewal in ${days}d`;
}

export function defaultRenewalEndDate(previousEndDate: string, termMonths = 12): string {
  const nextStart = nextRenewalStartDate(previousEndDate) ?? previousEndDate.slice(0, 10);
  // End of term: day before (start + termMonths), so period is inclusive of start.
  const afterTerm = addMonthsYmd(nextStart, termMonths);
  return addDaysYmd(afterTerm, -1);
}

export type CrmAccountRenewInput = {
  dealSize: number;
  usersPurchased: number;
  gstPercent: number;
  /** New service end date (editable term). */
  endDate: string;
  /** Renewal installment plan (will be tagged kind: "renewal"). */
  renewalInstallments: CrmAccountInstallment[];
  /** Lifetime ledger total at renew time (sets payment cycle baseline). */
  lifetimePaymentReceived: number;
};

/** Build account patch for a successful renew. Keeps old installments; appends renewal rows. */
export function buildCrmAccountRenewPatch(
  account: CrmAccount,
  input: CrmAccountRenewInput,
): Partial<CrmAccount> {
  const previousEnd = account.endDate?.slice(0, 10) || todayYmd();
  const startDate = nextRenewalStartDate(previousEnd) ?? addDaysYmd(previousEnd, 1);
  const endDate = input.endDate.slice(0, 10);
  const dealSize = roundMoney(Math.max(0, input.dealSize));
  const usersPurchased = Math.max(0, Math.floor(input.usersPurchased));
  const gstPercent = Math.max(0, input.gstPercent);
  const valuePerUser = calcValuePerUserExGst(dealSize, gstPercent, usersPurchased);
  const lifetime = roundMoney(Math.max(0, input.lifetimePaymentReceived));
  const existingBaseline = roundMoney(Number(account.paymentCycleBaseline) || 0);
  const cycleSoFar = roundMoney(Number(account.paymentReceived) || 0);
  const paymentCycleBaseline = roundMoney(
    Math.max(lifetime, existingBaseline + cycleSoFar, existingBaseline),
  );

  const kept = originalInstallments(account.installments ?? []).concat(
    renewalInstallments(account.installments ?? []),
  );
  const freshRenewalRows = input.renewalInstallments.map((row) => ({
    ...row,
    amount: roundMoney(Math.max(0, Number(row.amount) || 0)),
    dueDate: row.dueDate.slice(0, 10),
    kind: "renewal" as const,
  }));

  return {
    startDate,
    endDate,
    dealSize,
    totalCost: dealSize,
    usersPurchased,
    gstPercent,
    valuePerUser,
    paymentReceived: 0,
    pendingAmount: dealSize,
    paymentCycleBaseline,
    installments: [...kept, ...freshRenewalRows],
    annualLicense: true,
    renewalWindowNotifiedForEndDate: undefined,
  };
}

export function buildEqualRenewalInstallments(input: {
  dealSize: number;
  count: number;
  startDate: string;
}): CrmAccountInstallment[] {
  return buildInstallmentSchedule({
    totalAmount: input.dealSize,
    count: input.count,
    startDate: input.startDate,
  }).map((row) => ({ ...row, kind: "renewal" as const }));
}

export function renewPatchToApiFields(patch: Partial<CrmAccount>) {
  return {
    startDate: patch.startDate ?? null,
    endDate: patch.endDate ?? null,
    dealSize: patch.dealSize ?? null,
    totalCost: patch.totalCost ?? null,
    usersPurchased: patch.usersPurchased ?? null,
    gstPercent: patch.gstPercent ?? null,
    valuePerUser: patch.valuePerUser ?? null,
    paymentReceived: patch.paymentReceived ?? null,
    pendingAmount: patch.pendingAmount ?? null,
    paymentCycleBaseline: patch.paymentCycleBaseline ?? null,
    annualLicense: patch.annualLicense ?? null,
    renewalWindowNotifiedForEndDate: patch.renewalWindowNotifiedForEndDate ?? null,
    installmentsJson:
      patch.installments && patch.installments.length > 0
        ? serializeInstallments(patch.installments)
        : null,
  };
}
