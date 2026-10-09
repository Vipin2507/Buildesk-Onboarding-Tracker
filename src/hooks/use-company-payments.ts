import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteCompanyPayment,
  deleteCompanyPaymentInstallmentApi,
  getCompanyPayments,
  recordCompanyPayment,
  updateCompanyPayment,
  upsertCompanyPaymentInstallmentApi,
} from "@/lib/api";
import { erpPaymentsKeys } from "@/hooks/use-erp-payments";
import type { CompanyPaymentInstallmentStatus } from "@/types/company-payment";
import { useCompanyStore } from "@/stores/useCompanyStore";

export const companyPaymentsKeys = {
  all: ["company-payments"] as const,
  detail: (companyId: string) => [...companyPaymentsKeys.all, companyId] as const,
};

function applySnapshotRollups(
  companyId: string,
  snapshot: {
    paymentReceived: number;
    pendingAmount: number;
    paymentStatus: string;
    installmentCount: number;
  },
) {
  useCompanyStore.setState((s) => ({
    companies: s.companies.map((c) =>
      c.id === companyId
        ? {
            ...c,
            paymentReceived: snapshot.paymentReceived,
            pendingAmount: snapshot.pendingAmount,
            paymentStatus: snapshot.paymentStatus as typeof c.paymentStatus,
            installmentCount: snapshot.installmentCount,
          }
        : c,
    ),
  }));
}

export function useCompanyPayments(companyId: string, enabled = true) {
  return useQuery({
    queryKey: companyPaymentsKeys.detail(companyId),
    queryFn: () => getCompanyPayments({ data: { companyId } }),
    enabled: enabled && !!companyId,
    staleTime: 10_000,
  });
}

export function useRecordCompanyPayment(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      amount: number;
      paidDate: string;
      note?: string;
      method?: string;
    }) => recordCompanyPayment({ data: { companyId, ...input } }),
    onSuccess: (result) => {
      queryClient.setQueryData(companyPaymentsKeys.detail(companyId), result.snapshot);
      applySnapshotRollups(companyId, result.snapshot);
      void queryClient.invalidateQueries({ queryKey: erpPaymentsKeys.list() });
    },
  });
}

export function useUpdateCompanyPayment(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      amount?: number;
      paidDate?: string;
      note?: string | null;
      method?: string | null;
    }) => updateCompanyPayment({ data: input }),
    onSuccess: (result) => {
      queryClient.setQueryData(companyPaymentsKeys.detail(companyId), result.snapshot);
      applySnapshotRollups(companyId, result.snapshot);
      void queryClient.invalidateQueries({ queryKey: erpPaymentsKeys.list() });
    },
  });
}

export function useDeleteCompanyPayment(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCompanyPayment({ data: { id } }),
    onSuccess: (result) => {
      queryClient.setQueryData(companyPaymentsKeys.detail(companyId), result.snapshot);
      applySnapshotRollups(companyId, result.snapshot);
      void queryClient.invalidateQueries({ queryKey: erpPaymentsKeys.list() });
    },
  });
}

export function useUpsertCompanyPaymentInstallment(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id?: string;
      sequence?: number;
      label?: string;
      amount: number;
      dueDate: string;
      status?: CompanyPaymentInstallmentStatus;
      notes?: string;
    }) => upsertCompanyPaymentInstallmentApi({ data: { companyId, ...input } }),
    onSuccess: (result) => {
      queryClient.setQueryData(companyPaymentsKeys.detail(companyId), result.snapshot);
      applySnapshotRollups(companyId, result.snapshot);
      void queryClient.invalidateQueries({ queryKey: erpPaymentsKeys.list() });
    },
  });
}

export function useDeleteCompanyPaymentInstallment(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCompanyPaymentInstallmentApi({ data: { id } }),
    onSuccess: (result) => {
      queryClient.setQueryData(companyPaymentsKeys.detail(companyId), result.snapshot);
      applySnapshotRollups(companyId, result.snapshot);
      void queryClient.invalidateQueries({ queryKey: erpPaymentsKeys.list() });
    },
  });
}
