import type { Timestamps } from "./common";
import type { CompanyType } from "./company";
import type {
  CrmAccountProject,
  CrmMasterDictItem,
  CrmMasterTeam,
} from "./crm-master";

/** Purchased CRM product features (not Buildesk ModuleKey). */
export type CrmProductModuleKey =
  | "sales-crm"
  | "cp-application"
  | "reception-application"
  | "site-visit-application"
  | "inventory"
  | "booking"
  | "collections"
  | "demand-letter"
  | "receipt-management"
  | "reports"
  | "marketing"
  | "whatsapp-integration"
  | "sms-integration"
  | "ivr-integration"
  | "meta-lead-integration"
  | "google-ads-integration"
  | "website-integration"
  | "99acres-integration"
  | "magicbricks-integration"
  | "housing-integration"
  | "sim-call-recording"
  | "ai-call-analysis"
  | "waha"
  | "auto-dialer";

export type CrmChecklistStatus = "pending" | "completed";
export type CrmMigrationStatus = "pending" | "in_progress" | "completed";
export type CrmReportStatus = "pending" | "explained";
export type CrmTrackerPriority = "low" | "medium" | "high" | "critical";
export type CrmImplementationStage =
  | "company_creation"
  | "module_selection"
  | "master_creation"
  | "data_migration"
  | "integration_setup"
  | "training"
  | "report_explanation"
  | "uat"
  | "client_signoff"
  | "go_live"
  | "ticket_support"
  | "customer_success";

export type CrmModuleWorkflowStep = {
  key: string;
  label: string;
  done: boolean;
  completedAt?: string;
};

export type CrmProductModule = {
  key: CrmProductModuleKey;
  label: string;
  enabled: boolean;
  /** For integration modules delivered via a third-party provider. */
  provider?: string;
  /** Implementation workflow steps, seeded when the module is opted in. */
  workflow?: CrmModuleWorkflowStep[];
};

export type CrmMasterChecklistItem = {
  key: string;
  label: string;
  collected: boolean;
  uploaded: boolean;
  live: boolean;
  collectedAt?: string;
  uploadedAt?: string;
  liveAt?: string;
  notApplicable: boolean;
  remarks: string;
  assigneeUserId?: string;
  dueDate?: string;
};

export type CrmMigrationChecklistItem = {
  key: string;
  label: string;
  category?: string;
  collected: boolean;
  uploaded: boolean;
  live: boolean;
  collectedAt?: string;
  uploadedAt?: string;
  liveAt?: string;
  notApplicable: boolean;
  remarks: string;
  assigneeUserId?: string;
  dueDate?: string;
  /** Source file name / sheet reference */
  sourceFile?: string;
  /** Approximate records migrated */
  recordCount?: number;
  /** How many times this dataset was uploaded (re-migrations). */
  uploadAttempts: number;
  /** @deprecated legacy status — migrated on load */
  status?: CrmMigrationStatus;
  completedAt?: string;
  notes?: string;
};

export type CrmTrainingSessionLog = {
  id: string;
  trainingDate: string;
  trainerName?: string;
  durationHours?: number;
  attendance?: string;
  note?: string;
  recordingUploaded?: boolean;
};

export type CrmTrainingSession = Timestamps & {
  id: string;
  templateKey: string;
  label: string;
  track: "developer" | "broker_cp";
  category?: string;
  trainerName: string;
  trainingDate: string;
  durationHours: number;
  attendance: string;
  recordingUploaded: boolean;
  completed: boolean;
  /** How many times this training was conducted (re-sessions). */
  sessionCount: number;
  sessionLog?: CrmTrainingSessionLog[];
  notes?: string;
  assigneeUserId?: string;
  dueDate?: string;
  notApplicable?: boolean;
};

export type CrmReportExplanationEntry = {
  id: string;
  explainedAt: string;
  trainerName?: string;
  note?: string;
};

export type CrmReportChecklistItem = {
  key: string;
  label: string;
  category?: string;
  status: CrmReportStatus;
  /** How many times this report has been explained to the client. */
  explanationCount: number;
  explainedAt?: string;
  trainerName?: string;
  notes?: string;
  explanationLog?: CrmReportExplanationEntry[];
  notApplicable?: boolean;
};

export type CrmGoLiveChecklistItem = {
  key: string;
  label: string;
  category?: string;
  status: CrmChecklistStatus;
  completedAt?: string;
  notApplicable?: boolean;
  remarks?: string;
  assigneeUserId?: string;
  dueDate?: string;
};

export type CrmTrackerMeta = {
  stage: CrmImplementationStage;
  assignedExecutiveId?: string;
  expectedCompletionDate?: string;
  delayReason?: string;
  priority: CrmTrackerPriority;
  lastUpdatedBy?: string;
};

export type CrmCommChannel = "whatsapp" | "sms" | "email" | "push";

export type CrmCommActionKey =
  | "welcome"
  | "login_credentials"
  | "training_schedule"
  | "meeting_reminder"
  | "demand_letter"
  | "receipt"
  | "pending_activity"
  | "go_live_confirmation";

export type CrmCommLogEntry = Timestamps & {
  id: string;
  action: CrmCommActionKey;
  channel: CrmCommChannel;
  summary: string;
  status: "sent" | "logged" | "failed";
};

export type CrmOnboardingRecord = Timestamps & {
  id: string;
  companyId: string;
  companyTypeHint?: CompanyType;
  productModules: CrmProductModule[];
  masterChecklist: CrmMasterChecklistItem[];
  /** Account-scoped master data (projects, dictionaries, teams) */
  masterProjects: CrmAccountProject[];
  masterSources: CrmMasterDictItem[];
  masterStatuses: CrmMasterDictItem[];
  masterFollowUps: CrmMasterDictItem[];
  masterTeams: CrmMasterTeam[];
  migrationChecklist: CrmMigrationChecklistItem[];
  trainingSessions: CrmTrainingSession[];
  reportChecklist: CrmReportChecklistItem[];
  goLiveChecklist: CrmGoLiveChecklistItem[];
  tracker: CrmTrackerMeta;
  commLog: CrmCommLogEntry[];
};
