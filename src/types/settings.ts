import type { Timestamps, UserRole } from "@/types";

export type OrgSettings = {
  legalName: string;
  tradeName: string;
  gstNumber: string;
  registeredAddress: string;
  timezone: string;
  locale: string;
  currency: string;
  fiscalYearStart: string;
  supportEmail: string;
  supportPhone: string;
  brandPrimary: string;
};

export type NotificationSettings = {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpFromName: string;
  smtpFromEmail: string;
  digestCadence: "off" | "daily" | "weekly";
  digestHour: number;
  notifyOnApprovals: boolean;
  notifyOnTicketUpdates: boolean;
  notifyOnRenewals: boolean;
  notifyOnGoLive: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
};

export type DocumentSettings = {
  defaultFormat: "PDF" | "DOCX";
  defaultSignatory: string;
  signatoryTitle: string;
  footerText: string;
  includeGstOnDocs: boolean;
  autoVersioning: boolean;
  retentionDays: number;
};

export type ExcelTemplateSetting = Timestamps & {
  id: string;
  name: string;
  purpose: string;
  sampleFileName: string;
  requiredColumns: string;
  enabled: boolean;
};

export type PaymentPlanPreset = Timestamps & {
  id: string;
  name: string;
  installments: number;
  frequency: "Monthly" | "Quarterly" | "Milestone";
  downPaymentPercent: number;
  notes?: string;
  enabled: boolean;
};

export type RolePermissionKey =
  | "manageCompanies"
  | "manageProjects"
  | "approvePostSales"
  | "manageTickets"
  | "viewReports"
  | "manageEmployees"
  | "manageMaster"
  | "manageUsers"
  | "manageSettings"
  | "manageRoles";

export type RolePermissionMap = Record<RolePermissionKey, boolean>;

/** @deprecated Use roles[] — kept for migration from older persisted settings. */
export type RolePermissions = Record<UserRole, RolePermissionMap>;

export type RoleDefinition = Timestamps & {
  id: string;
  /** Stored on user accounts — unique slug, e.g. Admin, Manager, csm */
  key: string;
  name: string;
  description?: string;
  isSystem: boolean;
  permissions: RolePermissionMap;
};

export const ALL_PERMISSION_KEYS: RolePermissionKey[] = [
  "manageCompanies",
  "manageProjects",
  "approvePostSales",
  "manageTickets",
  "viewReports",
  "manageEmployees",
  "manageMaster",
  "manageUsers",
  "manageSettings",
  "manageRoles",
];

/** Admin system role always retains these — cannot be toggled off. */
export const ADMIN_LOCKED_PERMISSIONS: RolePermissionKey[] = [
  "manageMaster",
  "manageUsers",
  "manageSettings",
  "manageRoles",
];

export const PERMISSION_GROUPS: Array<{
  id: string;
  label: string;
  description: string;
  keys: RolePermissionKey[];
}> = [
  {
    id: "operations",
    label: "Operations",
    description: "Day-to-day onboarding and client delivery",
    keys: ["manageCompanies", "manageProjects", "approvePostSales", "manageTickets"],
  },
  {
    id: "insights",
    label: "Insights",
    description: "Reporting and portfolio visibility",
    keys: ["viewReports"],
  },
  {
    id: "people",
    label: "People",
    description: "Team roster and staffing",
    keys: ["manageEmployees"],
  },
  {
    id: "administration",
    label: "Administration",
    description: "Platform configuration — visible to Admins only in navigation",
    keys: ["manageMaster", "manageUsers", "manageSettings", "manageRoles"],
  },
];

export const PERMISSION_LABELS: Record<RolePermissionKey, string> = {
  manageCompanies: "Manage companies",
  manageProjects: "Manage projects & onboarding",
  approvePostSales: "Approve / reject Post Sales steps",
  manageTickets: "Manage support tickets",
  viewReports: "View reports & KPIs",
  manageEmployees: "Manage employees & managers",
  manageMaster: "Access Master Config",
  manageUsers: "Invite & manage users",
  manageSettings: "Change organization settings",
  manageRoles: "Manage roles & permissions",
};

export const PERMISSION_DESCRIPTIONS: Record<RolePermissionKey, string> = {
  manageCompanies: "Create, edit, delete companies and assign managers",
  manageProjects: "Create projects, edit checklists, and update onboarding progress",
  approvePostSales: "Approve or reject Post Sales workflow steps",
  manageTickets: "Create, assign, and resolve support desk tickets",
  viewReports: "Open reports, exports, and dashboard KPIs",
  manageEmployees: "Add onboarding managers and transfer company assignments",
  manageMaster: "Edit master data, workflows, and platform catalogs",
  manageUsers: "Invite users, reset access, and deactivate accounts",
  manageSettings: "Update org profile, notifications, and document defaults",
  manageRoles: "Create roles and configure the permission matrix",
};
