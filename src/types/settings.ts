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
  | "manageMaster"
  | "manageUsers"
  | "manageSettings";

export type RolePermissions = Record<UserRole, Record<RolePermissionKey, boolean>>;

export const PERMISSION_LABELS: Record<RolePermissionKey, string> = {
  manageCompanies: "Manage companies",
  manageProjects: "Manage projects & onboarding",
  approvePostSales: "Approve / reject Post Sales steps",
  manageTickets: "Manage support tickets",
  viewReports: "View reports & KPIs",
  manageMaster: "Access Master Config",
  manageUsers: "Invite & manage users",
  manageSettings: "Change organization settings",
};
