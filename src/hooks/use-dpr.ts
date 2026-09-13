import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createDprEntriesFromTemplate,
  createDprEntry,
  getDprCategories,
  getDprCompliance,
  getDprDaySubmission,
  getDprSummary,
  listDprEntries,
  listDprTemplates,
  remindDprCompliance,
  submitDprDay,
  updateDprEntry,
} from "@/lib/api";
import type {
  CreateDprEntryInput,
  CreateDprFromTemplateInput,
  UpdateDprEntryInput,
} from "@/server/api/dpr";
import type { dprTrackerSearchToApiFilters } from "@/lib/dpr-tracker-search";

export const dprKeys = {
  all: ["dpr"] as const,
  categories: () => [...dprKeys.all, "categories"] as const,
  templates: (category?: string, subcategory?: string) =>
    [...dprKeys.all, "templates", category, subcategory] as const,
  entries: (filters: Record<string, unknown>) => [...dprKeys.all, "entries", filters] as const,
  summary: (filters: Record<string, unknown>) => [...dprKeys.all, "summary", filters] as const,
  compliance: (date: string) => [...dprKeys.all, "compliance", date] as const,
  submission: (entryDate: string) => [...dprKeys.all, "submission", entryDate] as const,
};

export function useDprCategories() {
  return useQuery({
    queryKey: dprKeys.categories(),
    queryFn: () => getDprCategories(),
    staleTime: 60_000,
  });
}

export function useDprTemplates(category?: string, subcategory?: string) {
  return useQuery({
    queryKey: dprKeys.templates(category, subcategory),
    queryFn: () => listDprTemplates({ data: { category, subcategory } }),
    enabled: Boolean(category && subcategory),
  });
}

export function useDprEntries(filters: Record<string, unknown>) {
  return useQuery({
    queryKey: dprKeys.entries(filters),
    queryFn: () => listDprEntries({ data: filters }),
    staleTime: 10_000,
  });
}

export function useDprSummary(filters: Record<string, unknown>) {
  return useQuery({
    queryKey: dprKeys.summary(filters),
    queryFn: () => getDprSummary({ data: filters }),
    staleTime: 10_000,
  });
}

export function useDprCompliance(date: string) {
  return useQuery({
    queryKey: dprKeys.compliance(date),
    queryFn: () => getDprCompliance({ data: { date } }),
    staleTime: 15_000,
  });
}

export function useDprDaySubmission(entryDate: string) {
  return useQuery({
    queryKey: dprKeys.submission(entryDate),
    queryFn: () => getDprDaySubmission({ data: { entryDate } }),
  });
}

function invalidateDprQueries(queryClient: ReturnType<typeof useQueryClient>, entryDate?: string) {
  void queryClient.invalidateQueries({ queryKey: dprKeys.all });
  if (entryDate) {
    void queryClient.invalidateQueries({ queryKey: dprKeys.compliance(entryDate) });
  }
}

export function useCreateDprEntry(entryDate: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDprEntryInput) => createDprEntry({ data: input }),
    onSuccess: () => invalidateDprQueries(queryClient, entryDate),
  });
}

export function useCreateDprFromTemplate(entryDate: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDprFromTemplateInput) =>
      createDprEntriesFromTemplate({ data: input }),
    onSuccess: () => invalidateDprQueries(queryClient, entryDate),
  });
}

export function useUpdateDprEntry(entryDate: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateDprEntryInput) => updateDprEntry({ data: input }),
    onSuccess: () => invalidateDprQueries(queryClient, entryDate),
  });
}

export function useSubmitDprDay(entryDate: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => submitDprDay({ data: { entryDate } }),
    onSuccess: () => invalidateDprQueries(queryClient, entryDate),
  });
}

export function useRemindDprCompliance(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (executiveIds: string[]) =>
      remindDprCompliance({ data: { executiveIds, date } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dprKeys.compliance(date) });
    },
  });
}

export type DprTrackerFilters = ReturnType<typeof dprTrackerSearchToApiFilters>;
