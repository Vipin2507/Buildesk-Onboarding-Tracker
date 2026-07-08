import type {
  ChecklistPhase,
  CustomerAppConfig,
  CustomerRecord,
  OnboardingChecklistItem,
  OtherCharge,
  PaymentRecord,
  UnitUpload,
  UploadType,
} from "@/types";
import { newId, nowIso } from "@/types";
import {
  seedChecklistItems,
  seedCustomerAppConfigs,
  seedCustomerRecords,
  seedOtherCharges,
  seedPaymentRecords,
  seedUploads,
} from "@/data/seed";
import { buildChecklistForProject } from "@/data/seed";
import { CHECKLIST_TEMPLATE } from "@/data/constants";
import { logActivity } from "./useActivityStore";
import { recordAttachment } from "./useNotesAttachmentsStore";
import { createPersistedStore, touch } from "./persist";
import { useProjectStore } from "./useProjectStore";
import { ATTACHMENT_CATEGORY_LABEL } from "@/types";

type OnboardingState = {
  checklistItems: OnboardingChecklistItem[];
  otherCharges: OtherCharge[];
  uploads: UnitUpload[];
  customerRecords: CustomerRecord[];
  paymentRecords: PaymentRecord[];
  customerAppConfigs: CustomerAppConfig[];

  initChecklistForProject: (projectId: string) => void;
  removeProjectData: (projectId: string) => void;

  toggleChecklist: (id: string, phase: ChecklistPhase, who?: string) => void;
  updateChecklistRemarks: (id: string, remarks: string) => void;
  getChecklistByProject: (projectId: string) => OnboardingChecklistItem[];
  getProjectProgress: (projectId: string) => number;
  canGoLive: (projectId: string) => boolean;

  addOtherCharge: (data: Omit<OtherCharge, "id" | "createdAt" | "updatedAt">) => void;
  updateOtherCharge: (id: string, data: Partial<OtherCharge>) => void;
  deleteOtherCharge: (id: string) => void;
  getOtherChargesByProject: (projectId: string) => OtherCharge[];

  simulateUpload: (projectId: string, type: UploadType, fileName: string, companyId?: string) => void;
  removeUpload: (id: string) => void;
  getUploadsByProject: (projectId: string) => UnitUpload[];

  updateCustomerAppConfig: (projectId: string, data: Partial<CustomerAppConfig>) => void;
  getCustomerAppConfig: (projectId: string) => CustomerAppConfig | undefined;
};

function calcProgress(items: OnboardingChecklistItem[]) {
  if (items.length === 0) return 0;
  const total = items.length * 3;
  const done = items.reduce((sum, i) => sum + (i.collected ? 1 : 0) + (i.uploaded ? 1 : 0) + (i.live ? 1 : 0), 0);
  return Math.round((done / total) * 100);
}

