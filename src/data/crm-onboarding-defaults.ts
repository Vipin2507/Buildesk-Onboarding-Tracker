import { newId, nowIso } from "@/types/common";
import type { CompanyType } from "@/types/company";
import type {
  CrmAccountProject,
  CrmMasterDictItem,
  CrmMasterTeam,
} from "@/types/crm-master";
import type {
  CrmCommActionKey,
  CrmGoLiveChecklistItem,
  CrmMasterChecklistItem,
  CrmMigrationChecklistItem,
  CrmModuleWorkflowStep,
  CrmModuleWorkflowStepKind,
  CrmOnboardingRecord,
  CrmProductModule,
  CrmProductModuleKey,
  CrmReportChecklistItem,
  CrmReportStatus,
  CrmTrainingSession,
} from "@/types/crm-onboarding";
import { calcChecklistProgress, isChecklistItemComplete } from "@/lib/checklist";

/** Integration modules delivered via a third-party provider, with the vendor options for each. */
export const CRM_PROVIDER_OTHER = "Other";

export const CRM_MODULE_PROVIDERS: Partial<Record<CrmProductModuleKey, string[]>> = {
  "whatsapp-integration": ["Gupshup", "WATI", "Interakt", "Meta Cloud API", "Twilio", "Kaleyra"],
  "sms-integration": ["MSG91", "Twilio", "Kaleyra", "Textlocal", "Gupshup", "Airtel IQ"],
  "email-integration": [
    "SendGrid",
    "Mailgun",
    "Amazon SES",
    "SMTP",
    "Microsoft 365",
    "Google Workspace",
    "Postmark",
  ],
  "ivr-integration": ["Exotel", "Knowlarity", "MyOperator", "Servetel", "Ozonetel"],
  "meta-lead-integration": ["Meta Business Suite", "LeadsBridge", "Zapier"],
  "google-ads-integration": ["Google Ads API", "Google Tag Manager", "Zapier", "Manual Sync"],
  "website-integration": ["Webhook", "Zapier", "WordPress", "Custom Form API", "Manual Sync"],
  "99acres-integration": ["99acres API", "Manual Sync"],
  "magicbricks-integration": ["MagicBricks API", "Manual Sync"],
  "housing-integration": ["Housing API", "Manual Sync"],
};

export function moduleRequiresProvider(key: CrmProductModuleKey): boolean {
  return isCrmIntegrationModule(key) || key in CRM_MODULE_PROVIDERS;
}

/** Built-in defaults only — prefer resolveCrmProviderOptions() for UI (includes Master edits + Other). */
export function providerOptionsFor(key: CrmProductModuleKey): string[] {
  const base = CRM_MODULE_PROVIDERS[key] ?? [];
  return [...base.filter((p) => p !== CRM_PROVIDER_OTHER), CRM_PROVIDER_OTHER];
}

export function seedCrmModuleProviders(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, values] of Object.entries(CRM_MODULE_PROVIDERS)) {
    out[key] = [...(values ?? [])].filter((p) => p !== CRM_PROVIDER_OTHER);
  }
  return out;
}

const GENERIC_MODULE_WORKFLOW: CrmModuleWorkflowStepDef[] = [
  { key: "requirement", label: "Requirement gathering", kind: "date" },
  { key: "configuration", label: "Configuration", kind: "date" },
  { key: "uat", label: "UAT / Testing", kind: "date" },
  { key: "go_live", label: "Go-Live", kind: "date" },
  { key: "remarks", label: "Remarks", kind: "remarks" },
];

const INTEGRATION_MODULE_WORKFLOW: CrmModuleWorkflowStepDef[] = [
  { key: "provider_selected", label: "Provider selected", kind: "date" },
  { key: "credentials", label: "API credentials collected", kind: "date" },
  { key: "configure", label: "Configure & connect", kind: "date" },
  { key: "test", label: "Test flow verified", kind: "date" },
  { key: "go_live", label: "Go-Live", kind: "date" },
  { key: "remarks", label: "Remarks", kind: "remarks" },
];

/** Core product module onboarding steps (Sales CRM uses Masters / Migration / Training / Reports tabs). */
export type CrmModuleWorkflowStepDef = {
  key: string;
  label: string;
  kind?: CrmModuleWorkflowStepKind;
  branch?: "yes" | "no";
  /** Yes-branch steps shown only when logo was received. */
  requiresLogoReceived?: boolean;
};

export const CORE_MODULE_WORKFLOWS: Partial<
  Record<CrmProductModuleKey, CrmModuleWorkflowStepDef[]>
> = {
  "sim-call-recording": [
    { key: "client_activated", label: "Client Activated from Super Admin", kind: "date" },
    { key: "user_count", label: "No Of user", kind: "date" },
    { key: "activated_for_user", label: "Activated for User", kind: "date" },
    { key: "dialer_installed", label: "Buildesk Dialer Installed", kind: "date" },
    { key: "training_provided", label: "Training Provided", kind: "date" },
    { key: "live", label: "Live", kind: "date" },
    { key: "remarks", label: "Remarks", kind: "remarks" },
  ],
  "cp-application": [
    { key: "white_labelled", label: "White Labelled", kind: "yes_no" },
    { key: "logo_received", label: "Logo Received or Not", kind: "yes_no", branch: "yes" },
    { key: "logo_upload", label: "Logo Upload", kind: "file", branch: "yes", requiresLogoReceived: true },
    {
      key: "logo_to_dev",
      label: "Provided Logo to Developer Team",
      kind: "date",
      branch: "yes",
      requiresLogoReceived: true,
    },
    { key: "informed_dev", label: "Informed Developer for CP App", kind: "date", branch: "no" },
    { key: "apk_received", label: "APK Received", kind: "date" },
    { key: "cp_training", label: "CP App Training Provided", kind: "date" },
    { key: "live", label: "Live", kind: "date" },
    { key: "remarks", label: "Remarks", kind: "remarks" },
  ],
  "reception-application": [
    {
      key: "project_budget_form",
      label: "Project, Budget & Reception Form created and allocated to Agent",
      kind: "date",
    },
    { key: "training_reception_admin", label: "Reception App Training — Admin", kind: "date" },
    { key: "training_reception_user", label: "Reception App Training — User", kind: "date" },
    { key: "training_dashboard_admin", label: "Reception App Dashboard — Admin", kind: "date" },
    { key: "training_dashboard_user", label: "Reception App Dashboard — User", kind: "date" },
    { key: "live", label: "Live", kind: "date" },
    { key: "remarks", label: "Remarks", kind: "remarks" },
  ],
  "ai-call-analysis": [
    { key: "training_provided", label: "Training Provided", kind: "date" },
    { key: "live", label: "Live", kind: "date" },
    { key: "remarks", label: "Remarks", kind: "remarks" },
  ],
  "auto-dialer": [
    { key: "admin_training", label: "Admin Training", kind: "date" },
    { key: "user_training", label: "User Training", kind: "date" },
    { key: "remarks", label: "Remarks", kind: "remarks" },
  ],
};

