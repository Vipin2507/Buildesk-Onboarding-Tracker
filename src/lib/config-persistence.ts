import { setAppConfig } from "@/lib/api";
import { isAdminRoleKey } from "@/lib/permissions";
import { flushServerSyncDebounced, serverSyncDebounced } from "@/lib/sync";
import { useAuthStore } from "@/stores/useAuthStore";
import { useAutomationStore } from "@/stores/useAutomationStore";
import { useCrmAutomationStore } from "@/stores/useCrmAutomationStore";
import { useMasterStore } from "@/stores/useMasterStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import type { AutomationLog } from "@/types/automation";

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

/** Keep logs durable without blowing SQLite / localStorage with huge webhook bodies. */
function slimAutomationLogs(logs: AutomationLog[]): AutomationLog[] {
  return logs.slice(0, 500).map((log) => ({
    ...log,
    requestPayload: slimPayload(log.requestPayload),
    responseSummary: log.responseSummary?.slice(0, 500),
    errorMessage: log.errorMessage?.slice(0, 500),
  }));
}

function slimPayload(payload: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!payload || typeof payload !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string" && value.length > 2_000) {
      out[key] = `${value.slice(0, 2_000)}…`;
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = slimPayload(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function automationSnapshot() {
  const s = useAutomationStore.getState();
  return {
    settings: s.settings,
    endpoints: s.endpoints,
    waha: s.waha,
    healthCheck: s.healthCheck,
    rules: s.rules,
    logs: slimAutomationLogs(s.logs),
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
    logs: slimAutomationLogs(s.logs),
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

/** Force pending automation config (including logs) to SQLite now. */
export function flushAutomationConfigPersistence() {
  if (!canPersistAppConfig()) return;
  persistAutomationConfig();
  persistCrmAutomationConfig();
  flushServerSyncDebounced("automation-config");
  flushServerSyncDebounced("crm-automation-config");
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

  const flush = () => flushAutomationConfigPersistence();
  window.addEventListener("beforeunload", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