export const useOnboardingStore = createPersistedStore<OnboardingState>("onboarding", (set, get) => ({
  checklistItems: seedChecklistItems,
  otherCharges: seedOtherCharges,
  uploads: seedUploads,
  customerRecords: seedCustomerRecords,
  paymentRecords: seedPaymentRecords,
  customerAppConfigs: seedCustomerAppConfigs,

  initChecklistForProject: (projectId) => {
    const existing = get().checklistItems.some((i) => i.projectId === projectId);
    if (existing) return;
    const items = buildChecklistForProject(projectId);
    const config: CustomerAppConfig = {
      projectId,
      mode: "buildesk",
      appName: "Customer App",
      primaryColor: "#2563eb",
      logoUrl: "",
      supportEmail: "",
      supportPhone: "",
      publishStatus: "draft",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    set((s) => ({
      checklistItems: [...s.checklistItems, ...items],
      customerAppConfigs: [...s.customerAppConfigs, config],
    }));
  },

  removeProjectData: (projectId) => {
    set((s) => ({
      checklistItems: s.checklistItems.filter((i) => i.projectId !== projectId),
      otherCharges: s.otherCharges.filter((i) => i.projectId !== projectId),
      uploads: s.uploads.filter((i) => i.projectId !== projectId),
      customerRecords: s.customerRecords.filter((i) => i.projectId !== projectId),
      paymentRecords: s.paymentRecords.filter((i) => i.projectId !== projectId),
      customerAppConfigs: s.customerAppConfigs.filter((i) => i.projectId !== projectId),
    }));
  },

  toggleChecklist: (id, phase, who = "You") => {
    const item = get().checklistItems.find((i) => i.id === id);
    if (!item) return;
    const key = phase as keyof Pick<OnboardingChecklistItem, "collected" | "uploaded" | "live">;
    const updated = touch({ ...item, [key]: !item[key] });
    set((s) => ({
      checklistItems: s.checklistItems.map((i) => (i.id === id ? updated : i)),
    }));
    logActivity({
      who,
      what: `Toggled "${item.label}" → ${phase} for project`,
      kind: "info",
      projectId: item.projectId,
    });
  },

  updateChecklistRemarks: (id, remarks) => {
    set((s) => ({
      checklistItems: s.checklistItems.map((i) => (i.id === id ? touch({ ...i, remarks }) : i)),
    }));
  },

  getChecklistByProject: (projectId) => get().checklistItems.filter((i) => i.projectId === projectId),

  getProjectProgress: (projectId) => calcProgress(get().getChecklistByProject(projectId)),

  canGoLive: (projectId) => {
    const goliveItems = get().checklistItems.filter((i) => i.projectId === projectId && i.section === "golive");
    return goliveItems.length > 0 && goliveItems.every((i) => i.collected && i.uploaded && i.live);
  },

  addOtherCharge: (data) => {
    const charge: OtherCharge = { ...data, id: newId(), createdAt: nowIso(), updatedAt: nowIso() };
    set((s) => ({ otherCharges: [...s.otherCharges, charge] }));
    logActivity({ who: "You", what: `Added charge: ${charge.name}`, kind: "info", projectId: data.projectId });
  },

  updateOtherCharge: (id, data) => {
    set((s) => ({
      otherCharges: s.otherCharges.map((c) => (c.id === id ? touch({ ...c, ...data }) : c)),
    }));
  },

  deleteOtherCharge: (id) => {
    set((s) => ({ otherCharges: s.otherCharges.filter((c) => c.id !== id) }));
  },

  getOtherChargesByProject: (projectId) => get().otherCharges.filter((c) => c.projectId === projectId),

  simulateUpload: (projectId, type, fileName, companyId) => {
    const recordCount = 50 + Math.floor(Math.random() * 200);
    const now = nowIso();
    const upload: UnitUpload = {
      id: newId(),
      projectId,
      type,
      fileName,
      recordCount,
      uploadedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    const records: CustomerRecord[] = type === "customer"
      ? Array.from({ length: Math.min(recordCount, 20) }).map((_, i) => ({
          id: newId(),
          projectId,
          name: `Customer ${i + 1}`,
          unit: `A-${100 + i}`,
          phone: `+91 98${String(10000000 + i).slice(0, 8)}`,
          createdAt: now,
          updatedAt: now,
        }))
      : [];
    const payments: PaymentRecord[] = type === "payment"
      ? Array.from({ length: Math.min(recordCount, 15) }).map((_, i) => ({
          id: newId(),
          projectId,
          customerName: `Customer ${i + 1}`,
          amount: 100000 + i * 5000,
          status: (["pending", "received", "overdue"] as const)[i % 3],
          createdAt: now,
          updatedAt: now,
        }))
      : [];

    set((s) => ({
      uploads: [...s.uploads.filter((u) => !(u.projectId === projectId && u.type === type)), upload],
      customerRecords: type === "customer" ? [...s.customerRecords.filter((r) => r.projectId !== projectId), ...records] : s.customerRecords,
      paymentRecords: type === "payment" ? [...s.paymentRecords.filter((r) => r.projectId !== projectId), ...payments] : s.paymentRecords,
    }));

    // Auto-check relevant checklist items
    const sectionMap: Record<UploadType, string> = {
      unit: "unit",
      customer: "customer",
      booking: "payment",
      payment: "payment",
    };
    const section = sectionMap[type];
    const labelMatch: Record<UploadType, string> = {
      unit: "Unit configuration Excel uploaded",
      customer: "Customer data Excel uploaded",
      booking: "Booking data uploaded",
      payment: "Payment data uploaded",
    };
    const items = get().checklistItems.filter(
      (i) => i.projectId === projectId && i.section === section && i.label.includes(labelMatch[type].split(" ")[0]),
    );
    if (items[0]) {
      get().toggleChecklist(items[0].id, "uploaded", "System");
    }

    logActivity({
      who: "You",
      what: `Uploaded ${fileName} (${recordCount} records)`,
      kind: "success",
      projectId,
      companyId,
    });

    const resolvedCompanyId =
      companyId ?? useProjectStore.getState().projects.find((p) => p.id === projectId)?.companyId;
    if (resolvedCompanyId) {
      const projectName = useProjectStore.getState().projects.find((p) => p.id === projectId)?.name;
      recordAttachment({
        companyId: resolvedCompanyId,
        projectId,
        fileName,
        purpose: ATTACHMENT_CATEGORY_LABEL[type],
        category: type,
        context: projectName ? `Data migration · ${projectName}` : "Data migration",
        recordCount,
        uploadedBy: "You",
        uploadedAt: now,
      });
    }
  },

  removeUpload: (id) => {
    const upload = get().uploads.find((u) => u.id === id);
    if (!upload) return;
    set((s) => ({ uploads: s.uploads.filter((u) => u.id !== id) }));
    logActivity({ who: "You", what: `Removed upload ${upload.fileName}`, kind: "warning", projectId: upload.projectId });
  },

  getUploadsByProject: (projectId) => get().uploads.filter((u) => u.projectId === projectId),

  updateCustomerAppConfig: (projectId, data) => {
    set((s) => ({
      customerAppConfigs: s.customerAppConfigs.map((c) =>
        c.projectId === projectId ? touch({ ...c, ...data }) : c,
      ),
    }));
    logActivity({ who: "You", what: "Updated customer app configuration", kind: "info", projectId });
  },

  getCustomerAppConfig: (projectId) => get().customerAppConfigs.find((c) => c.projectId === projectId),
}));

export { CHECKLIST_TEMPLATE, calcProgress };
