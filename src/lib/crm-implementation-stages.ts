import type { CrmImplementationStageDef } from "@/types/crm-master";
import type { CrmImplementationStage } from "@/types/crm-onboarding";

export const CRM_DEFAULT_IMPLEMENTATION_STAGES: CrmImplementationStageDef[] = [
  { key: "new_account", label: "New Account", order: 1, active: true },
  { key: "account_created", label: "Account Created", order: 2, active: true },
  { key: "data_collection", label: "Data Collection", order: 3, active: true },
  { key: "data_setup_migration", label: "Data Setup / Migration", order: 4, active: true },
  { key: "training", label: "Training", order: 5, active: true },
  { key: "testing_uat", label: "Testing / UAT", order: 6, active: true },
  { key: "go_live", label: "Go-Live", order: 7, active: true },
  { key: "post_go_live_handover", label: "Post Go-Live / Handover", order: 8, active: true },
];

export const LEGACY_CRM_STAGE_MAP: Record<string, CrmImplementationStage> = {
  company_creation: "new_account",
  module_selection: "data_collection",
  master_creation: "data_collection",
  data_migration: "data_setup_migration",
  integration_setup: "data_setup_migration",
  report_explanation: "training",
  uat: "testing_uat",
  client_signoff: "testing_uat",
  ticket_support: "post_go_live_handover",
  customer_success: "post_go_live_handover",
};

export function seedCrmImplementationStages(): CrmImplementationStageDef[] {
  return CRM_DEFAULT_IMPLEMENTATION_STAGES.map((s) => ({ ...s }));
}

export function buildCrmStageLabelMap(
  stages: CrmImplementationStageDef[],
): Record<string, string> {
  return Object.fromEntries(stages.map((s) => [s.key, s.label]));
}

export function normalizeCrmImplementationStage(stage: string | undefined): CrmImplementationStage {
  const raw = stage?.trim();
  if (!raw) return "new_account";
  if (LEGACY_CRM_STAGE_MAP[raw]) return LEGACY_CRM_STAGE_MAP[raw];
  const known = CRM_DEFAULT_IMPLEMENTATION_STAGES.some((s) => s.key === raw);
  if (known) return raw as CrmImplementationStage;
  return "new_account";
}

export function normalizeCrmImplementationStages(
  existing: CrmImplementationStageDef[] | undefined,
): CrmImplementationStageDef[] {
  const byKey = new Map((existing ?? []).map((s) => [s.key, s]));
  return CRM_DEFAULT_IMPLEMENTATION_STAGES.map((def) => {
    const prev = byKey.get(def.key);
    if (!prev) return { ...def };
    return {
      key: def.key,
      label: prev.label?.trim() || def.label,
      order: typeof prev.order === "number" ? prev.order : def.order,
      active: prev.active !== false,
    };
  }).sort((a, b) => a.order - b.order);
}

export function isCrmGoLiveStage(stage: string | undefined): boolean {
  const normalized = normalizeCrmImplementationStage(stage);
  return normalized === "go_live" || normalized === "post_go_live_handover";
}
