import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requirePermission } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { logActivity } from "@/server/api/mappers";
import {
  deleteCompanyPaymentInstallment,
  deleteCompanyPaymentTransaction,
  getCompanyPaymentsSnapshot,
  listErpCompanyPaymentSummaries,
  recordCompanyPaymentTransaction,
  updateCompanyPaymentTransaction,
  upsertCompanyPaymentInstallment,
} from "@/server/lib/company-payments";
import { COMPANY_PAYMENT_INSTALLMENT_STATUSES } from "@/types/company-payment";

const installmentStatusSchema = z.enum(
  COMPANY_PAYMENT_INSTALLMENT_STATUSES as [
    (typeof COMPANY_PAYMENT_INSTALLMENT_STATUSES)[number],
    ...(typeof COMPANY_PAYMENT_INSTALLMENT_STATUSES)[number][],
  ],
);

export const getCompanyPayments = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ companyId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    requireUser();
    return getCompanyPaymentsSnapshot(data.companyId);
  });

export const listErpCompanyPayments = createServerFn({ method: "GET" }).handler(async () => {
  requireUser();
  return listErpCompanyPaymentSummaries();
});

export const recordCompanyPayment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        companyId: z.string().min(1),
        amount: z.number().positive(),
        paidDate: z.string().min(1),
        note: z.string().max(2000).optional(),
        method: z.string().max(80).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requirePermission("manageCompanies");
    const tx = recordCompanyPaymentTransaction({
      ...data,
      createdBy: user.name,
    });
    logActivity({
      who: user.name,
      what: `Recorded ERP payment of ₹${data.amount.toLocaleString("en-IN")} for company`,
      kind: "success",
      companyId: data.companyId,
    });
    return { transaction: tx, snapshot: getCompanyPaymentsSnapshot(data.companyId) };
  });

export const updateCompanyPayment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().min(1),
        amount: z.number().positive().optional(),
        paidDate: z.string().min(1).optional(),
        note: z.string().max(2000).nullable().optional(),
        method: z.string().max(80).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requirePermission("manageCompanies");
    const tx = updateCompanyPaymentTransaction(data);
    logActivity({
      who: user.name,
      what: `Updated ERP payment ${data.id}`,
      kind: "info",
      companyId: tx.companyId,
    });
    return { transaction: tx, snapshot: getCompanyPaymentsSnapshot(tx.companyId) };
  });

export const deleteCompanyPayment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const user = requirePermission("manageCompanies");
    const result = deleteCompanyPaymentTransaction(data.id);
    logActivity({
      who: user.name,
      what: `Deleted ERP payment ${data.id}`,
      kind: "warning",
      companyId: result.companyId,
    });
    return { ...result, snapshot: getCompanyPaymentsSnapshot(result.companyId) };
  });

export const upsertCompanyPaymentInstallmentApi = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().min(1).optional(),
        companyId: z.string().min(1),
        sequence: z.number().int().positive().optional(),
        label: z.string().max(120).optional(),
        amount: z.number().positive(),
        dueDate: z.string().min(1),
        status: installmentStatusSchema.optional(),
        notes: z.string().max(2000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requirePermission("manageCompanies");
    const installment = upsertCompanyPaymentInstallment(data);
    logActivity({
      who: user.name,
      what: `${data.id ? "Updated" : "Added"} ERP installment for company`,
      kind: "info",
      companyId: data.companyId,
    });
    return { installment, snapshot: getCompanyPaymentsSnapshot(data.companyId) };
  });

export const deleteCompanyPaymentInstallmentApi = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const user = requirePermission("manageCompanies");
    const result = deleteCompanyPaymentInstallment(data.id);
    logActivity({
      who: user.name,
      what: `Deleted ERP installment ${data.id}`,
      kind: "warning",
      companyId: result.companyId,
    });
    return { ...result, snapshot: getCompanyPaymentsSnapshot(result.companyId) };
  });
