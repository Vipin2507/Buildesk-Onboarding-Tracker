import type { ModuleKey, ProjectManualProgress, ProjectProgressMilestoneKey } from "@/types";
import { PROJECT_PROGRESS_MILESTONES } from "@/types/project";

/** Milestone groups that feed each company module’s progress. */
export const MODULE_MILESTONE_GROUPS: Partial<Record<ModuleKey, string[]>> = {
  "customer-app": ["Customer App"],
  "vendor-management": ["Procurement"],
  "labor-management": ["Labor"],
  "construction-management": ["Setup & Data", "Document Formats", "Close-out"],
  "project-management": ["Setup & Data", "Integrations", "Close-out"],
};

export function milestonesForModule(moduleKey: ModuleKey) {
  const groups = MODULE_MILESTONE_GROUPS[moduleKey];
  if (!groups) return [];
  return PROJECT_PROGRESS_MILESTONES.filter((m) => groups.includes(m.group));
}

export function calcManualGroupProgress(
  progressRows: ProjectManualProgress[],
  groups: string[],
): number {
  const keys = PROJECT_PROGRESS_MILESTONES.filter((m) => groups.includes(m.group)).map(
    (m) => m.key,
  ) as ProjectProgressMilestoneKey[];
  if (keys.length === 0) return 0;
  if (progressRows.length === 0) return 0;

  let done = 0;
  let total = 0;
  for (const row of progressRows) {
    const na = row.notApplicable ?? {};
    const checks = row.checks ?? {};
    for (const key of keys) {
      if (na[key]) continue;
      total += 1;
      if (checks[key]) done += 1;
    }
  }
  if (total === 0) return 100;
  return Math.round((done / total) * 100);
}

export function isCompanyModulesAllLive(
  modules: { optedIn: boolean; liveAt?: string }[],
): boolean {
  const opted = modules.filter((m) => m.optedIn);
  if (opted.length === 0) return false;
  return opted.every((m) => Boolean(m.liveAt));
}
