import { z } from "zod";

import { DPR_PRIORITIES, DPR_STATUSES } from "@/types/dpr";

export const dprTrackerSearchSchema = z.object({
  q: z.string().optional(),
  executiveIds: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  status: z.enum(DPR_STATUSES).optional(),
  priority: z.enum(DPR_PRIORITIES).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  tab: z.enum(["entries", "rollup"]).optional(),
});

export type DprTrackerSearch = z.infer<typeof dprTrackerSearchSchema>;

export function dprTrackerSearchToApiFilters(search: DprTrackerSearch) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    search: search.q?.trim() || undefined,
    executiveIds: search.executiveIds
      ? search.executiveIds.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined,
    category: search.category || undefined,
    subcategory: search.subcategory || undefined,
    status: search.status,
    priority: search.priority,
    dateFrom: search.dateFrom || today,
    dateTo: search.dateTo || search.dateFrom || today,
    page: 1,
    pageSize: 500,
    sortBy: "entryDate" as const,
    sortDir: "desc" as const,
  };
}
