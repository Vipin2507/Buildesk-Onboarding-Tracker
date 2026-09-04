import type { ChecklistPhaseState } from "@/types";
import type { CrmReportChecklistItem, CrmTrainingSession } from "@/types/crm-onboarding";

export type CrmChecklistStatusFilter = "all" | "pending" | "completed" | "na";

export function getChecklistPhaseItemStatus(
  item: ChecklistPhaseState,
): Exclude<CrmChecklistStatusFilter, "all"> {
  if (item.notApplicable) return "na";
  if (item.collected && item.uploaded && item.live) return "completed";
  return "pending";
}

export function matchesChecklistPhaseStatusFilter(
  item: ChecklistPhaseState,
  filter: CrmChecklistStatusFilter,
): boolean {
  if (filter === "all") return true;
  return getChecklistPhaseItemStatus(item) === filter;
}

export function getTrainingSessionStatus(
  session: CrmTrainingSession,
): Exclude<CrmChecklistStatusFilter, "all"> {
  if (session.notApplicable) return "na";
  if (session.completed || (session.sessionCount ?? 0) > 0) return "completed";
  return "pending";
}

export function matchesTrainingStatusFilter(
  session: CrmTrainingSession,
  filter: CrmChecklistStatusFilter,
): boolean {
  if (filter === "all") return true;
  return getTrainingSessionStatus(session) === filter;
}

export function getReportItemStatus(
  item: CrmReportChecklistItem,
): Exclude<CrmChecklistStatusFilter, "all"> {
  if (item.notApplicable) return "na";
  if (item.status === "explained") return "completed";
  return "pending";
}

export function matchesReportStatusFilter(
  item: CrmReportChecklistItem,
  filter: CrmChecklistStatusFilter,
): boolean {
  if (filter === "all") return true;
  return getReportItemStatus(item) === filter;
}

export function countChecklistPhaseStatusFilters(items: ChecklistPhaseState[]) {
  let pending = 0;
  let completed = 0;
  let na = 0;
  for (const item of items) {
    const status = getChecklistPhaseItemStatus(item);
    if (status === "pending") pending += 1;
    else if (status === "completed") completed += 1;
    else na += 1;
  }
  return { all: items.length, pending, completed, na };
}

export function countTrainingStatusFilters(sessions: CrmTrainingSession[]) {
  let pending = 0;
  let completed = 0;
  let na = 0;
  for (const session of sessions) {
    const status = getTrainingSessionStatus(session);
    if (status === "pending") pending += 1;
    else if (status === "completed") completed += 1;
    else na += 1;
  }
  return { all: sessions.length, pending, completed, na };
}

export function countReportStatusFilters(items: CrmReportChecklistItem[]) {
  let pending = 0;
  let completed = 0;
  let na = 0;
  for (const item of items) {
    const status = getReportItemStatus(item);
    if (status === "pending") pending += 1;
    else if (status === "completed") completed += 1;
    else na += 1;
  }
  return { all: items.length, pending, completed, na };
}