export function getModuleWorkflowTemplate(
  key: CrmProductModuleKey,
): CrmModuleWorkflowStepDef[] | undefined {
  if (key === "sales-crm") return undefined;
  if (isCrmIntegrationModule(key)) return INTEGRATION_MODULE_WORKFLOW;
  return CORE_MODULE_WORKFLOWS[key] ?? GENERIC_MODULE_WORKFLOW;
}

/** Steps that count toward module completion (excludes free-text remarks). */
export function getWorkflowProgressSteps(steps: CrmModuleWorkflowStep[]): CrmModuleWorkflowStep[] {
  return steps.filter((s) => (s.kind ?? "date") !== "remarks");
}

function stepFromDef(def: CrmModuleWorkflowStepDef): CrmModuleWorkflowStep {
  const kind = def.kind ?? "date";
  return {
    key: def.key,
    label: def.label,
    kind,
    done: false,
    remarks: kind === "remarks" ? "" : undefined,
  };
}

export function getCpWhiteLabelAnswer(
  steps: CrmModuleWorkflowStep[],
): "yes" | "no" | undefined {
  const value = steps.find((s) => s.key === "white_labelled")?.value;
  if (value === "yes" || value === "no") return value;
  return undefined;
}

function getCpLogoReceivedAnswer(steps: CrmModuleWorkflowStep[]): "yes" | "no" | undefined {
  const value = steps.find((s) => s.key === "logo_received")?.value;
  if (value === "yes" || value === "no") return value;
  return undefined;
}

function cpStepDef(key: string): CrmModuleWorkflowStepDef | undefined {
  return CORE_MODULE_WORKFLOWS["cp-application"]?.find((s) => s.key === key);
}

