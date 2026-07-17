import type {
  DocumentSettings,
  ExcelTemplateSetting,
  NotificationSettings,
  OrgSettings,
  PaymentPlanPreset,
  RoleDefinition,
  RolePermissionKey,
  RolePermissions,
} from "@/types";
import { newId, nowIso } from "@/types";
import {
  DEFAULT_ROLES,
  defaultPermissionMap,
  normalizeAdminPermissions,
  rolesFromLegacyPermissions,
  slugifyRoleKey,
} from "@/lib/permissions";
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

type SettingsState = {
  org: OrgSettings;
  notifications: NotificationSettings;
  documents: DocumentSettings;
  excelTemplates: ExcelTemplateSetting[];
  paymentPlans: PaymentPlanPreset[];
  roles: RoleDefinition[];
  /** @deprecated migrated into roles */
  permissions?: RolePermissions;

  updateOrg: (data: Partial<OrgSettings>) => void;
  updateNotifications: (data: Partial<NotificationSettings>) => void;
  updateDocuments: (data: Partial<DocumentSettings>) => void;

  addExcelTemplate: (data: Omit<ExcelTemplateSetting, "id" | "createdAt" | "updatedAt">) => void;
  updateExcelTemplate: (id: string, data: Partial<ExcelTemplateSetting>) => void;
  deleteExcelTemplate: (id: string) => void;

  addPaymentPlan: (data: Omit<PaymentPlanPreset, "id" | "createdAt" | "updatedAt">) => void;
  updatePaymentPlan: (id: string, data: Partial<PaymentPlanPreset>) => void;
  deletePaymentPlan: (id: string) => void;

  addRole: (data: { name: string; description?: string; cloneFromId?: string }) => RoleDefinition;
  updateRole: (id: string, data: Partial<Pick<RoleDefinition, "name" | "description">>) => void;
  deleteRole: (id: string) => boolean;
  setRolePermission: (roleId: string, key: RolePermissionKey, value: boolean) => void;
  setRolePermissions: (roleId: string, permissions: Partial<Record<RolePermissionKey, boolean>>) => void;
  resetRoles: () => void;
  getRoleByKey: (key: string) => RoleDefinition | undefined;

  /** @deprecated use setRolePermission */
  setPermission: (role: string, key: RolePermissionKey, value: boolean) => void;
  /** @deprecated use resetRoles */
  resetPermissions: () => void;
};

function cloneRoles(roles: RoleDefinition[]) {
  return roles.map((r) => ({
    ...r,
    permissions: { ...r.permissions },
  }));
}

export const useSettingsStore = createPersistedStore<SettingsState>("app-settings-v2", (set, get) => ({
  org: SEED_ORG,
  notifications: SEED_NOTIFICATIONS,
  documents: SEED_DOCUMENTS,
  excelTemplates: SEED_EXCEL,
  paymentPlans: SEED_PLANS,
  roles: cloneRoles(DEFAULT_ROLES),

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

  addRole: (data) => {
    const now = nowIso();
    const existingKeys = get().roles.map((r) => r.key);
    const key = slugifyRoleKey(data.name, existingKeys);
    const cloneSource = data.cloneFromId
      ? get().roles.find((r) => r.id === data.cloneFromId)
      : get().roles.find((r) => r.key === "Manager");
    const permissions = defaultPermissionMap(cloneSource?.permissions ?? {});
    const role: RoleDefinition = {
      id: newId(),
      key,
      name: data.name.trim(),
      description: data.description?.trim() || undefined,
      isSystem: false,
      permissions,
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ roles: [...s.roles, role] }));
    logActivity({ who: "You", what: `Created role ${role.name}`, kind: "success" });
    return role;
  },

  updateRole: (id, data) => {
    set((s) => ({
      roles: s.roles.map((r) => {
        if (r.id !== id) return r;
        return touch({
          ...r,
          ...(data.name !== undefined ? { name: data.name.trim() } : {}),
          ...(data.description !== undefined
            ? { description: data.description.trim() || undefined }
            : {}),
        });
      }),
    }));
    logActivity({ who: "You", what: "Updated role", kind: "info" });
  },

  deleteRole: (id) => {
    const role = get().roles.find((r) => r.id === id);
    if (!role || role.isSystem) return false;
    set((s) => ({ roles: s.roles.filter((r) => r.id !== id) }));
    logActivity({ who: "You", what: `Deleted role ${role.name}`, kind: "warning" });
    return true;
  },

  setRolePermission: (roleId, key, value) => {
    set((s) => ({
      roles: s.roles.map((r) => {
        if (r.id !== roleId) return r;
        const permissions = normalizeAdminPermissions(r.key, {
          ...r.permissions,
          [key]: value,
        });
        return touch({ ...r, permissions });
      }),
    }));
  },

  setRolePermissions: (roleId, patch) => {
    set((s) => ({
      roles: s.roles.map((r) => {
        if (r.id !== roleId) return r;
        const permissions = normalizeAdminPermissions(r.key, { ...r.permissions, ...patch });
        return touch({ ...r, permissions });
      }),
    }));
  },

  resetRoles: () => {
    set({ roles: cloneRoles(DEFAULT_ROLES) });
    logActivity({ who: "You", what: "Reset roles & permissions to defaults", kind: "warning" });
  },

  getRoleByKey: (key) => get().roles.find((r) => r.key === key),

  setPermission: (roleKey, key, value) => {
    const role = get().roles.find((r) => r.key === roleKey);
    if (role) get().setRolePermission(role.id, key, value);
  },

  resetPermissions: () => {
    get().resetRoles();
  },
}));

/** Hydrate roles from server snapshot or legacy local permissions. */
export function hydrateSettingsFromServer(snapshot: Record<string, unknown> | null | undefined) {
  if (!snapshot || typeof snapshot !== "object") return;
  const patch: Partial<SettingsState> = {};
  if (snapshot.org) patch.org = snapshot.org as OrgSettings;
  if (snapshot.notifications) patch.notifications = snapshot.notifications as NotificationSettings;
  if (snapshot.documents) patch.documents = snapshot.documents as DocumentSettings;
  if (snapshot.excelTemplates) patch.excelTemplates = snapshot.excelTemplates as ExcelTemplateSetting[];
  if (snapshot.paymentPlans) patch.paymentPlans = snapshot.paymentPlans as PaymentPlanPreset[];
  if (Array.isArray(snapshot.roles) && snapshot.roles.length > 0) {
    patch.roles = (snapshot.roles as RoleDefinition[]).map((r) => ({
      ...r,
      permissions: normalizeAdminPermissions(
        r.key,
        defaultPermissionMap(r.permissions ?? {}),
      ),
    }));
  } else if (snapshot.permissions) {
    patch.roles = rolesFromLegacyPermissions(snapshot.permissions as RolePermissions);
  }
  if (Object.keys(patch).length > 0) {
    useSettingsStore.setState((s) => ({ ...s, ...patch }));
  }
}
