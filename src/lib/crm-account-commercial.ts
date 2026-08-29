import type { CrmAccountInstallment } from "@/types/crm-account";

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calcValuePerUser(dealSize: number, usersPurchased: number): number {
  if (!usersPurchased || usersPurchased <= 0) return 0;
  return roundMoney(dealSize / usersPurchased);
}

export function calcDealFromPerUser(valuePerUser: number, usersPurchased: number): number {
  if (!usersPurchased || usersPurchased <= 0) return 0;
  return roundMoney(valuePerUser * usersPurchased);
}

export function installmentBaseAmount(dealSize: number, pendingAmount: number): number {
  return pendingAmount > 0 ? pendingAmount : dealSize;
}

export function calcInstallmentAmount(totalAmount: number, count: number): number {
  if (!count || count <= 0 || totalAmount <= 0) return 0;
  return roundMoney(totalAmount / count);
}

export function addMonthsYmd(startYmd: string, months: number): string {
  const base = startYmd?.trim().slice(0, 10);
  if (!base) return "";
  const d = new Date(`${base}T12:00:00`);
  if (Number.isNaN(d.getTime())) return base;
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Split total into equal installments; last row absorbs rounding remainder. */
export function buildInstallmentSchedule(input: {
  totalAmount: number;
  count: number;
  startDate: string;
  amountEach?: number;
}): CrmAccountInstallment[] {
  const count = Math.max(0, Math.floor(input.count));
  if (count <= 0) return [];

  const total = roundMoney(Math.max(0, input.totalAmount));
  if (total <= 0) {
    return Array.from({ length: count }, (_, i) => ({
      amount: 0,
      dueDate: addMonthsYmd(input.startDate, i),
    }));
  }

  const each =
    input.amountEach != null && input.amountEach > 0
      ? roundMoney(input.amountEach)
      : calcInstallmentAmount(total, count);
  const rows: CrmAccountInstallment[] = [];
  let allocated = 0;

  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    const amount = isLast ? roundMoney(total - allocated) : each;
    allocated = roundMoney(allocated + amount);
    rows.push({
      amount,
      dueDate: addMonthsYmd(input.startDate, i),
    });
  }

  return rows;
}

export function parseInstallmentsJson(raw: string | null | undefined): CrmAccountInstallment[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const amount = Number((row as { amount?: unknown }).amount);
        const dueDate = String((row as { dueDate?: unknown }).dueDate ?? "").slice(0, 10);
        if (!dueDate || Number.isNaN(amount)) return null;
        return { amount: roundMoney(amount), dueDate };
      })
      .filter((row): row is CrmAccountInstallment => row != null);
  } catch {
    return [];
  }
}

export function serializeInstallments(installments: CrmAccountInstallment[]): string {
  return JSON.stringify(installments);
}
