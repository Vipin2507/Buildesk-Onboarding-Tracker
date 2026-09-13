import { z } from "zod";

import { todayIsoDate } from "@/lib/dpr-utils";
import { DPR_PRIORITIES, DPR_STATUSES } from "@/types/dpr";

export const DPR_DATE_PRESETS = ["today", "yesterday", "last7", "month", "custom"] as const;
export type DprDatePreset = (typeof DPR_DATE_PRESETS)[number];

export const dprTrackerSearchSchema = z.object({
  q: z.string().optional(),
  executiveIds: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  status: z.enum(DPR_STATUSES).optional(),
  priority: z.enum(DPR_PRIORITIES).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  datePreset: z.enum(DPR_DATE_PRESETS).optional(),
  tab: z.enum(["entries", "rollup"]).optional(),
});

export type DprTrackerSearch = z.infer<typeof dprTrackerSearchSchema>;

function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  dt.setDate(dt.getDate() + delta);
  return todayIsoDateFromDate(dt);
}

function todayIsoDateFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfMonthYmd(today: string): string {
  return `${today.slice(0, 7)}-01`;
}

/** Preset → inclusive from/to (YYYY-MM-DD, local calendar). */
export function dprDateRangeForPreset(preset: DprDatePreset, anchorToday = todayIsoDate()) {
  switch (preset) {
    case "yesterday": {
      const day = addDaysYmd(anchorToday, -1);
      return { dateFrom: day, dateTo: day };
    }
    case "last7":
      return { dateFrom: addDaysYmd(anchorToday, -6), dateTo: anchorToday };
    case "month":
      return { dateFrom: startOfMonthYmd(anchorToday), dateTo: anchorToday };
    case "custom":
      return { dateFrom: anchorToday, dateTo: anchorToday };
    case "today":
    default:
      return { dateFrom: anchorToday, dateTo: anchorToday };
  }
}

export function inferDprDatePreset(search: DprTrackerSearch): DprDatePreset {
  if (search.datePreset && search.datePreset !== "custom") return search.datePreset;
  const today = todayIsoDate();
  const from = search.dateFrom?.slice(0, 10);
  const to = search.dateTo?.slice(0, 10) ?? from;
  if (!from || !to) return "today";
  if (from === today && to === today) return "today";
  const y = addDaysYmd(today, -1);
  if (from === y && to === y) return "yesterday";
  if (from === addDaysYmd(today, -6) && to === today) return "last7";
  if (from === startOfMonthYmd(today) && to === today) return "month";
  return "custom";
}

export function dprTrackerSearchToApiFilters(search: DprTrackerSearch) {
  const today = todayIsoDate();
  const preset = search.datePreset && search.datePreset !== "custom" ? search.datePreset : undefined;
  const presetRange = preset ? dprDateRangeForPreset(preset, today) : null;
  const dateFrom = search.dateFrom?.slice(0, 10) || presetRange?.dateFrom || today;
  const dateTo = search.dateTo?.slice(0, 10) || search.dateFrom?.slice(0, 10) || presetRange?.dateTo || today;
  const from = dateFrom <= dateTo ? dateFrom : dateTo;
  const to = dateFrom <= dateTo ? dateTo : dateFrom;

  return {
    search: search.q?.trim() || undefined,
    executiveIds: search.executiveIds
      ? search.executiveIds.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined,
    category: search.category || undefined,
    subcategory: search.subcategory || undefined,
    status: search.status,
    priority: search.priority,
    dateFrom: from,
    dateTo: to,
    page: 1,
    pageSize: 500,
    sortBy: "entryDate" as const,
    sortDir: "desc" as const,
  };
}

/** Single day used for compliance reminders (end of selected range). */
export function dprTrackerComplianceDate(search: DprTrackerSearch): string {
  return dprTrackerSearchToApiFilters(search).dateTo;
}
