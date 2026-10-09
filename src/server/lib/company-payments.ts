import { asc, desc, eq } from "drizzle-orm";

import type {
  CompanyPaymentHistoryEntry,
  CompanyPaymentStatus,
} from "@/types/company";
import type { Company } from "@/types";
import type {
  CompanyPaymentInstallment,
  CompanyPaymentInstallmentStatus,
  CompanyPaymentMethod,
  CompanyPaymentTransaction,
  CompanyPaymentsSnapshot,
  ErpCompanyPaymentListItem,
  ErpCompanyPaymentsSummary,
} from "@/types/company-payment";
import { loadCompanies } from "@/server/api/mappers";
import { ApiError, newId, nowIso } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";

function num(value: string | number | null | undefined): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function mapTransaction(row: typeof t.companyPaymentTransactions.$inferSelect): CompanyPaymentTransaction {
  return {
    id: row.id,
    companyId: row.companyId,
    amount: row.amount,
    paidDate: row.paidDate,
    note: row.note ?? undefined,
    method: (row.method as CompanyPaymentMethod | undefined) ?? undefined,
    createdBy: row.createdBy ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapInstallment(row: typeof t.companyPaymentInstallments.$inferSelect): CompanyPaymentInstallment {
  return {
    id: row.id,
    companyId: row.companyId,
    sequence: row.sequence,
    label: row.label ?? undefined,
    amount: row.amount,
    dueDate: row.dueDate,
    status: (row.status as CompanyPaymentInstallmentStatus) || "pending",
    notes: row.notes ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function requireCompany(companyId: string) {
  const db = getDb();
  const row = db.select().from(t.companies).where(eq(t.companies.id, companyId)).get();
  if (!row) throw new ApiError(404, "Company not found");
  return row;
}

function dealSizeFromCompany(row: typeof t.companies.$inferSelect): number {
  return (
    num(row.dealSize) ||
    num(row.totalCost) ||
    num(row.amountWithGst) ||
    num(row.taxableAmount) ||
    0
  );
}

function derivePaymentStatus(received: number, dealSize: number): CompanyPaymentStatus {
  if (dealSize <= 0 && received <= 0) return "NA";
  if (received <= 0) return "Pending";
  if (dealSize > 0 && received >= dealSize) return "Fully paid";
  return "Partially paid";
}

function syncCompanyPaymentRollups(companyId: string) {
  const db = getDb();
  const company = requireCompany(companyId);
  const txs = db
    .select()
    .from(t.companyPaymentTransactions)
    .where(eq(t.companyPaymentTransactions.companyId, companyId))
    .all();
  const received = txs.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const dealSize = dealSizeFromCompany(company);
  const pending = Math.max(0, dealSize - received);
  const status = derivePaymentStatus(received, dealSize);
  const now = nowIso();

  db.update(t.companies)
    .set({
      paymentReceived: String(received),
      pendingAmount: String(pending),
      paymentStatus: status,
      updatedAt: now,
    })
    .where(eq(t.companies.id, companyId))
    .run();

  return { received, pending, status, dealSize };
}

function migrateLegacyPaymentHistory(companyId: string) {
  const db = getDb();
  const existing = db
    .select({ id: t.companyPaymentTransactions.id })
    .from(t.companyPaymentTransactions)
    .where(eq(t.companyPaymentTransactions.companyId, companyId))
    .all();
  if (existing.length > 0) return;

  const company = requireCompany(companyId);
  if (!company.paymentHistoryJson) return;

  let history: CompanyPaymentHistoryEntry[] = [];
  try {
    const parsed = JSON.parse(company.paymentHistoryJson) as unknown;
    if (Array.isArray(parsed)) history = parsed as CompanyPaymentHistoryEntry[];
  } catch {
    return;
  }
  if (history.length === 0) return;

  const now = nowIso();
  for (const entry of history) {
    const amount = Number(entry.amount) || 0;
    if (amount <= 0) continue;
    db.insert(t.companyPaymentTransactions)
      .values({
        id: entry.id || newId(),
        companyId,
        amount,
        paidDate: (entry.date || now).slice(0, 10),
        note: entry.note ?? null,
        method: entry.method ?? null,
        createdBy: null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }
}

function seedInstallmentsFromCompanyScalars(companyId: string) {
  const db = getDb();
  const existing = db
    .select({ id: t.companyPaymentInstallments.id })
    .from(t.companyPaymentInstallments)
    .where(eq(t.companyPaymentInstallments.companyId, companyId))
    .all();
  if (existing.length > 0) return;

  const company = requireCompany(companyId);
  const count = company.installmentCount ?? 0;
  const amount = num(company.installmentAmount);
  const dueDate = company.installmentDueDate?.slice(0, 10);
  if (count <= 0 || amount <= 0 || !dueDate) return;

  const now = nowIso();
  for (let i = 0; i < count; i += 1) {
    const due = new Date(`${dueDate}T00:00:00`);
    if (Number.isNaN(due.getTime())) break;
    due.setMonth(due.getMonth() + i);
    db.insert(t.companyPaymentInstallments)
      .values({
        id: newId(),
        companyId,
        sequence: i + 1,
        label: `Installment ${i + 1}`,
        amount,
        dueDate: due.toISOString().slice(0, 10),
        status: "pending",
        notes: null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }
}

export function listCompanyPaymentTransactions(companyId: string): CompanyPaymentTransaction[] {
  migrateLegacyPaymentHistory(companyId);
  const db = getDb();
  return db
    .select()
    .from(t.companyPaymentTransactions)
    .where(eq(t.companyPaymentTransactions.companyId, companyId))
    .orderBy(desc(t.companyPaymentTransactions.paidDate), desc(t.companyPaymentTransactions.createdAt))
    .all()
    .map(mapTransaction);
}

export function listCompanyPaymentInstallments(companyId: string): CompanyPaymentInstallment[] {
  seedInstallmentsFromCompanyScalars(companyId);
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const rows = db
    .select()
    .from(t.companyPaymentInstallments)
    .where(eq(t.companyPaymentInstallments.companyId, companyId))
    .orderBy(asc(t.companyPaymentInstallments.sequence), asc(t.companyPaymentInstallments.dueDate))
    .all();

  // Mark pending past-due as overdue for display (persist lightly).
  for (const row of rows) {
    if (row.status === "pending" && row.dueDate < today) {
      db.update(t.companyPaymentInstallments)
        .set({ status: "overdue", updatedAt: nowIso() })
        .where(eq(t.companyPaymentInstallments.id, row.id))
        .run();
      row.status = "overdue";
    }
  }

  return rows.map(mapInstallment);
}

export function getCompanyPaymentsSnapshot(companyId: string): CompanyPaymentsSnapshot {
  const company = requireCompany(companyId);
  const transactions = listCompanyPaymentTransactions(companyId);
  const installments = listCompanyPaymentInstallments(companyId);
  const rollups = syncCompanyPaymentRollups(companyId);

  return {
    companyId,
    companyName: company.name,
    dealSize: rollups.dealSize,
    paymentReceived: rollups.received,
    pendingAmount: rollups.pending,
    paymentStatus: rollups.status,
    installmentCount: installments.length,
    transactions,
    installments,
  };
}

export function recordCompanyPaymentTransaction(input: {
  companyId: string;
  amount: number;
  paidDate: string;
  note?: string;
  method?: string;
  createdBy?: string;
}): CompanyPaymentTransaction {
  requireCompany(input.companyId);
  const db = getDb();
  const id = newId();
  const now = nowIso();
  db.insert(t.companyPaymentTransactions)
    .values({
      id,
      companyId: input.companyId,
      amount: input.amount,
      paidDate: input.paidDate.slice(0, 10),
      note: input.note?.trim() || null,
      method: input.method?.trim() || null,
      createdBy: input.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  syncCompanyPaymentRollups(input.companyId);
  const row = db
    .select()
    .from(t.companyPaymentTransactions)
    .where(eq(t.companyPaymentTransactions.id, id))
    .get();
  if (!row) throw new ApiError(500, "Failed to record payment");
  return mapTransaction(row);
}

export function updateCompanyPaymentTransaction(input: {
  id: string;
  amount?: number;
  paidDate?: string;
  note?: string | null;
  method?: string | null;
}): CompanyPaymentTransaction {
  const db = getDb();
  const existing = db
    .select()
    .from(t.companyPaymentTransactions)
    .where(eq(t.companyPaymentTransactions.id, input.id))
    .get();
  if (!existing) throw new ApiError(404, "Payment not found");

  db.update(t.companyPaymentTransactions)
    .set({
      amount: input.amount ?? existing.amount,
      paidDate: input.paidDate?.slice(0, 10) ?? existing.paidDate,
      note: input.note === undefined ? existing.note : input.note?.trim() || null,
      method: input.method === undefined ? existing.method : input.method?.trim() || null,
      updatedAt: nowIso(),
    })
    .where(eq(t.companyPaymentTransactions.id, input.id))
    .run();

  syncCompanyPaymentRollups(existing.companyId);
  const row = db
    .select()
    .from(t.companyPaymentTransactions)
    .where(eq(t.companyPaymentTransactions.id, input.id))
    .get();
  if (!row) throw new ApiError(500, "Failed to update payment");
  return mapTransaction(row);
}

export function deleteCompanyPaymentTransaction(id: string) {
  const db = getDb();
  const existing = db
    .select()
    .from(t.companyPaymentTransactions)
    .where(eq(t.companyPaymentTransactions.id, id))
    .get();
  if (!existing) throw new ApiError(404, "Payment not found");
  db.delete(t.companyPaymentTransactions).where(eq(t.companyPaymentTransactions.id, id)).run();
  syncCompanyPaymentRollups(existing.companyId);
  return { ok: true as const, companyId: existing.companyId };
}

export function upsertCompanyPaymentInstallment(input: {
  id?: string;
  companyId: string;
  sequence?: number;
  label?: string;
  amount: number;
  dueDate: string;
  status?: CompanyPaymentInstallmentStatus;
  notes?: string;
}): CompanyPaymentInstallment {
  requireCompany(input.companyId);
  const db = getDb();
  const now = nowIso();

  if (input.id) {
    const existing = db
      .select()
      .from(t.companyPaymentInstallments)
      .where(eq(t.companyPaymentInstallments.id, input.id))
      .get();
    if (!existing || existing.companyId !== input.companyId) {
      throw new ApiError(404, "Installment not found");
    }
    db.update(t.companyPaymentInstallments)
      .set({
        sequence: input.sequence ?? existing.sequence,
        label: input.label?.trim() || existing.label,
        amount: input.amount,
        dueDate: input.dueDate.slice(0, 10),
        status: input.status ?? existing.status,
        notes: input.notes === undefined ? existing.notes : input.notes?.trim() || null,
        updatedAt: now,
      })
      .where(eq(t.companyPaymentInstallments.id, input.id))
      .run();
    const row = db
      .select()
      .from(t.companyPaymentInstallments)
      .where(eq(t.companyPaymentInstallments.id, input.id))
      .get();
    if (!row) throw new ApiError(500, "Failed to update installment");
    return mapInstallment(row);
  }

  const maxSeq = db
    .select()
    .from(t.companyPaymentInstallments)
    .where(eq(t.companyPaymentInstallments.companyId, input.companyId))
    .all()
    .reduce((max, row) => Math.max(max, row.sequence), 0);
  const id = newId();
  const sequence = input.sequence ?? maxSeq + 1;
  db.insert(t.companyPaymentInstallments)
    .values({
      id,
      companyId: input.companyId,
      sequence,
      label: input.label?.trim() || `Installment ${sequence}`,
      amount: input.amount,
      dueDate: input.dueDate.slice(0, 10),
      status: input.status ?? "pending",
      notes: input.notes?.trim() || null,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  db.update(t.companies)
    .set({
      installmentCount: maxSeq + 1,
      updatedAt: now,
    })
    .where(eq(t.companies.id, input.companyId))
    .run();

  const row = db
    .select()
    .from(t.companyPaymentInstallments)
    .where(eq(t.companyPaymentInstallments.id, id))
    .get();
  if (!row) throw new ApiError(500, "Failed to create installment");
  return mapInstallment(row);
}

export function deleteCompanyPaymentInstallment(id: string) {
  const db = getDb();
  const existing = db
    .select()
    .from(t.companyPaymentInstallments)
    .where(eq(t.companyPaymentInstallments.id, id))
    .get();
  if (!existing) throw new ApiError(404, "Installment not found");
  db.delete(t.companyPaymentInstallments).where(eq(t.companyPaymentInstallments.id, id)).run();
  const remaining = db
    .select()
    .from(t.companyPaymentInstallments)
    .where(eq(t.companyPaymentInstallments.companyId, existing.companyId))
    .all();
  db.update(t.companies)
    .set({
      installmentCount: remaining.length,
      updatedAt: nowIso(),
    })
    .where(eq(t.companies.id, existing.companyId))
    .run();
  return { ok: true as const, companyId: existing.companyId };
}

function dealSizeFromCompanyRecord(company: Company): number {
  return (
    company.dealSize ??
    company.totalCost ??
    company.amountWithGst ??
    company.taxableAmount ??
    0
  );
}

/** ERP hub: all companies with commercial rollups (not CRM payments). */
export function listErpCompanyPaymentSummaries(): {
  rows: ErpCompanyPaymentListItem[];
  summary: ErpCompanyPaymentsSummary;
} {
  const companies = loadCompanies();
  const db = getDb();
  const txCountByCompany = new Map<string, number>();
  try {
    for (const row of db.select().from(t.companyPaymentTransactions).all()) {
      txCountByCompany.set(row.companyId, (txCountByCompany.get(row.companyId) ?? 0) + 1);
    }
  } catch {
    /* table may not exist until db:ensure */
  }

  const rows: ErpCompanyPaymentListItem[] = companies.map((c) => {
    const dealSize = dealSizeFromCompanyRecord(c);
    const paymentReceived = c.paymentReceived ?? 0;
    const pendingAmount =
      c.pendingAmount != null ? c.pendingAmount : Math.max(0, dealSize - paymentReceived);
    const paymentStatus = c.paymentStatus ?? derivePaymentStatus(paymentReceived, dealSize);
    const collectionPercent =
      dealSize > 0 ? Math.min(100, Math.round((paymentReceived / dealSize) * 100)) : 0;

    return {
      companyId: c.id,
      companyName: c.name,
      city: c.city,
      commercialStatus: c.commercialStatus,
      dealSize,
      paymentReceived,
      pendingAmount,
      paymentStatus,
      installmentDueDate: c.installmentDueDate,
      transactionCount: txCountByCompany.get(c.id) ?? 0,
      collectionPercent,
    };
  });

  rows.sort((a, b) => {
    if (b.pendingAmount !== a.pendingAmount) return b.pendingAmount - a.pendingAmount;
    return a.companyName.localeCompare(b.companyName);
  });

  const summary: ErpCompanyPaymentsSummary = {
    companyCount: rows.length,
    totalDealSize: rows.reduce((s, r) => s + r.dealSize, 0),
    totalReceived: rows.reduce((s, r) => s + r.paymentReceived, 0),
    totalPending: rows.reduce((s, r) => s + r.pendingAmount, 0),
    fullyPaidCount: rows.filter((r) => r.paymentStatus === "Fully paid").length,
    pendingCount: rows.filter(
      (r) => r.paymentStatus === "Pending" || r.paymentStatus === "Partially paid",
    ).length,
  };

  return { rows, summary };
}
