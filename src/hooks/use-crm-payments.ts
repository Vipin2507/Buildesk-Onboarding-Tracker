import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getCrmPaymentInstallments,
  getCrmPaymentsSummary,
  listCrmPaymentTransactions,
  listCrmPayments,
  recordCrmPaymentTransaction,
  remindCrmPaymentAccount,
  remindCrmPaymentExecutive,
  remindCrmPaymentsBulk,
} from "@/lib/api";
import type { CrmPaymentsSearch } from "@/lib/crm-payments-search";
import { crmPaymentsSearchToApiFilters } from "@/lib/crm-payments-search";

export const crmPaymentsKeys = {
  all: ["crm-payments"] as const,
  list: (filters: ReturnType<typeof crmPaymentsSearchToApiFilters>) =>
    [...crmPaymentsKeys.all, "list", filters] as const,
  summary: (filters: ReturnType<typeof crmPaymentsSearchToApiFilters>) =>
    [...crmPaymentsKeys.all, "summary", filters] as const,
  installments: (accountId: string) =>
    [...crmPaymentsKeys.all, "installments", accountId] as const,
  transactions: (accountId: string) =>
    [...crmPaymentsKeys.all, "transactions", accountId] as const,
};

function toFilters(search: CrmPaymentsSearch) {
  return crmPaymentsSearchToApiFilters(search);
}

export function useCrmPaymentsList(search: CrmPaymentsSearch) {
  const filters = toFilters(search);
  return useQuery({
    queryKey: crmPaymentsKeys.list(filters),
    queryFn: () => listCrmPayments({ data: filters }),
    staleTime: 15_000,
  });
}

export function useCrmPaymentsSummary(search: CrmPaymentsSearch) {
  const filters = toFilters(search);
  return useQuery({
    queryKey: crmPaymentsKeys.summary(filters),
    queryFn: () => getCrmPaymentsSummary({ data: filters }),
    staleTime: 15_000,
  });
}

export function useCrmPaymentInstallments(accountId: string, enabled: boolean) {
  return useQuery({
    queryKey: crmPaymentsKeys.installments(accountId),
    queryFn: () => getCrmPaymentInstallments({ data: { accountId } }),
    enabled,
    staleTime: 30_000,
  });
}

export function useCrmPaymentTransactions(accountId: string, enabled: boolean) {
  return useQuery({
    queryKey: crmPaymentsKeys.transactions(accountId),
    queryFn: () => listCrmPaymentTransactions({ data: { accountId } }),
    enabled,
    staleTime: 30_000,
  });
}

export function useRecordCrmPayment(search: CrmPaymentsSearch) {
  const queryClient = useQueryClient();
  const filters = toFilters(search);

  return useMutation({
    mutationFn: (input: {
      accountId: string;
      amount: number;
      paidDate: string;
      note?: string;
    }) => recordCrmPaymentTransaction({ data: input }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: crmPaymentsKeys.list(filters) });
      void queryClient.invalidateQueries({ queryKey: crmPaymentsKeys.summary(filters) });
      void queryClient.invalidateQueries({
        queryKey: crmPaymentsKeys.transactions(variables.accountId),
      });
      void queryClient.invalidateQueries({
        queryKey: crmPaymentsKeys.installments(variables.accountId),
      });
    },
  });
}

export function useRemindCrmPayment() {
  return useMutation({
    mutationFn: (accountId: string) => remindCrmPaymentAccount({ data: { accountId } }),
  });
}

export function useRemindCrmPaymentExecutive() {
  return useMutation({
    mutationFn: (accountId: string) => remindCrmPaymentExecutive({ data: { accountId } }),
  });
}

export function useRemindCrmPaymentsBulk() {
  return useMutation({
    mutationFn: (accountIds: string[]) => remindCrmPaymentsBulk({ data: { accountIds } }),
  });
}
