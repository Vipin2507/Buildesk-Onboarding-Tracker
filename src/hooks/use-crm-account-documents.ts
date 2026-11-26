import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteCrmAccountDocument,
  listCrmAccountDocuments,
  updateCrmAccountDocument,
  uploadCrmAccountDocument,
} from "@/lib/api";
import { useCrmAccountStore } from "@/stores/useCrmAccountStore";
import type { CrmAccountDocumentKind } from "@/types/crm-account-document";

export const crmAccountDocumentKeys = {
  all: ["crm-account-documents"] as const,
  list: (accountId: string) => [...crmAccountDocumentKeys.all, accountId] as const,
};

function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read file"));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function patchSignOff(accountId: string, signOffUploadedAt?: string) {
  useCrmAccountStore.setState((state) => ({
    accounts: state.accounts.map((account) =>
      account.id === accountId ? { ...account, signOffUploadedAt } : account,
    ),
  }));
}

export function useCrmAccountDocuments(accountId: string, enabled = true) {
  return useQuery({
    queryKey: crmAccountDocumentKeys.list(accountId),
    queryFn: () => listCrmAccountDocuments({ data: { accountId } }),
    enabled: enabled && !!accountId,
    staleTime: 15_000,
  });
}

export function useUploadCrmAccountDocument(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { file: File; kind: CrmAccountDocumentKind; title?: string }) => {
      const dataBase64 = await fileToBase64(input.file);
      return uploadCrmAccountDocument({
        data: {
          accountId,
          kind: input.kind,
          fileName: input.file.name,
          mimeType: input.file.type || "application/octet-stream",
          dataBase64,
          title: input.title,
        },
      });
    },
    onSuccess: (doc) => {
      void queryClient.invalidateQueries({ queryKey: crmAccountDocumentKeys.list(accountId) });
      if (doc.kind === "signoff") patchSignOff(accountId, doc.uploadedAt);
    },
  });
}

export function useUpdateCrmAccountDocument(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; title: string }) =>
      updateCrmAccountDocument({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: crmAccountDocumentKeys.list(accountId) });
    },
  });
}

export function useDeleteCrmAccountDocument(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCrmAccountDocument({ data: { id } }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: crmAccountDocumentKeys.list(accountId) });
      if (result.kind === "signoff") patchSignOff(accountId, undefined);
    },
  });
}
