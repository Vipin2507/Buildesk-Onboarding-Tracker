import type {
  DocumentSettings,
  ExcelTemplateSetting,
  NotificationSettings,
  OrgSettings,
  PaymentPlanPreset,
  RolePermissionKey,
  RolePermissions,
} from "@/types";
import { newId, nowIso } from "@/types";
import { createPersistedStore, touch } from "./persist";
import { logActivity } from "./useActivityStore";

const SEED_ORG: OrgSettings = {
  legalName: "Buildesk Technologies Pvt. Ltd.",
  tradeName: "Buildesk",
  gstNumber: "27AABCU9603R1ZM",
  registeredAddress: "5th Floor, WeWork Galaxy, Bengaluru, KA 560001",
  timezone: "Asia/Kolkata",
  locale: "en-IN",
  currency: "INR",
  fiscalYearStart: "04-01",
  supportEmail: "support@buildesk.com",
  supportPhone: "+91 80 4123 4567",
  brandPrimary: "#009BFF",
};

const SEED_NOTIFICATIONS: NotificationSettings = {
  smtpHost: "smtp.buildesk.com",
  smtpPort: 587,
  smtpUser: "noreply@buildesk.com",
  smtpFromName: "Buildesk Tracker",
  smtpFromEmail: "noreply@buildesk.com",
  digestCadence: "daily",
  digestHour: 9,
  notifyOnApprovals: true,
  notifyOnTicketUpdates: true,
  notifyOnRenewals: true,
  notifyOnGoLive: true,
  quietHoursEnabled: true,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
};

const SEED_DOCUMENTS: DocumentSettings = {
  defaultFormat: "PDF",
  defaultSignatory: "Aditya Kulkarni",
  signatoryTitle: "Authorized Signatory",
  footerText: "Confidential · Buildesk Onboarding Tracker",
  includeGstOnDocs: true,
  autoVersioning: true,
  retentionDays: 365,
};

