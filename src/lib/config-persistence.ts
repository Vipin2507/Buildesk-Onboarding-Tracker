import { setAppConfig } from "@/lib/api";
import { serverSyncDebounced } from "@/lib/sync";
import { useAuthStore } from "@/stores/useAuthStore";
import { useAutomationStore } from "@/stores/useAutomationStore";
import { useCrmAutomationStore } from "@/stores/useCrmAutomationStore";
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
    roles: s.roles,
  };
}

function automationSnapshot() {
  const s = useAutomationStore.getState();
  return {
    settings: s.settings,
    endpoints: s.endpoints,
    waha: s.waha,
    healthCheck: s.healthCheck,
    rules: s.rules,
    logs: s.logs.slice(0, 500),
  };
}

function crmAutomationSnapshot() {
  const s = useCrmAutomationStore.getState();
  return {
    settings: s.settings,
    endpoints: s.endpoints,
    waha: s.waha,
    healthCheck: s.healthCheck,
    rules: s.rules,
    logs: s.logs.slice(0, 500),
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

  useAutomationStore.subscribe(() => {
    if (!useAuthStore.getState().user) return;
    serverSyncDebounced("automation-config", 1000, () =>
      setAppConfig({ data: { key: "automation", value: automationSnapshot() } }),
    );
  });

  useCrmAutomationStore.subscribe(() => {
    if (!useAuthStore.getState().user) return;
    serverSyncDebounced("crm-automation-config", 1000, () =>
      setAppConfig({ data: { key: "crm-automation", value: crmAutomationSnapshot() } }),
    );
  });
}
