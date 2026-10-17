import type { Timestamps } from "./common";
import type { FieldValueType } from "./master";
import type { CrmImplementationStage } from "./crm-onboarding";

/** Platform-level CRM Master Config (mirrors ERP Master Config, CRM-scoped). */
export type CrmMasterPlatformSettings = {
  productName: string;
  productTagline: string;
  supportEmail: string;
  supportPhone: string;
  defaultTimezone: string;
  defaultCurrency: string;
  locale: string;
  brandPrimary: string;
  registeredAddress: string;
};

export type CrmMasterFieldDef = Timestamps & {
  id: string;
  key: string;
  label: string;
  description?: string;
  type: FieldValueType;
  required: boolean;
  enabled: boolean;
  order: number;
  group: string;
  options?: string[];
  placeholder?: string;
};

export type CrmMasterPicklist = Timestamps & {
  id: string;
  key: string;
  label: string;
  description?: string;
  values: string[];
};

/** Onboarding checklist step defined on a Master module (synced to account workflows). */
export type CrmMasterModuleWorkflowStepDef = {
  key: string;
  label: string;
  /** Defaults to date/checklist completion. */
  kind?: "date" | "yes_no" | "file" | "remarks";
};

export type CrmMasterModuleKind = "core" | "integration";

export type CrmMasterModuleDef = Timestamps & {
  id: string;
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  order: number;
  /** Core modules appear under Modules; integrations under Integrations. */
  kind: CrmMasterModuleKind;
  /** Seeded from code catalog — key cannot be changed; delete blocked. */
  builtIn: boolean;
  /** Checklist steps for account module onboarding (Master → Details). */
  workflowSteps: CrmMasterModuleWorkflowStepDef[];
};

/** Account-scoped project master (ERP project scale fields, CRM-scoped). */
export type CrmAccountProject = Timestamps & {
  id: string;
  name: string;
  type: string;
  city: string;
  units?: number;
  totalTowers?: number;
  totalFloors?: number;
  status: "not_started" | "in_progress" | "completed";
};

export type CrmMasterDictItem = Timestamps & {
  id: string;
  value: string;
  active: boolean;
  sortOrder: number;
};

export type CrmMasterTeam = Timestamps & {
  id: string;
  name: string;
  role?: string;
  memberCount?: number;
};

/** Editable CRM Migration checklist catalog (Master → Migration). */
export type CrmMigrationFieldDef = {
  key: string;
  label: string;
  category: string;
};

/**
 * Onboarding SLA day-bucket (Master → Onboarding targets).
 * When account days-since-start falls in [dayFrom, dayTo] and overall % is below
 * minProgressPercent, automation can WhatsApp Support 1/2 + Admins.
 */
export type CrmOnboardingTargetBucket = {
  id: string;
  dayFrom: number;
  dayTo: number;
  minProgressPercent: number;
  remarks: string;
  active: boolean;
  order: number;
};

/** Master settings for the 45-day (configurable) onboarding target window. */
export type CrmOnboardingTargetSettings = {
  /** Calendar days from account startDate that define the onboarding target window. */
  targetDays: number;
  buckets: CrmOnboardingTargetBucket[];
};

/** Account implementation pipeline stage (Master → Account stages). */
export type CrmImplementationStageDef = {
  key: CrmImplementationStage;
  label: string;
  order: number;
  active: boolean;
};

/** Editable CRM Training catalog item (Master → Training). */
export type CrmTrainingFieldDef = {
  key: string;
  label: string;
  category: string;
};

/** Call / meeting types for portal booking (Master → Bookings). */
export type CrmBookingCallTypeDef = {
  key: string;
  label: string;
  /** Slot length used when generating open times. */
  durationMinutes: number;
  /** When true, guest may specify a custom duration (e.g. Other). */
  allowsCustomDuration: boolean;
  isActive: boolean;
  order: number;
};

/** Weekly host availability windows (Master → Bookings). */
export type CrmBookingHostHoursDef = {
  weekday: number;
  startTime: string;
  endTime: string;
  enabled: boolean;
};

/**
 * WhatsApp chat template (Master → WhatsApp templates).
 * Body uses WhatsApp markers (*bold*, _italic_) and `{{variable}}` placeholders.
 */
export type CrmWhatsappTemplateDef = {
  id: string;
  name: string;
  /** Short category label shown in Master + picker (e.g. Check-in, Follow-up). */
  category: string;
  /** Template body with optional *bold* / _italic_ and {{variables}}. */
  body: string;
  /** When false, hidden from the account chat “Use template” picker. */
  active: boolean;
  order: number;
};

/**
 * Design / support ticket reply template (Master → Ticket replies).
 * Plain text with optional `{{variable}}` placeholders filled from the ticket.
 */
export type CrmTicketReplyTemplateDef = {
  id: string;
  name: string;
  category: string;
  body: string;
  /** When false, hidden from the ticket conversation “Use template” picker. */
  active: boolean;
  order: number;
};
