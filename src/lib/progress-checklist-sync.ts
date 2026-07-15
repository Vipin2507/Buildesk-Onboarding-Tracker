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
    label: "Unit configuration Excel uploaded",
    milestones: ["existingDataUpload"],
  },
  { section: "unit", label: "Tower/floor plan mapped", milestones: ["existingDataUpload"] },
  { section: "unit", label: "Unit types validated", milestones: ["existingDataUpload"] },
  { section: "unit", label: "Pricing sheet locked", milestones: ["existingDataUpload"] },
  {
    section: "customer",
    label: "Customer data Excel uploaded",
    milestones: ["existingDataUpload"],
  },
  { section: "customer", label: "Duplicate check completed", milestones: ["existingDataUpload"] },
  { section: "customer", label: "KYC linked", milestones: ["existingDataUpload"] },
  { section: "customer", label: "Contact numbers verified", milestones: ["existingDataUpload"] },
  {
    section: "payment",
    label: "Payment plans defined",
    milestones: ["paymentUpload", "dueMatching"],
  },
  { section: "payment", label: "Booking data uploaded", milestones: ["paymentUpload"] },
  { section: "payment", label: "Payment data uploaded", milestones: ["paymentUpload"] },
  { section: "payment", label: "Ledger reconciled", milestones: ["dueMatching"] },
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
  { section: "integrations", label: "Website form integrated", milestones: ["crmIntegration"] },
  { section: "integrations", label: "Email SMTP verified", milestones: ["integrationConnected"] },
  { section: "golive", label: "Client sign-off received", milestones: ["clientSignOff"] },
];

/** Milestones that should flip on when a checklist row is completed (soft reverse sync). */
export function milestonesForChecklistItem(
  section: string,
  label: string,
): ProjectProgressMilestoneKey[] {
  return (
    CHECKLIST_ITEM_MILESTONES.find((m) => m.section === section && m.label === label)
      ?.milestones ?? []
  );
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
    a.live === b.live
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
        updatedAt: now,
      };
    } else if (states.every((s) => s === "done" || s === "na")) {
      next = {
        ...item,
        notApplicable: false,
        collected: true,
        uploaded: true,
        live: true,
        updatedAt: now,
      };
    } else {
      next = {
        ...item,
        notApplicable: false,
        collected: false,
        uploaded: false,
        live: false,
        updatedAt: now,
      };
    }
    if (!sameChecklistState(item, next)) {
      patched.push(next);
    }
  }
  return patched;
}