/** CP Application steps visible for the current white-label / logo branch. */
export function getVisibleCpApplicationSteps(steps: CrmModuleWorkflowStep[]): CrmModuleWorkflowStep[] {
  const whiteLabel = getCpWhiteLabelAnswer(steps);
  const logoReceived = getCpLogoReceivedAnswer(steps);
  const order = CORE_MODULE_WORKFLOWS["cp-application"]?.map((s) => s.key) ?? [];

  return steps
    .filter((step) => {
      const def = cpStepDef(step.key);
      if (!def) return false;
      if (step.key === "white_labelled") return true;
      if (!whiteLabel) return false;
      if (def.branch === "yes" && whiteLabel !== "yes") return false;
      if (def.branch === "no" && whiteLabel !== "no") return false;
      if (def.requiresLogoReceived && logoReceived !== "yes") return false;
      return true;
    })
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

export function isModuleWorkflowStepComplete(step: CrmModuleWorkflowStep): boolean {
  const kind = step.kind ?? "date";
  if (kind === "yes_no") return step.value === "yes" || step.value === "no";
  if (kind === "file") return Boolean(step.fileName?.trim());
  if (kind === "remarks") return true;
  return step.done;
}

export function calcCpApplicationWorkflowProgress(steps: CrmModuleWorkflowStep[]): number {
  const visible = getVisibleCpApplicationSteps(steps).filter((s) => s.kind !== "remarks");
  if (visible.length === 0) return 0;
  const done = visible.filter(isModuleWorkflowStepComplete).length;
  return Math.round((done / visible.length) * 100);
}

/** Keys cleared when white-label branch changes. */
export const CP_APPLICATION_YES_BRANCH_KEYS = [
  "logo_received",
  "logo_upload",
  "logo_to_dev",
] as const;

export const CP_APPLICATION_NO_BRANCH_KEYS = ["informed_dev"] as const;

export const CP_APPLICATION_SHARED_STEP_KEYS = [
  "apk_received",
  "cp_training",
  "live",
] as const;

export function moduleHasWorkflow(key: CrmProductModuleKey): boolean {
  return key !== "sales-crm" && Boolean(getModuleWorkflowTemplate(key)?.length);
}

export function defaultModuleWorkflow(key: CrmProductModuleKey): CrmModuleWorkflowStep[] {
  const template = getModuleWorkflowTemplate(key) ?? GENERIC_MODULE_WORKFLOW.map((s) => ({
    ...s,
    kind: "date" as const,
  }));
  return template.map(stepFromDef);
}

/** Preserve completion state when workflow templates gain new steps. */
export function mergeModuleWorkflow(
  existing: CrmModuleWorkflowStep[] | undefined,
  key: CrmProductModuleKey,
): CrmModuleWorkflowStep[] | undefined {
  if (key === "sales-crm") return undefined;
  const template = getModuleWorkflowTemplate(key);
  if (!template) return existing;
  const byKey = new Map((existing ?? []).map((s) => [s.key, s]));
  return template.map((def) => {
    const prev = byKey.get(def.key);
    if (prev) {
      const kind = def.kind ?? prev.kind ?? "date";
      if (kind === "remarks") {
        return {
          ...prev,
          label: def.label,
          kind: "remarks",
          remarks: prev.remarks ?? "",
          done: false,
          completedAt: undefined,
        };
      }
      return {
        ...prev,
        label: def.label,
        kind,
      };
    }
    return stepFromDef(def);
  });
}

export function needsModuleWorkflowUpgrade(module: CrmProductModule): boolean {
  if (!module.enabled || module.key === "sales-crm") return false;
  const template = getModuleWorkflowTemplate(module.key);
  if (!template?.length) return false;
  if (!module.workflow?.length) return true;
  const templateKeys = new Set(template.map((s) => s.key));
  const existingKeys = new Set(module.workflow.map((s) => s.key));
  if (template.some((s) => !existingKeys.has(s.key))) return true;
  if (module.workflow.some((s) => !templateKeys.has(s.key))) return true;
  return template.some((s, i) => module.workflow?.[i]?.key !== s.key);
}

export function calcModuleWorkflowProgress(module: CrmProductModule): number {
  const steps = module.workflow ?? [];
  if (steps.length === 0) return 0;
  if (module.key === "cp-application") {
    return calcCpApplicationWorkflowProgress(steps);
  }
  const counted = getWorkflowProgressSteps(steps);
  if (counted.length === 0) return 0;
  const done = counted.filter(isModuleWorkflowStepComplete).length;
  return Math.round((done / counted.length) * 100);
}

/** Enabled integration modules workflow completion (100 when none opted). */
export function calcIntegrationsTabProgress(record: CrmOnboardingRecord): number {
  const integrations = record.productModules.filter(
    (m) => m.enabled && isCrmIntegrationModule(m.key),
  );
  if (integrations.length === 0) return 100;
  const sum = integrations.reduce((acc, m) => acc + calcModuleWorkflowProgress(m), 0);
  return Math.round(sum / integrations.length);
}

export function calcTrainingTabProgress(record: CrmOnboardingRecord): number {
  const applicable = record.trainingSessions.filter((s) => !s.notApplicable);
  if (applicable.length === 0) return 100;
  const done = applicable.filter((s) => s.completed || (s.sessionCount ?? 0) > 0).length;
  return Math.round((done / applicable.length) * 100);
}

export function calcReportsTabProgress(record: CrmOnboardingRecord): number {
  const applicable = record.reportChecklist.filter((r) => !r.notApplicable);
  if (applicable.length === 0) return 100;
  const done = applicable.filter((r) => r.status === "explained").length;
  return Math.round((done / applicable.length) * 100);
}

const GO_LIVE_TAB_SYNC_KEYS: Record<
  "masters" | "data_migration" | "integrations" | "training" | "reports",
  (record: CrmOnboardingRecord) => boolean
> = {
  masters: (record) => calcChecklistProgress(record.masterChecklist) >= 100,
  data_migration: (record) => calcChecklistProgress(record.migrationChecklist) >= 100,
  integrations: (record) => calcIntegrationsTabProgress(record) >= 100,
  training: (record) => calcTrainingTabProgress(record) >= 100,
  reports: (record) => calcReportsTabProgress(record) >= 100,
};

export function isGoLiveTabSyncedItem(key: string): key is keyof typeof GO_LIVE_TAB_SYNC_KEYS {
  return key in GO_LIVE_TAB_SYNC_KEYS;
}

/** Keep Go-Live readiness rows aligned with Masters / Migration / Integrations / Training / Reports tabs. */
export function syncGoLiveChecklistFromTabs(record: CrmOnboardingRecord): CrmOnboardingRecord {
  const today = new Date().toISOString().slice(0, 10);
  let changed = false;

  const goLiveChecklist = record.goLiveChecklist.map((item) => {
    const isTabSynced = item.key in GO_LIVE_TAB_SYNC_KEYS;
    if (!isTabSynced) return item;
    if (item.notApplicable) return item;

    const complete = GO_LIVE_TAB_SYNC_KEYS[item.key as keyof typeof GO_LIVE_TAB_SYNC_KEYS](record);

    if (complete) {
      if (item.status === "completed" && item.completedAt) return item;
      changed = true;
      return {
        ...item,
        status: "completed" as const,
        completedAt: item.completedAt ?? today,
      };
    }

    if (item.status === "completed") {
      changed = true;
      return { ...item, status: "pending" as const, completedAt: undefined };
    }

    return item;
  });

  if (!changed) return record;
  return { ...record, goLiveChecklist };
}

const DEFAULT_SOURCE_VALUES = [
  "Website",
  "Meta Ads",
  "Google Ads",
  "99acres",
  "MagicBricks",
  "Referral",
  "Walk-in",
  "Channel Partner",
];
const DEFAULT_STATUS_VALUES = [
  "New",
  "Contacted",
  "Qualified",
  "Site Visit",
  "Negotiation",
  "Booked",
  "Lost",
];
const DEFAULT_FOLLOWUP_VALUES = ["Call", "WhatsApp", "Email", "Site Visit", "Meeting"];

function dictFromValues(values: string[]): CrmMasterDictItem[] {
  const now = nowIso();
  return values.map((value, i) => ({
    id: newId(),
    value,
    active: true,
    sortOrder: i + 1,
    createdAt: now,
    updatedAt: now,
  }));
}

export function defaultMasterData() {
  return {
    masterProjects: [] as CrmAccountProject[],
    masterSources: dictFromValues(DEFAULT_SOURCE_VALUES),
    masterStatuses: dictFromValues(DEFAULT_STATUS_VALUES),
    masterFollowUps: dictFromValues(DEFAULT_FOLLOWUP_VALUES),
    masterTeams: [] as CrmMasterTeam[],
  };
}

export function ensureMasterDataFields(
  record: CrmOnboardingRecord,
): Pick<
  CrmOnboardingRecord,
  "masterProjects" | "masterSources" | "masterStatuses" | "masterFollowUps" | "masterTeams"
> {
  return {
    masterProjects: record.masterProjects ?? [],
    masterSources: record.masterSources?.length
      ? record.masterSources
      : dictFromValues(DEFAULT_SOURCE_VALUES),
    masterStatuses: record.masterStatuses?.length
      ? record.masterStatuses
      : dictFromValues(DEFAULT_STATUS_VALUES),
    masterFollowUps: record.masterFollowUps?.length
      ? record.masterFollowUps
      : dictFromValues(DEFAULT_FOLLOWUP_VALUES),
    masterTeams: record.masterTeams ?? [],
  };
}

/** Core CRM product modules (not third-party integrations). */
export const CRM_CORE_MODULES: { key: CrmProductModuleKey; label: string }[] = [
  { key: "sales-crm", label: "Sales CRM" },
  { key: "cp-application", label: "CP Application" },
  { key: "reception-application", label: "Reception Application" },
  { key: "sim-call-recording", label: "Sim Based Calling" },
  { key: "ai-call-analysis", label: "AI Call Analysis" },
  { key: "waha", label: "WAHA" },
  { key: "auto-dialer", label: "Auto Dialer" },
];

/** Third-party / channel integrations. */
export const CRM_INTEGRATION_MODULES: { key: CrmProductModuleKey; label: string }[] = [
  { key: "whatsapp-integration", label: "WhatsApp Integration" },
  { key: "sms-integration", label: "SMS Integration" },
  { key: "email-integration", label: "Email Integration" },
  { key: "ivr-integration", label: "IVR Integration" },
  { key: "meta-lead-integration", label: "Meta Lead Integration" },
  { key: "google-ads-integration", label: "Google Ads Integration" },
  { key: "website-integration", label: "Website Integration" },
  { key: "99acres-integration", label: "99acres Integration" },
  { key: "magicbricks-integration", label: "MagicBricks Integration" },
  { key: "housing-integration", label: "Housing Integration" },
];

export const CRM_PRODUCT_MODULES: { key: CrmProductModuleKey; label: string }[] = [
  ...CRM_CORE_MODULES,
  ...CRM_INTEGRATION_MODULES,
];

const CRM_INTEGRATION_KEY_SET = new Set(CRM_INTEGRATION_MODULES.map((m) => m.key));

export function isCrmIntegrationModule(key: CrmProductModuleKey | string): boolean {
  return CRM_INTEGRATION_KEY_SET.has(key as CrmProductModuleKey);
}

export function isCrmCoreModule(key: CrmProductModuleKey | string): boolean {
  return !isCrmIntegrationModule(key);
}

export const CRM_MASTER_CHECKLIST_LABELS: { key: string; label: string }[] = [
  { key: "company_master", label: "Company Master Created" },
  { key: "user_creation", label: "User Creation" },
  { key: "team_creation", label: "Team Creation" },
  { key: "role_definition", label: "Role Definition" },
  { key: "permissions_assigned", label: "Permissions Assigned" },
  { key: "lead_permissions", label: "Lead Permissions" },
  { key: "contact_permissions", label: "Contact Permissions" },
  { key: "cp_permissions", label: "CP Permissions" },
  { key: "inventory_permissions", label: "Inventory Permissions" },
  { key: "booking_permissions", label: "Booking Permissions" },
  { key: "lead_distribution", label: "Lead Distribution Rules Configured" },
  { key: "source_masters", label: "Source Masters Configured" },
  { key: "status_masters", label: "Stage Masters Configured" },
  { key: "followup_masters", label: "Follow-up Masters Configured" },
  { key: "templates", label: "Templates Configured" },
];

export const CRM_MIGRATION_CHECKLIST_LABELS: {
  key: string;
  label: string;
  category: string;
}[] = [
  { key: "lead_data", label: "Lead Data", category: "CRM data" },
  { key: "contact_data", label: "Contact Data", category: "CRM data" },
  { key: "cp_data", label: "Channel Partner Data", category: "CRM data" },
  { key: "inventory", label: "Project", category: "Project and property" },
  { key: "unit_data", label: "Property", category: "Project and property" },
];

export const CRM_MIGRATION_CATEGORIES = ["CRM data", "Project and property"] as const;

export function seedCrmMigrationFields() {
  return CRM_MIGRATION_CHECKLIST_LABELS.map((f) => ({ ...f }));
}
export const CRM_REPORT_CHECKLIST_LABELS: {
  key: string;
  label: string;
  category: string;
}[] = [
  // Analysis
  { key: "advance_analysis", label: "Advance Analysis", category: "Analysis" },
  { key: "agent_analysis", label: "Agent Analysis", category: "Analysis" },
  { key: "stage_vs_source", label: "Stage vs Source", category: "Analysis" },
  { key: "lead_stage_history", label: "Lead Stage History", category: "Analysis" },
  { key: "qualified_stage", label: "Qualified Stage", category: "Analysis" },
  { key: "cp_activity", label: "CP Activity", category: "Analysis" },
  // Calls
  { key: "call_analysis", label: "Call Analysis", category: "Calls" },
  { key: "offline_calls", label: "Offline Calls", category: "Calls" },
  { key: "virtual_calls", label: "Virtual Calls", category: "Calls" },
  // Operations
  { key: "attendance", label: "Attendance", category: "Operations" },
  { key: "tracking", label: "Tracking", category: "Operations" },
  { key: "communication_logs", label: "Communication Logs", category: "Operations" },
  { key: "manager_dashboard", label: "Manager Dashboard", category: "Dashboards" },
  { key: "owner_dashboard", label: "Owner Dashboard", category: "Dashboards" },
];

export const CRM_REPORT_CATEGORIES = [
  "Analysis",
  "Calls",
  "Operations",
  "Dashboards",
] as const;
export const CRM_GO_LIVE_CHECKLIST_LABELS: {
  key: string;
  label: string;
  category: string;
}[] = [
  { key: "masters", label: "Masters Completed", category: "Readiness" },
  { key: "data_migration", label: "Data Migration Completed", category: "Readiness" },
  { key: "integrations", label: "Integrations Completed", category: "Readiness" },
  { key: "training", label: "Training Completed", category: "Readiness" },
  { key: "reports", label: "Reports Explained", category: "Readiness" },
  { key: "templates_tested", label: "Offline Templates Tested", category: "Verification" },
  { key: "whatsapp_templates", label: "WhatsApp Templates Verified", category: "Verification" },
  { key: "sms_tested", label: "SMS Tested", category: "Verification" },
  { key: "email_templates", label: "Email Templates Tested", category: "Verification" },
  { key: "uat", label: "User Acceptance Completed", category: "Sign-off" },
  { key: "client_signoff", label: "Client Sign-Off Received", category: "Sign-off" },
  { key: "go_live_approved", label: "Go-Live Approved", category: "Sign-off" },
  { key: "credentials_shared", label: "Live Credentials Shared", category: "Handover" },
  { key: "support_handover", label: "Support Handover Done", category: "Handover" },
  { key: "success_kickoff", label: "Customer Success Kickoff", category: "Handover" },
];

export const CRM_GO_LIVE_CATEGORIES = [
  "Readiness",
  "Verification",
  "Sign-off",
  "Handover",
] as const;

/** Go-live verification rows shown only when the linked integration is opted in. */
export const CRM_GO_LIVE_INTEGRATION_REQUIREMENTS: Partial<
  Record<string, CrmProductModuleKey>
> = {
  whatsapp_templates: "whatsapp-integration",
  sms_tested: "sms-integration",
  email_templates: "email-integration",
};

export function isCrmIntegrationOptedIn(
  record: CrmOnboardingRecord,
  integrationKey: CrmProductModuleKey,
): boolean {
  return record.productModules.some((m) => m.key === integrationKey && m.enabled);
}

export function isCrmGoLiveItemVisible(
  record: CrmOnboardingRecord,
  itemKey: string,
): boolean {
  const requiredIntegration = CRM_GO_LIVE_INTEGRATION_REQUIREMENTS[itemKey];
  if (!requiredIntegration) return true;
  return isCrmIntegrationOptedIn(record, requiredIntegration);
}

export function getApplicableGoLiveChecklist(
  record: CrmOnboardingRecord,
): CrmGoLiveChecklistItem[] {
  return record.goLiveChecklist.filter((item) => isCrmGoLiveItemVisible(record, item.key));
}

export const CRM_DEVELOPER_TRAINING: { key: string; label: string; category: string }[] = [
  { key: "admin", label: "Admin Training", category: "Admin" },
  { key: "sourcing_manager", label: "Sourcing Manager Training", category: "Sales roles" },
  { key: "sales_executive", label: "Sales Executive Training", category: "Sales roles" },
  { key: "sales_manager", label: "Sales Manager Training", category: "Sales roles" },
  { key: "pre_sales", label: "Pre-Sales Training", category: "Front office" },
  { key: "reception", label: "Reception Training", category: "Front office" },
  { key: "cp_application", label: "CP Application Training", category: "Product modules" },
  { key: "inventory", label: "Inventory Training", category: "Product modules" },
  { key: "booking", label: "Booking Training", category: "Product modules" },
  { key: "collections", label: "Collections Training", category: "Product modules" },
  { key: "whatsapp_sms", label: "WhatsApp / SMS Training", category: "Integrations" },
  { key: "lead_integrations", label: "Lead Integration Training", category: "Integrations" },
];

export const CRM_BROKER_CP_TRAINING: { key: string; label: string; category: string }[] = [
  { key: "admin", label: "Admin Training", category: "Admin" },
  { key: "sales_agent", label: "Sales Agent Training", category: "Sales process" },
  { key: "followup_process", label: "Follow-up Process", category: "Sales process" },
  { key: "lead_management", label: "Lead Management", category: "Sales process" },
  { key: "site_visit_process", label: "Site Visit Process", category: "Sales process" },
  { key: "booking_process", label: "Booking Process", category: "Operations" },
  { key: "mobile_app", label: "Mobile App Training", category: "Product" },
];

export const CRM_TRAINING_CATEGORIES_DEVELOPER = [
  "Admin",
  "Sales roles",
  "Front office",
  "Product modules",
  "Integrations",
  "Custom",
] as const;

export const CRM_TRAINING_CATEGORIES_BROKER = [
  "Admin",
  "Sales process",
  "Operations",
  "Product",
  "Custom",
] as const;

export type CrmTrainingTrack = "developer" | "broker_cp";

export function seedCrmTrainingFields(track: CrmTrainingTrack = "developer") {
  const templates = track === "broker_cp" ? CRM_BROKER_CP_TRAINING : CRM_DEVELOPER_TRAINING;
  return templates.map((f) => ({ ...f }));
}
export const CRM_COMM_ACTIONS: { key: CrmCommActionKey; label: string }[] = [
  { key: "welcome", label: "Send Welcome Message" },
  { key: "login_credentials", label: "Send Login Credentials" },
  { key: "training_schedule", label: "Send Training Schedule" },
  { key: "meeting_reminder", label: "Send Meeting Reminder" },
  { key: "demand_letter", label: "Send Demand Letter" },
  { key: "receipt", label: "Send Receipt" },
  { key: "pending_activity", label: "Send Pending Activity Reminder" },
  { key: "go_live_confirmation", label: "Send Go-Live Confirmation" },
];

export const CRM_STAGE_LABELS: Record<string, string> = {
  company_creation: "Company Creation",
  module_selection: "Module Selection",
  master_creation: "Master Creation",
  data_migration: "Data Migration",
  integration_setup: "Integration Setup",
  training: "Training",
  report_explanation: "Report Explanation",
  uat: "UAT",
  client_signoff: "Client Sign-Off",
  go_live: "Go-Live",
  ticket_support: "Ticket Support",
  customer_success: "Customer Success",
};

function defaultProductModules(
  catalog: { key: CrmProductModuleKey; label: string }[] = CRM_PRODUCT_MODULES,
): CrmProductModule[] {
  return catalog.map((m) => ({ ...m, enabled: false }));
}

/** Append newly catalogued modules onto existing account records (disabled by default). */
export function mergeCrmProductModules(
  existing: CrmProductModule[],
  catalog: { key: CrmProductModuleKey; label: string }[] = CRM_PRODUCT_MODULES,
): CrmProductModule[] {
  const byKey = new Map(existing.map((m) => [m.key, m]));
  return catalog.map((def) => {
    const prev = byKey.get(def.key);
    if (!prev) {
      return { key: def.key, label: def.label, enabled: false };
    }
    return {
      ...prev,
      key: def.key,
      label: def.label,
      enabled: !!prev.enabled,
      provider: prev.provider,
      workflow: prev.workflow,
    };
  });
}

export function needsProductModulesUpgrade(
  existing: CrmProductModule[] | undefined,
  catalog: { key: CrmProductModuleKey; label: string }[] = CRM_PRODUCT_MODULES,
): boolean {
  if (!Array.isArray(existing) || existing.length === 0) return true;
  const keys = new Set(existing.map((m) => m.key));
  const catalogKeys = new Set(catalog.map((m) => m.key));
  if (existing.some((m) => !catalogKeys.has(m.key))) return true;
  if (catalog.some((m) => !keys.has(m.key))) return true;
  const byKey = new Map(existing.map((m) => [m.key, m]));
  return catalog.some((def) => byKey.get(def.key)?.label !== def.label);
}

function defaultMasterChecklist(): CrmMasterChecklistItem[] {
  return CRM_MASTER_CHECKLIST_LABELS.map((m) => ({
    ...m,
    collected: false,
    uploaded: false,
    live: false,
    notApplicable: false,
    remarks: "",
  }));
}

/** Upgrade legacy pending/completed master rows to Checklist Detail phases. */
export function normalizeCrmMasterItem(
  item: CrmMasterChecklistItem & { status?: string; completedAt?: string },
): CrmMasterChecklistItem {
  const legacyStatus = (item as { status?: string }).status;
  const legacyDone = legacyStatus === "completed";
  const hasPhases =
    typeof item.collected === "boolean" ||
    typeof item.uploaded === "boolean" ||
    typeof item.live === "boolean";

  if (hasPhases) {
    return {
      key: item.key,
      label: item.label,
      collected: !!item.collected,
      uploaded: !!item.uploaded,
      live: !!item.live,
      collectedAt: item.collectedAt,
      uploadedAt: item.uploadedAt,
      liveAt: item.liveAt,
      notApplicable: !!item.notApplicable,
      remarks: item.remarks ?? "",
      assigneeUserId: item.assigneeUserId,
      dueDate: item.dueDate,
    };
  }

  const stamp = (item as { completedAt?: string }).completedAt;
  return {
    key: item.key,
    label: item.label,
    collected: legacyDone,
    uploaded: legacyDone,
    live: legacyDone,
    collectedAt: stamp,
    uploadedAt: stamp,
    liveAt: stamp,
    notApplicable: false,
    remarks: "",
    assigneeUserId: item.assigneeUserId,
    dueDate: item.dueDate,
  };
}

export function normalizeCrmMasterChecklist(
  items: Array<CrmMasterChecklistItem & { status?: string; completedAt?: string }>,
): CrmMasterChecklistItem[] {
  return items.map(normalizeCrmMasterItem);
}

/** Sync master checklist rows to the current catalog (drops removed keys, adds new ones). */
export function mergeCrmMasterChecklist(
  existing: Array<CrmMasterChecklistItem & { status?: string; completedAt?: string }>,
  catalog: typeof CRM_MASTER_CHECKLIST_LABELS = CRM_MASTER_CHECKLIST_LABELS,
): CrmMasterChecklistItem[] {
  const byKey = new Map(existing.map((item) => [item.key, item]));
  return catalog.map((def) => {
    const prev = byKey.get(def.key);
    if (!prev) {
      return {
        key: def.key,
        label: def.label,
        collected: false,
        uploaded: false,
        live: false,
        notApplicable: false,
        remarks: "",
      };
    }
    return normalizeCrmMasterItem({ ...prev, key: def.key, label: def.label });
  });
}

export function needsMasterChecklistUpgrade(
  existing: CrmMasterChecklistItem[] | undefined,
  catalog: typeof CRM_MASTER_CHECKLIST_LABELS = CRM_MASTER_CHECKLIST_LABELS,
): boolean {
  if (!Array.isArray(existing)) return true;
  const catalogKeys = new Set(catalog.map((d) => d.key));
  if (existing.some((i) => !catalogKeys.has(i.key))) return true;
  if (existing.length !== catalog.length) return true;
  const byKey = new Map(existing.map((i) => [i.key, i]));
  return catalog.some((def) => byKey.get(def.key)?.label !== def.label);
}

function defaultMigrationChecklist(
  catalog: typeof CRM_MIGRATION_CHECKLIST_LABELS = CRM_MIGRATION_CHECKLIST_LABELS,
): CrmMigrationChecklistItem[] {
  return catalog.map((m) => ({
    key: m.key,
    label: m.label,
    category: m.category,
    collected: false,
    uploaded: false,
    live: false,
    notApplicable: false,
    remarks: "",
    sourceFile: "",
    recordCount: undefined,
    uploadAttempts: 0,
  }));
}

/** Upgrade legacy pending/in_progress/completed migration rows + merge catalog keys. */
export function mergeCrmMigrationChecklist(
  existing: Array<
    Partial<CrmMigrationChecklistItem> & {
      key: string;
      label?: string;
      status?: string;
    }
  >,
  catalog: typeof CRM_MIGRATION_CHECKLIST_LABELS = CRM_MIGRATION_CHECKLIST_LABELS,
): CrmMigrationChecklistItem[] {
  const byKey = new Map(existing.map((item) => [item.key, item]));
  return catalog.map((def) => {
    const prev = byKey.get(def.key);
    if (!prev) {
      return {
        key: def.key,
        label: def.label,
        category: def.category,
        collected: false,
        uploaded: false,
        live: false,
        notApplicable: false,
        remarks: "",
        sourceFile: "",
        uploadAttempts: 0,
      };
    }

    const hasPhases = typeof prev.collected === "boolean";
    const legacyStatus = prev.status;
    const legacyDone = legacyStatus === "completed";
    const legacyInProgress = legacyStatus === "in_progress";

    const collected = hasPhases ? !!prev.collected : legacyDone || legacyInProgress;
    const uploaded = hasPhases ? !!prev.uploaded : legacyDone;
    const live = hasPhases ? !!prev.live : legacyDone;
    const stamp = prev.completedAt;

    return {
      key: def.key,
      label: def.label,
      category: def.category,
      collected,
      uploaded,
      live,
      collectedAt: prev.collectedAt ?? (collected ? stamp : undefined),
      uploadedAt: prev.uploadedAt ?? (uploaded ? stamp : undefined),
      liveAt: prev.liveAt ?? (live ? stamp : undefined),
      notApplicable: !!prev.notApplicable,
      remarks: prev.remarks ?? prev.notes ?? "",
      assigneeUserId: prev.assigneeUserId,
      dueDate: prev.dueDate,
      sourceFile: prev.sourceFile ?? "",
      recordCount: prev.recordCount,
      uploadAttempts:
        typeof prev.uploadAttempts === "number"
          ? prev.uploadAttempts
          : uploaded || live
            ? 1
            : 0,
    };
  });
}

function defaultReportChecklist(): CrmReportChecklistItem[] {
  return CRM_REPORT_CHECKLIST_LABELS.map((m) => ({
    key: m.key,
    label: m.label,
    category: m.category,
    status: "pending" as const,
    explanationCount: 0,
    notes: "",
    explanationLog: [],
    notApplicable: false,
  }));
}

/** Sync report checklist rows to the current catalog (drops removed keys, adds new ones). */
export function needsReportChecklistUpgrade(
  existing: CrmReportChecklistItem[] | undefined,
  catalog: typeof CRM_REPORT_CHECKLIST_LABELS = CRM_REPORT_CHECKLIST_LABELS,
): boolean {
  if (!Array.isArray(existing)) return true;
  if (existing.some((i) => typeof i.explanationCount !== "number")) return true;
  const catalogKeys = new Set(catalog.map((d) => d.key));
  if (existing.some((i) => !catalogKeys.has(i.key))) return true;
  if (existing.length !== catalog.length) return true;
  const byKey = new Map(existing.map((i) => [i.key, i]));
  return catalog.some((def) => byKey.get(def.key)?.label !== def.label);
}

/** Merge catalog + normalize counters so new report types appear on existing accounts. */
export function mergeCrmReportChecklist(
  existing: Array<
    Partial<CrmReportChecklistItem> & { key: string; label?: string; status?: CrmReportStatus }
  >,
): CrmReportChecklistItem[] {
  const byKey = new Map(existing.map((item) => [item.key, item]));
  return CRM_REPORT_CHECKLIST_LABELS.map((def) => {
    const prev = byKey.get(def.key);
    if (!prev) {
      return {
        key: def.key,
        label: def.label,
        category: def.category,
        status: "pending" as const,
        explanationCount: 0,
        notes: "",
        explanationLog: [],
        notApplicable: false,
      };
    }
    const count =
      typeof prev.explanationCount === "number"
        ? prev.explanationCount
        : prev.status === "explained"
          ? Math.max(1, prev.explanationLog?.length ?? 1)
          : 0;
    return {
      key: def.key,
      label: def.label,
      category: def.category,
      status: count > 0 ? ("explained" as const) : ("pending" as const),
      explanationCount: count,
      explainedAt: prev.explainedAt,
      trainerName: prev.trainerName,
      notes: prev.notes ?? "",
      explanationLog: prev.explanationLog ?? [],
      notApplicable: !!prev.notApplicable,
    };
  });
}

function defaultGoLiveChecklist(): CrmGoLiveChecklistItem[] {
  return CRM_GO_LIVE_CHECKLIST_LABELS.map((m) => ({
    key: m.key,
    label: m.label,
    category: m.category,
    status: "pending" as const,
    notApplicable: false,
    remarks: "",
  }));
}

export function mergeCrmGoLiveChecklist(
  existing: Array<Partial<CrmGoLiveChecklistItem> & { key: string; label?: string }>,
): CrmGoLiveChecklistItem[] {
  const byKey = new Map(existing.map((item) => [item.key, item]));
  return CRM_GO_LIVE_CHECKLIST_LABELS.map((def) => {
    const prev = byKey.get(def.key);
    if (!prev) {
      return {
        key: def.key,
        label: def.label,
        category: def.category,
        status: "pending" as const,
        notApplicable: false,
        remarks: "",
      };
    }
    return {
      key: def.key,
      label: def.label,
      category: def.category,
      status: prev.status === "completed" ? ("completed" as const) : ("pending" as const),
      completedAt: prev.completedAt,
      notApplicable: !!prev.notApplicable,
      remarks: prev.remarks ?? "",
      assigneeUserId: prev.assigneeUserId,
      dueDate: prev.dueDate,
    };
  });
}

export function isCrmGoLiveItemComplete(item: CrmGoLiveChecklistItem) {
  if (item.notApplicable) return true;
  return item.status === "completed" && Boolean(item.completedAt?.trim());
}

export function isDeveloperCompanyType(type?: CompanyType): boolean {
  return type === "Real Estate Developer" || type === "Mandate" || type === "CT" || !type;
}

export function defaultTrainingSessions(
  companyType?: CompanyType,
  catalog?: { key: string; label: string; category: string }[],
): CrmTrainingSession[] {
  const now = nowIso();
  const track = isDeveloperCompanyType(companyType) ? "developer" : "broker_cp";
  const templates =
    catalog ?? (track === "developer" ? CRM_DEVELOPER_TRAINING : CRM_BROKER_CP_TRAINING);
  return templates.map((t) => ({
    id: newId(),
    templateKey: t.key,
    label: t.label,
    track,
    category: t.category,
    trainerName: "",
    trainingDate: "",
    durationHours: 0,
    attendance: "",
    recordingUploaded: false,
    completed: false,
    sessionCount: 0,
    sessionLog: [],
    notes: "",
    createdAt: now,
    updatedAt: now,
  }));
}

/** Merge catalog templates + normalize session counters for existing accounts. */
export function mergeCrmTrainingSessions(
  existing: Array<Partial<CrmTrainingSession> & { id: string; templateKey: string; label: string }>,
  companyType?: CompanyType,
  catalog?: { key: string; label: string; category: string }[],
): CrmTrainingSession[] {
  const now = nowIso();
  const track = isDeveloperCompanyType(companyType) ? "developer" : "broker_cp";
  const templates =
    catalog ?? (track === "developer" ? CRM_DEVELOPER_TRAINING : CRM_BROKER_CP_TRAINING);
  const byTemplate = new Map(existing.map((s) => [s.templateKey, s]));
  const custom = existing.filter((s) => s.templateKey.startsWith("custom-"));

  const merged = templates.map((t) => {
    const prev = byTemplate.get(t.key);
    if (!prev) {
      return {
        id: newId(),
        templateKey: t.key,
        label: t.label,
        track: track as "developer" | "broker_cp",
        category: t.category,
        trainerName: "",
        trainingDate: "",
        durationHours: 0,
        attendance: "",
        recordingUploaded: false,
        completed: false,
        sessionCount: 0,
        sessionLog: [],
        notes: "",
        createdAt: now,
        updatedAt: now,
      } satisfies CrmTrainingSession;
    }
    const count =
      typeof prev.sessionCount === "number"
        ? prev.sessionCount
        : prev.completed
          ? Math.max(1, prev.sessionLog?.length ?? 1)
          : 0;
    return {
      id: prev.id,
      templateKey: t.key,
      label: t.label,
      track: (prev.track as "developer" | "broker_cp") || track,
      category: t.category,
      trainerName: prev.trainerName ?? "",
      trainingDate: prev.trainingDate ?? "",
      durationHours: prev.durationHours ?? 0,
      attendance: prev.attendance ?? "",
      recordingUploaded: !!prev.recordingUploaded,
      completed: count > 0 ? true : !!prev.completed,
      sessionCount: count,
      sessionLog: prev.sessionLog ?? [],
      notes: prev.notes ?? "",
      assigneeUserId: prev.assigneeUserId,
      dueDate: prev.dueDate,
      notApplicable: !!prev.notApplicable,
      createdAt: prev.createdAt ?? now,
      updatedAt: prev.updatedAt ?? now,
    } satisfies CrmTrainingSession;
  });

  const customNormalized = custom.map((prev) => {
    const count =
      typeof prev.sessionCount === "number"
        ? prev.sessionCount
        : prev.completed
          ? Math.max(1, prev.sessionLog?.length ?? 1)
          : 0;
    return {
      id: prev.id,
      templateKey: prev.templateKey,
      label: prev.label,
      track: (prev.track as "developer" | "broker_cp") || track,
      category: prev.category ?? "Custom",
      trainerName: prev.trainerName ?? "",
      trainingDate: prev.trainingDate ?? "",
      durationHours: prev.durationHours ?? 0,
      attendance: prev.attendance ?? "",
      recordingUploaded: !!prev.recordingUploaded,
      completed: count > 0 ? true : !!prev.completed,
      sessionCount: count,
      sessionLog: prev.sessionLog ?? [],
      notes: prev.notes ?? "",
      assigneeUserId: prev.assigneeUserId,
      dueDate: prev.dueDate,
      notApplicable: !!prev.notApplicable,
      createdAt: prev.createdAt ?? now,
      updatedAt: prev.updatedAt ?? now,
    } satisfies CrmTrainingSession;
  });

  return [...merged, ...customNormalized];
}

export function createCrmOnboardingRecord(
  companyId: string,
  companyType?: CompanyType,
  migrationCatalog: typeof CRM_MIGRATION_CHECKLIST_LABELS = CRM_MIGRATION_CHECKLIST_LABELS,
  trainingCatalog?: { key: string; label: string; category: string }[],
  productModuleCatalog: { key: CrmProductModuleKey; label: string }[] = CRM_PRODUCT_MODULES,
): CrmOnboardingRecord {
  const now = nowIso();
  return {
    id: newId(),
    companyId,
    companyTypeHint: companyType,
    productModules: defaultProductModules(productModuleCatalog),
    masterChecklist: defaultMasterChecklist(),
    ...defaultMasterData(),
    migrationChecklist: defaultMigrationChecklist(migrationCatalog),
    trainingSessions: defaultTrainingSessions(companyType, trainingCatalog),
    reportChecklist: defaultReportChecklist(),
    goLiveChecklist: defaultGoLiveChecklist(),
    tracker: {
      stage: "company_creation",
      priority: "medium",
    },
    commLog: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function isSalesCrmModuleEnabled(record: CrmOnboardingRecord): boolean {
  return record.productModules.some((m) => m.key === "sales-crm" && m.enabled);
}

/** Sales CRM progress from Integrations, Masters, Migration, Training, and Reports. */
export function calcSalesCrmModuleProgress(record: CrmOnboardingRecord): number {
  if (!isSalesCrmModuleEnabled(record)) return 0;
  const sections = [
    calcIntegrationsTabProgress(record),
    calcChecklistProgress(record.masterChecklist),
    calcChecklistProgress(record.migrationChecklist),
    calcTrainingTabProgress(record),
    calcReportsTabProgress(record),
  ];
  return Math.round(sections.reduce((a, b) => a + b, 0) / sections.length);
}

/** Whether a subscribed module has completed its onboarding workflow / sections. */
export function isModuleGoLiveReady(
  module: CrmProductModule,
  record: CrmOnboardingRecord,
): boolean {
  if (!module.enabled) return false;
  if (module.key === "sales-crm") {
    return calcSalesCrmModuleProgress(record) >= 100;
  }
  return calcModuleWorkflowProgress(module) >= 100;
}

/** Progress for a single subscribed module (0 when disabled). */
export function calcProductModuleProgress(
  module: CrmProductModule,
  record: CrmOnboardingRecord,
): number {
  if (!module.enabled) return 0;
  if (module.key === "sales-crm") {
    return calcSalesCrmModuleProgress(record);
  }
  return calcModuleWorkflowProgress(module);
}

/** Each non–Sales CRM core module contributes this share of overall account progress. */
export const CRM_OTHER_MODULE_PROGRESS_WEIGHT = 10;

/** Weighted progress share (0–100) per enabled core module for overall account completion. */
export function getCrmModuleProgressWeights(
  enabledCoreModules: CrmProductModule[],
): Map<CrmProductModuleKey, number> {
  const weights = new Map<CrmProductModuleKey, number>();
  const salesCrm = enabledCoreModules.find((m) => m.key === "sales-crm");
  const others = enabledCoreModules.filter((m) => m.key !== "sales-crm");

  if (salesCrm) {
    weights.set(
      "sales-crm",
      Math.max(0, 100 - CRM_OTHER_MODULE_PROGRESS_WEIGHT * others.length),
    );
    for (const module of others) {
      weights.set(module.key, CRM_OTHER_MODULE_PROGRESS_WEIGHT);
    }
    return weights;
  }

  if (enabledCoreModules.length === 0) return weights;

  const equalWeight = 100 / enabledCoreModules.length;
  for (const module of enabledCoreModules) {
    weights.set(module.key, equalWeight);
  }
  return weights;
}

/**
 * Overall account progress — weighted by opted modules.
 * Sales CRM holds the remainder after 10% per other core module (e.g. 90% with one other, 80% with two).
 * Integrations roll into Sales CRM progress, not overall weights.
 */
export function calcCrmOnboardingProgress(record: CrmOnboardingRecord): number {
  const enabled = record.productModules.filter(
    (m) => m.enabled && !isCrmIntegrationModule(m.key),
  );
  if (enabled.length === 0) return 0;

  const weights = getCrmModuleProgressWeights(enabled);
  const weighted = enabled.reduce((acc, module) => {
    const weight = weights.get(module.key) ?? 0;
    const progress = calcProductModuleProgress(module, record);
    return acc + (progress * weight) / 100;
  }, 0);

  return Math.round(weighted);
}

export function crmPendingActivityCount(record: CrmOnboardingRecord): number {
  let count = 0;

  if (isSalesCrmModuleEnabled(record)) {
    count +=
      record.masterChecklist.filter((m) => !isChecklistItemComplete(m)).length +
      record.migrationChecklist.filter((m) => !isChecklistItemComplete(m)).length +
      record.trainingSessions.filter(
        (s) => !s.notApplicable && !s.completed && !(s.sessionCount > 0),
      ).length +
      record.reportChecklist.filter((r) => !r.notApplicable && r.status !== "explained").length;
  }

  count += record.productModules
    .filter((m) => m.enabled && moduleHasWorkflow(m.key))
    .flatMap((m) => {
      const steps = m.workflow ?? [];
      if (m.key === "cp-application") {
        return getVisibleCpApplicationSteps(steps).filter((s) => s.kind !== "remarks");
      }
      return getWorkflowProgressSteps(steps);
    })
    .filter((s) => !isModuleWorkflowStepComplete(s)).length;

  count += getApplicableGoLiveChecklist(record).filter((g) => !isCrmGoLiveItemComplete(g)).length;

  return count;
}

export function crmGoLiveReady(record: CrmOnboardingRecord): boolean {
  const applicable = getApplicableGoLiveChecklist(record);
  if (!applicable.length) return true;
  return applicable.every((g) => isCrmGoLiveItemComplete(g));
}
