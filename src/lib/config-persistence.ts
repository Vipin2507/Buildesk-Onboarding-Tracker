import { setAppConfig } from "@/lib/api";
import { slimAutomationLogs } from "@/lib/automation-log-sync";
import { isAdminRoleKey } from "@/lib/permissions";
import { flushServerSyncDebounced, serverSyncDebounced } from "@/lib/sync";
import { useAuthStore } from "@/stores/useAuthStore";
import { useAutomationStore } from "@/stores/useAutomationStore";
import { useCrmAutomationStore } from "@/stores/useCrmAutomationStore";
import { crmSettingsSnapshot, useCrmSettingsStore } from "@/stores/useCrmSettingsStore";
import { crmMasterSnapshot, useCrmMasterStore } from "@/stores/useCrmMasterStore";
import { useMasterStore } from "@/stores/useMasterStore";
import { useSettingsStore } from "@/stores/useSettingsStore";

function canPersistAppConfig() {
  const user = useAuthStore.getState().user;
  return Boolean(user && isAdminRoleKey(user.role));
}

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
  };
}

let wired = false;

function persistAutomationConfig() {
  if (!canPersistAppConfig()) return;
  serverSyncDebounced("automation-config", 400, () =>
    setAppConfig({ data: { key: "automation", value: automationSnapshot() } }),
  );
}

function persistCrmAutomationConfig() {
  if (!canPersistAppConfig()) return;
  serverSyncDebounced("crm-automation-config", 400, () =>
    setAppConfig({ data: { key: "crm-automation", value: crmAutomationSnapshot() } }),
  );
}

function persistCrmMasterConfig() {
  if (!canPersistAppConfig()) return;
  serverSyncDebounced("crm-master-config", 400, () =>
    setAppConfig({ data: { key: "crm-master", value: crmMasterSnapshot() } }),
  );
}

/** Debounced server sync after CRM master edits (providers, modules, fields, etc.). */
export function scheduleCrmMasterConfigPersistence() {
  persistCrmMasterConfig();
}

/** Force pending CRM master config to SQLite now. */
export function flushCrmMasterConfigPersistence() {
  if (!canPersistAppConfig()) return;
  flushServerSyncDebounced("crm-master-config");
  void setAppConfig({ data: { key: "crm-master", value: crmMasterSnapshot() } });
}

/** Force pending automation config to SQLite now (settings/rules — logs sync separately). */
export function flushAutomationConfigPersistence() {
  if (!canPersistAppConfig()) return;
  persistAutomationConfig();
  persistCrmAutomationConfig();
  flushServerSyncDebounced("automation-config");
  flushServerSyncDebounced("crm-automation-config");
}

/** One-time migration: push local logs to SQLite when server row lacks them. */
export function migrateAutomationLogsToServer() {
  if (!canPersistAppConfig()) return;
  const erpLogs = slimAutomationLogs(useAutomationStore.getState().logs);
  const crmLogs = slimAutomationLogs(useCrmAutomationStore.getState().logs);
  if (erpLogs.length === 0 && crmLogs.length === 0) return;
  void import("@/lib/api").then(({ appendAutomationLog }) => {
    for (const log of erpLogs) {
      void appendAutomationLog({ data: { key: "automation", log } }).catch(() => {});
    }
    for (const log of crmLogs) {
      void appendAutomationLog({ data: { key: "crm-automation", log } }).catch(() => {});
    }
  });
}

/** Subscribe master/settings stores so changes persist to SQLite app_config. */
export function wireConfigPersistence() {
  if (wired || typeof window === "undefined") return;
  wired = true;

  useMasterStore.subscribe(() => {
    if (!canPersistAppConfig()) return;
    serverSyncDebounced("master-config", 1000, () =>
      setAppConfig({ data: { key: "master", value: masterSnapshot() } }),
    );
  });

  useSettingsStore.subscribe(() => {
    if (!canPersistAppConfig()) return;
    serverSyncDebounced("settings-config", 1000, () =>
      setAppConfig({ data: { key: "settings", value: settingsSnapshot() } }),
    );
  });

  useAutomationStore.subscribe(() => {
    persistAutomationConfig();
  });

  useCrmAutomationStore.subscribe(() => {
    persistCrmAutomationConfig();
  });

  useCrmSettingsStore.subscribe(() => {
    if (!canPersistAppConfig()) return;
    serverSyncDebounced("crm-settings-config", 1000, () =>
      setAppConfig({ data: { key: "crm-settings", value: crmSettingsSnapshot() } }),
    );
  });

  useCrmMasterStore.subscribe(() => {
    persistCrmMasterConfig();
  });

  const flush = () => {
    flushAutomationConfigPersistence();
    if (canPersistAppConfig()) {
      flushServerSyncDebounced("crm-master-config");
    }
  };
  window.addEventListener("beforeunload", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
