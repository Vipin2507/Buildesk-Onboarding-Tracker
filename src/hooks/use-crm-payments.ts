import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createCrmPaymentRemark,
  deleteCrmPaymentRemark,
  getCrmPaymentInstallments,
  getCrmPaymentsSummary,
  listCrmPaymentRemarks,
  listCrmPaymentTransactions,
  listCrmPayments,
  recordCrmPaymentTransaction,
  updateCrmPaymentTransaction,
  deleteCrmPaymentTransaction,
  remindCrmPaymentAccount,
  remindCrmPaymentExecutive,
  remindCrmPaymentsBulk,
  previewCrmExecutivePaymentDigest,
  sendCrmExecutivePaymentDigest,
} from "@/lib/api";
import type { ExecutiveDigestDelivery } from "@/lib/crm-payment-executive-digest";
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
  remarks: (accountId: string) => [...crmPaymentsKeys.all, "remarks", accountId] as const,
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

export function useCrmPaymentRemarks(accountId: string, enabled: boolean) {
  return useQuery({
    queryKey: crmPaymentsKeys.remarks(accountId),
    queryFn: () => listCrmPaymentRemarks({ data: { accountId } }),
    enabled,
    staleTime: 15_000,
  });
}

function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read image"));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

export function useCreateCrmPaymentRemark(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { body: string; image?: File }) => {
      let image:
        | { fileName: string; mimeType: string; dataBase64: string }
        | undefined;
      if (input.image) {
        image = {
          fileName: input.image.name,
          mimeType: input.image.type || "image/jpeg",
          dataBase64: await fileToBase64(input.image),
        };
      }
      return createCrmPaymentRemark({
        data: { accountId, body: input.body, image },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: crmPaymentsKeys.remarks(accountId) });
    },
  });
}

export function useDeleteCrmPaymentRemark(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCrmPaymentRemark({ data: { id, accountId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: crmPaymentsKeys.remarks(accountId) });
    },
  });
}

function invalidatePaymentAccount(
  queryClient: ReturnType<typeof useQueryClient>,
  filters: ReturnType<typeof toFilters>,
  accountId: string,
) {
  void queryClient.invalidateQueries({ queryKey: crmPaymentsKeys.list(filters) });
  void queryClient.invalidateQueries({ queryKey: crmPaymentsKeys.summary(filters) });
  void queryClient.invalidateQueries({
    queryKey: crmPaymentsKeys.transactions(accountId),
  });
  void queryClient.invalidateQueries({
    queryKey: crmPaymentsKeys.installments(accountId),
  });
}

export function useRecordCrmPayment(search: CrmPaymentsSearch) {
  const queryClient = useQueryClient();
  const filters = toFilters(search);

  return useMutation({
    mutationFn: async (input: {
      accountId: string;
      amount: number;
      paidDate: string;
      note?: string;
      image?: File;
    }) => {
      let image:
        | { fileName: string; mimeType: string; dataBase64: string }
        | undefined;
      if (input.image) {
        image = {
          fileName: input.image.name,
          mimeType: input.image.type || "image/jpeg",
          dataBase64: await fileToBase64(input.image),
        };
      }
      return recordCrmPaymentTransaction({
        data: {
          accountId: input.accountId,
          amount: input.amount,
          paidDate: input.paidDate,
          note: input.note,
          image,
        },
      });
    },
    onSuccess: (_data, variables) => {
      invalidatePaymentAccount(queryClient, filters, variables.accountId);
    },
  });
}

export function useUpdateCrmPayment(search: CrmPaymentsSearch) {
  const queryClient = useQueryClient();
  const filters = toFilters(search);

  return useMutation({
    mutationFn: async (input: {
      id: string;
      accountId: string;
      amount: number;
      paidDate: string;
      note?: string | null;
      image?: File;
      clearImage?: boolean;
    }) => {
      let image:
        | { fileName: string; mimeType: string; dataBase64: string }
        | undefined;
      if (input.image) {
        image = {
          fileName: input.image.name,
          mimeType: input.image.type || "image/jpeg",
          dataBase64: await fileToBase64(input.image),
        };
      }
      return updateCrmPaymentTransaction({
        data: {
          id: input.id,
          accountId: input.accountId,
          amount: input.amount,
          paidDate: input.paidDate,
          note: input.note,
          image,
          clearImage: input.clearImage,
        },
      });
    },
    onSuccess: (_data, variables) => {
      invalidatePaymentAccount(queryClient, filters, variables.accountId);
    },
  });
}

export function useDeleteCrmPayment(search: CrmPaymentsSearch) {
  const queryClient = useQueryClient();
  const filters = toFilters(search);

  return useMutation({
    mutationFn: (input: { id: string; accountId: string }) =>
      deleteCrmPaymentTransaction({ data: input }),
    onSuccess: (_data, variables) => {
      invalidatePaymentAccount(queryClient, filters, variables.accountId);
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

export function usePreviewExecutivePaymentDigest() {
  return useMutation({
    mutationFn: (accountIds?: string[]) =>
      previewCrmExecutivePaymentDigest({
        data: { accountIds: accountIds?.length ? accountIds : undefined },
      }),
  });
}

export function useSendExecutivePaymentDigest() {
  return useMutation({
    mutationFn: (deliveries: ExecutiveDigestDelivery[]) =>
      sendCrmExecutivePaymentDigest({ data: { deliveries } }),
  });
}