const SEED_EXCEL: ExcelTemplateSetting[] = [
  {
    id: newId(),
    name: "Unit Configuration",
    purpose: "unit",
    sampleFileName: "unit_configuration_sample.xlsx",
    requiredColumns: "Tower, Floor, Unit No, Type, Carpet Area, Rate",
    enabled: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: newId(),
    name: "Customer Data",
    purpose: "customer",
    sampleFileName: "customer_data_sample.xlsx",
    requiredColumns: "Name, Unit, Phone, Email, KYC Status",
    enabled: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: newId(),
    name: "Booking Data",
    purpose: "booking",
    sampleFileName: "booking_data_sample.xlsx",
    requiredColumns: "Booking ID, Customer, Unit, Booking Date, Amount",
    enabled: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: newId(),
    name: "Payment Data",
    purpose: "payment",
    sampleFileName: "payment_data_sample.xlsx",
    requiredColumns: "Payment ID, Customer, Amount, Mode, Date, Status",
    enabled: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];

const SEED_PLANS: PaymentPlanPreset[] = [
  {
    id: newId(),
    name: "Construction Linked",
    installments: 8,
    frequency: "Milestone",
    downPaymentPercent: 10,
    notes: "Tied to construction milestones",
    enabled: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: newId(),
    name: "Flexi Monthly",
    installments: 24,
    frequency: "Monthly",
    downPaymentPercent: 20,
    notes: "Equal monthly installments after down payment",
    enabled: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: newId(),
    name: "Quarterly Premium",
    installments: 12,
    frequency: "Quarterly",
    downPaymentPercent: 15,
    enabled: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];

const SEED_PERMISSIONS: RolePermissions = {
  Admin: {
    manageCompanies: true,
    manageProjects: true,
    approvePostSales: true,
    manageTickets: true,
    viewReports: true,
    manageMaster: true,
    manageUsers: true,
    manageSettings: true,
  },
  Manager: {
    manageCompanies: true,
    manageProjects: true,
    approvePostSales: false,
    manageTickets: true,
    viewReports: true,
    manageMaster: false,
    manageUsers: false,
    manageSettings: false,
  },
  Viewer: {
    manageCompanies: false,
    manageProjects: false,
    approvePostSales: false,
    manageTickets: false,
    viewReports: true,
    manageMaster: false,
    manageUsers: false,
    manageSettings: false,
  },
};

type SettingsState = {
  org: OrgSettings;
  notifications: NotificationSettings;
  documents: DocumentSettings;
  excelTemplates: ExcelTemplateSetting[];
  paymentPlans: PaymentPlanPreset[];
  permissions: RolePermissions;

  updateOrg: (data: Partial<OrgSettings>) => void;
  updateNotifications: (data: Partial<NotificationSettings>) => void;
  updateDocuments: (data: Partial<DocumentSettings>) => void;

  addExcelTemplate: (data: Omit<ExcelTemplateSetting, "id" | "createdAt" | "updatedAt">) => void;
  updateExcelTemplate: (id: string, data: Partial<ExcelTemplateSetting>) => void;
  deleteExcelTemplate: (id: string) => void;

  addPaymentPlan: (data: Omit<PaymentPlanPreset, "id" | "createdAt" | "updatedAt">) => void;
  updatePaymentPlan: (id: string, data: Partial<PaymentPlanPreset>) => void;
  deletePaymentPlan: (id: string) => void;

  setPermission: (role: keyof RolePermissions, key: RolePermissionKey, value: boolean) => void;
  resetPermissions: () => void;
};

export const useSettingsStore = createPersistedStore<SettingsState>("app-settings-v1", (set) => ({
  org: SEED_ORG,
  notifications: SEED_NOTIFICATIONS,
  documents: SEED_DOCUMENTS,
  excelTemplates: SEED_EXCEL,
  paymentPlans: SEED_PLANS,
  permissions: SEED_PERMISSIONS,

  updateOrg: (data) => {
    set((s) => ({ org: { ...s.org, ...data } }));
    logActivity({ who: "You", what: "Updated organization settings", kind: "info" });
  },

  updateNotifications: (data) => {
    set((s) => ({ notifications: { ...s.notifications, ...data } }));
    logActivity({ who: "You", what: "Updated email & notification settings", kind: "info" });
  },

  updateDocuments: (data) => {
    set((s) => ({ documents: { ...s.documents, ...data } }));
    logActivity({ who: "You", what: "Updated document settings", kind: "info" });
  },

  addExcelTemplate: (data) => {
    const now = nowIso();
    set((s) => ({
      excelTemplates: [...s.excelTemplates, { ...data, id: newId(), createdAt: now, updatedAt: now }],
    }));
    logActivity({ who: "You", what: `Added Excel template ${data.name}`, kind: "success" });
  },

  updateExcelTemplate: (id, data) => {
    set((s) => ({
      excelTemplates: s.excelTemplates.map((t) => (t.id === id ? touch({ ...t, ...data }) : t)),
    }));
  },

  deleteExcelTemplate: (id) => {
    set((s) => ({ excelTemplates: s.excelTemplates.filter((t) => t.id !== id) }));
  },

  addPaymentPlan: (data) => {
    const now = nowIso();
    set((s) => ({
      paymentPlans: [...s.paymentPlans, { ...data, id: newId(), createdAt: now, updatedAt: now }],
    }));
    logActivity({ who: "You", what: `Added payment plan ${data.name}`, kind: "success" });
  },

  updatePaymentPlan: (id, data) => {
    set((s) => ({
      paymentPlans: s.paymentPlans.map((p) => (p.id === id ? touch({ ...p, ...data }) : p)),
    }));
  },

  deletePaymentPlan: (id) => {
    set((s) => ({ paymentPlans: s.paymentPlans.filter((p) => p.id !== id) }));
  },

  setPermission: (role, key, value) => {
    set((s) => ({
      permissions: {
        ...s.permissions,
        [role]: { ...s.permissions[role], [key]: value },
      },
    }));
  },

  resetPermissions: () => {
    set({ permissions: SEED_PERMISSIONS });
    logActivity({ who: "You", what: "Reset role permissions to defaults", kind: "warning" });
  },
}));
