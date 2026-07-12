import { setAppConfig } from "@/lib/api";
import { serverSyncDebounced } from "@/lib/sync";
import { useAuthStore } from "@/stores/useAuthStore";
import { useMasterStore } from "@/stores/useMasterStore";
import { useSettingsStore } from "@/stores/useSettingsStore";

function masterSnapshot() {
  const s = useMasterStore.getState();
  return {
    platform: s.platform,
    companyFields: s.companyFields,
    projectFields: s.projectFields,
    picklists: s.picklists,
    workflowSteps: s.workflowSteps,
    checklistItems: s.checklistItems,
    templates: s.templates,
    modules: s.modules,
    integrations: s.integrations,
    triggers: s.triggers,
    inventoryItems: s.inventoryItems,
  };
}

function settingsSnapshot() {
  const s = useSettingsStore.getState();
  return {
    org: s.org,
    notifications: s.notifications,
    documents: s.documents,
    excelTemplates: s.excelTemplates,
    paymentPlans: s.paymentPlans,
    permissions: s.permissions,
  };
}

let wired = false;

/** Subscribe master/settings stores so changes persist to SQLite app_config. */
export function wireConfigPersistence() {
  if (wired || typeof window === "undefined") return;
  wired = true;

  useMasterStore.subscribe(() => {
    if (!useAuthStore.getState().user) return;
    serverSyncDebounced("master-config", 1000, () =>
      setAppConfig({ data: { key: "master", value: masterSnapshot() } }),
    );
  });

  useSettingsStore.subscribe(() => {
    if (!useAuthStore.getState().user) return;
    serverSyncDebounced("settings-config", 1000, () =>
      setAppConfig({ data: { key: "settings", value: settingsSnapshot() } }),
    );
  });
}
