import { nowIso } from "@/types";
import type { OnboardingChecklistItem, ProjectProgressMilestoneKey } from "@/types";

/** Checklist rows driven by Progress Tracker milestones (Progress is source of truth). */
export const CHECKLIST_ITEM_MILESTONES: Array<{
  section: string;
  label: string;
  milestones: ProjectProgressMilestoneKey[];
}> = [
  { section: "project", label: "Project master created", milestones: ["projectSetup"] },
  { section: "project", label: "Address & RERA captured", milestones: ["projectSetup"] },
  { section: "project", label: "POCs assigned", milestones: ["projectSetup"] },
  { section: "project", label: "Other charges defined", milestones: ["projectSetup"] },
  {
    section: "unit",
    label: "Unit Detail Uploaded",
    milestones: ["existingDataUpload"],
  },
  {
    section: "customer",
    label: "Excel Uploaded",
    milestones: ["existingDataUpload"],
  },
  {
    section: "payment",
    label: "Uploaded",
    milestones: ["paymentUpload"],
  },
  { section: "documents", label: "Agreement template uploaded", milestones: ["agreementFormat"] },
  { section: "documents", label: "Demand letter tested", milestones: ["demandFormat"] },
  { section: "documents", label: "Receipt template live", milestones: ["receiptFormat"] },
  {
    section: "documents",
    label: "Reminder templates approved",
    milestones: ["welcomeLetterFormat", "allotmentLetterFormat"],
  },
  { section: "integrations", label: "WATI API connected", milestones: ["whatsappIntegration"] },
  { section: "integrations", label: "SMS gateway configured", milestones: ["smsIntegration"] },
  { section: "integrations", label: "Email SMTP verified", milestones: ["integrationConnected"] },
  { section: "golive", label: "Client sign-off received", milestones: ["clientSignOff"] },
];

/** Milestones that should flip when a checklist row changes. */
export function milestonesForChecklistItem(
  section: string,
  label: string,
): ProjectProgressMilestoneKey[] {
  return (
    CHECKLIST_ITEM_MILESTONES.find((m) => m.section === section && m.label === label)
      ?.milestones ?? []
  );
}

export function checklistMappingsForMilestone(key: ProjectProgressMilestoneKey) {
  return CHECKLIST_ITEM_MILESTONES.filter((m) => m.milestones.includes(key));
}

export function isChecklistRowFullyDone(item: OnboardingChecklistItem | undefined) {
  if (!item || item.notApplicable) return false;
  return item.collected && item.uploaded && item.live;
}

type MilestoneState = "done" | "na" | "open";

function milestoneState(
  checks: Partial<Record<ProjectProgressMilestoneKey, boolean>>,
  notApplicable: Partial<Record<ProjectProgressMilestoneKey, boolean>>,
  key: ProjectProgressMilestoneKey,
): MilestoneState {
  if (notApplicable[key]) return "na";
  if (checks[key]) return "done";
  return "open";
}

function sameChecklistState(a: OnboardingChecklistItem, b: OnboardingChecklistItem) {
  return (
    a.notApplicable === b.notApplicable &&
    a.collected === b.collected &&
    a.uploaded === b.uploaded &&
    a.live === b.live &&
    a.collectedAt === b.collectedAt &&
    a.uploadedAt === b.uploadedAt &&
    a.liveAt === b.liveAt
  );
}

let syncing = false;

export function isProgressChecklistSyncing() {
  return syncing;
}

export function withProgressChecklistSyncLock<T>(fn: () => T): T | undefined {
  if (syncing) return undefined;
  syncing = true;
  try {
    return fn();
  } finally {
    syncing = false;
  }
}

/**
 * Push Progress Tracker state into mapped Onboarding checklist rows.
 * Unmapped checklist rows (e.g. training, go-live date) are left untouched.
 */
