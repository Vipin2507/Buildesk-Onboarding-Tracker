import type { Timestamps } from "./common";
import type { FieldValueType } from "./master";

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

export type CrmMasterModuleDef = Timestamps & {
  id: string;
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  order: number;
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
