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
  "ivr-integration": ["Exotel", "Knowlarity", "MyOperator", "Servetel", "Ozonetel"],
  "meta-lead-integration": ["Meta Business Suite", "LeadsBridge", "Zapier"],
  "google-ads-integration": ["Google Ads API", "Google Tag Manager", "Zapier", "Manual Sync"],
  "website-integration": ["Webhook", "Zapier", "WordPress", "Custom Form API", "Manual Sync"],
  "99acres-integration": ["99acres API", "Manual Sync"],
  "magicbricks-integration": ["MagicBricks API", "Manual Sync"],
  "housing-integration": ["Housing API", "Manual Sync"],
  "sim-call-recording": ["Knowlarity", "Exotel", "MyOperator", "Servetel", "Ozonetel", "Custom SIM Gateway"],
  waha: ["WAHA Self-hosted", "WAHA Cloud", "Custom"],
  "auto-dialer": ["Exotel", "Knowlarity", "Ozonetel", "Servetel", "MyOperator"],
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

const GENERIC_MODULE_WORKFLOW: { key: string; label: string }[] = [
  { key: "requirement", label: "Requirement gathering" },
  { key: "configuration", label: "Configuration" },
  { key: "uat", label: "UAT / Testing" },
  { key: "go_live", label: "Go-Live" },
];

const INTEGRATION_MODULE_WORKFLOW: { key: string; label: string }[] = [
  { key: "provider_selected", label: "Provider selected" },
  { key: "credentials", label: "API credentials collected" },
  { key: "configure", label: "Configure & connect" },
  { key: "test", label: "Test flow verified" },
  { key: "go_live", label: "Go-Live" },
];

export function defaultModuleWorkflow(key: CrmProductModuleKey): CrmModuleWorkflowStep[] {
  const template = moduleRequiresProvider(key)
    ? INTEGRATION_MODULE_WORKFLOW
    : GENERIC_MODULE_WORKFLOW;
  return template.map((s) => ({ key: s.key, label: s.label, done: false }));
}

export function calcModuleWorkflowProgress(module: CrmProductModule): number {
  const steps = module.workflow ?? [];
  if (steps.length === 0) return 0;
  return Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
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
  { key: "sim-call-recording", label: "Sim Based Call Recording" },
  { key: "ai-call-analysis", label: "AI Call Analysis" },
  { key: "waha", label: "WAHA" },
  { key: "auto-dialer", label: "Auto Dialer" },
];

/** Third-party / channel integrations. */
export const CRM_INTEGRATION_MODULES: { key: CrmProductModuleKey; label: string }[] = [
  { key: "whatsapp-integration", label: "WhatsApp Integration" },
  { key: "sms-integration", label: "SMS Integration" },
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
  { key: "project_created", label: "Project Created" },
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
  // Core sales reports
  { key: "calling", label: "Calling Report", category: "Sales reports" },
  { key: "followup", label: "Follow-up Report", category: "Sales reports" },
  { key: "lead_distribution", label: "Lead Distribution Report", category: "Sales reports" },
  { key: "site_visit", label: "Site Visit Report", category: "Sales reports" },
  { key: "booking", label: "Booking Report", category: "Sales reports" },
  { key: "collection", label: "Collection Report", category: "Sales reports" },
  { key: "cp_performance", label: "CP Performance Report", category: "Sales reports" },
  { key: "inventory", label: "Inventory Report", category: "Sales reports" },
  { key: "sales_funnel", label: "Sales Funnel Report", category: "Sales reports" },
  { key: "executive", label: "Executive Performance Report", category: "Sales reports" },
  { key: "manager_dashboard", label: "Manager Dashboard", category: "Dashboards" },
  { key: "owner_dashboard", label: "Owner Dashboard", category: "Dashboards" },
];

export const CRM_REPORT_CATEGORIES = [
  "Analysis",
  "Calls",
  "Operations",
  "Sales reports",
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
  { key: "templates_tested", label: "Templates Tested", category: "Verification" },
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
  { key: "reports_training", label: "Reports Training", category: "Product modules" },
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
  { key: "customer_management", label: "Customer Management", category: "Operations" },
  { key: "reports", label: "Reports", category: "Operations" },
  { key: "mobile_app", label: "Mobile App Training", category: "Product" },
  { key: "cp_portal", label: "CP Portal Training", category: "Product" },
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
  const custom = existing.filter(
    (s) =>
      s.templateKey.startsWith("custom-") ||
      !templates.some((t) => t.key === s.templateKey),
  );

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

/** Weighted completion across CRM onboarding sections (0–100). */
export function calcCrmOnboardingProgress(record: CrmOnboardingRecord): number {
  const sections: number[] = [];

  const enabledMods = record.productModules.filter((m) => m.enabled).length;
  sections.push(record.productModules.length ? Math.round((enabledMods / record.productModules.length) * 100) : 0);

  const mastersPct = calcChecklistProgress(record.masterChecklist);
  sections.push(mastersPct);

  const migPct = calcChecklistProgress(record.migrationChecklist);
  sections.push(migPct);

  const trainApplicable = record.trainingSessions.filter((s) => !s.notApplicable);
  const trainDone = trainApplicable.filter((s) => s.completed || (s.sessionCount ?? 0) > 0).length;
  sections.push(
    trainApplicable.length ? Math.round((trainDone / trainApplicable.length) * 100) : 0,
  );

  const reportApplicable = record.reportChecklist.filter((r) => !r.notApplicable);
  const reportsDone = reportApplicable.filter((r) => r.status === "explained").length;
  sections.push(
    reportApplicable.length ? Math.round((reportsDone / reportApplicable.length) * 100) : 0,
  );

  const goLiveDone = record.goLiveChecklist.filter((g) => isCrmGoLiveItemComplete(g)).length;
  sections.push(
    record.goLiveChecklist.length
      ? Math.round((goLiveDone / record.goLiveChecklist.length) * 100)
      : 0,
  );

  if (sections.length === 0) return 0;
  return Math.round(sections.reduce((a, b) => a + b, 0) / sections.length);
}

export function crmPendingActivityCount(record: CrmOnboardingRecord): number {
  return (
    record.masterChecklist.filter((m) => !isChecklistItemComplete(m)).length +
    record.migrationChecklist.filter((m) => !isChecklistItemComplete(m)).length +
    record.trainingSessions.filter((s) => !s.notApplicable && !s.completed && !(s.sessionCount > 0))
      .length +
    record.reportChecklist.filter((r) => !r.notApplicable && r.status !== "explained").length +
    record.goLiveChecklist.filter((g) => !isCrmGoLiveItemComplete(g)).length
  );
}

export function crmGoLiveReady(record: CrmOnboardingRecord): boolean {
  return record.goLiveChecklist.every((g) => isCrmGoLiveItemComplete(g));
}