export function computeChecklistPatchFromProgress(
  items: OnboardingChecklistItem[],
  checks: Partial<Record<ProjectProgressMilestoneKey, boolean>>,
  notApplicable: Partial<Record<ProjectProgressMilestoneKey, boolean>>,
): OnboardingChecklistItem[] {
  const now = nowIso();
  const byKey = new Map(items.map((i) => [`${i.section}::${i.label}`, i]));
  const patched: OnboardingChecklistItem[] = [];

  for (const mapping of CHECKLIST_ITEM_MILESTONES) {
    const item = byKey.get(`${mapping.section}::${mapping.label}`);
    if (!item) continue;
    const states = mapping.milestones.map((key) => milestoneState(checks, notApplicable, key));
    let next: OnboardingChecklistItem;
    if (states.every((s) => s === "na")) {
      next = {
        ...item,
        notApplicable: true,
        collected: false,
        uploaded: false,
        live: false,
        collectedAt: undefined,
        uploadedAt: undefined,
        liveAt: undefined,
        updatedAt: now,
      };
    } else if (states.every((s) => s === "done" || s === "na")) {
      next = {
        ...item,
        notApplicable: false,
        collected: true,
        uploaded: true,
        live: true,
        collectedAt: item.collectedAt ?? now,
        uploadedAt: item.uploadedAt ?? now,
        liveAt: item.liveAt ?? now,
        updatedAt: now,
      };
    } else {
      // Partial or open milestones → checklist not complete
      next = {
        ...item,
        notApplicable: false,
        collected: false,
        uploaded: false,
        live: false,
        collectedAt: undefined,
        uploadedAt: undefined,
        liveAt: undefined,
        updatedAt: now,
      };
    }
    if (!sameChecklistState(item, next)) {
      patched.push(next);
    }
  }
  return patched;
}

/**
 * Soft reverse: derive Progress milestone patches from checklist rows.
 * - All mapped rows fully done → check milestone
 * - All mapped rows N/A → milestone N/A
 * - Otherwise → clear check (and clear N/A if any row is actively incomplete)
 */
export function computeProgressPatchFromChecklist(
  items: OnboardingChecklistItem[],
  checks: Partial<Record<ProjectProgressMilestoneKey, boolean>>,
  notApplicable: Partial<Record<ProjectProgressMilestoneKey, boolean>>,
): {
  checks: Partial<Record<ProjectProgressMilestoneKey, boolean>>;
  notApplicable: Partial<Record<ProjectProgressMilestoneKey, boolean>>;
  changed: boolean;
} {
  const byKey = new Map(items.map((i) => [`${i.section}::${i.label}`, i]));
  const nextChecks = { ...checks };
  const nextNa = { ...notApplicable };
  let changed = false;

  const milestoneKeys = new Set<ProjectProgressMilestoneKey>();
  for (const m of CHECKLIST_ITEM_MILESTONES) {
    for (const key of m.milestones) milestoneKeys.add(key);
  }

  for (const key of milestoneKeys) {
    const mappings = checklistMappingsForMilestone(key);
    const rows = mappings
      .map((m) => byKey.get(`${m.section}::${m.label}`))
      .filter((r): r is OnboardingChecklistItem => Boolean(r));
    if (rows.length === 0) continue;

    const allNa = rows.every((r) => r.notApplicable);
    // Require every mapped row to be done (or N/A), with at least one actually done
    const everyCompleteOrNa = rows.every((r) => r.notApplicable || isChecklistRowFullyDone(r));
    const anyDone = rows.some((r) => isChecklistRowFullyDone(r));

    let wantNa = allNa;
    let wantCheck = !wantNa && everyCompleteOrNa && anyDone;

    // Shared milestone (e.g. existingDataUpload): check only when ALL mapped rows are done
    if (mappings.length > 1) {
      wantCheck = !wantNa && rows.every((r) => isChecklistRowFullyDone(r));
      wantNa = allNa;
    }

    if (Boolean(nextNa[key]) !== wantNa) {
      nextNa[key] = wantNa;
      changed = true;
    }
    if (wantNa) {
      if (nextChecks[key]) {
        nextChecks[key] = false;
        changed = true;
      }
    } else if (Boolean(nextChecks[key]) !== wantCheck) {
      nextChecks[key] = wantCheck;
      changed = true;
    }
  }

  return { checks: nextChecks, notApplicable: nextNa, changed };
}
