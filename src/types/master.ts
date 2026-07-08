import type { Timestamps } from "./common";

export type FieldValueType =
  | "text"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "textarea"
  | "select"
  | "multiselect"
  | "boolean";

export type MasterFieldDef = Timestamps & {
  id: string;
  /** Stable machine key used in forms/storage. */
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

export type MasterPicklist = Timestamps & {
  id: string;
  key: string;
  label: string;
  description?: string;
  values: string[];
};

export type MasterWorkflowStepDef = Timestamps & {
  id: string;
  key: string;
  label: string;
  description?: string;
  requiresTemplate: boolean;
  enabled: boolean;
  order: number;
  templateName?: string;
};

export type MasterChecklistItemDef = Timestamps & {
  id: string;
  sectionKey: string;
  sectionLabel: string;
  label: string;
  enabled: boolean;
  order: number;
};

export type MasterTemplateDef = Timestamps & {
  id: string;
  name: string;
  category: string;
  description?: string;
  enabled: boolean;
  order: number;
};

export type MasterModuleDef = Timestamps & {
  id: string;
  key: string;
  label: string;
  description: string;
  icon: string;
  enabled: boolean;
  order: number;
};

export type MasterIntegrationDef = Timestamps & {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  order: number;
};

export type MasterTriggerDef = Timestamps & {
  id: string;
  name: string;
  event: string;
  channel: string;
  enabled: boolean;
  order: number;
};

export type MasterPlatformSettings = {
  productName: string;
  productTagline: string;
  supportEmail: string;
  defaultTimezone: string;
  defaultCurrency: string;
  allowViewerApprovals: boolean;
  requireRejectionRemarks: boolean;
  autoLogActivity: boolean;
};
