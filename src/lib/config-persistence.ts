import { setAppConfig } from "@/lib/api";
import { slimAutomationLogs } from "@/lib/automation-log-sync";
import { isAdminRoleKey } from "@/lib/permissions";
import {
  cancelServerSyncDebounced,
  flushServerSyncDebounced,
  serverSyncDebounced,
} from "@/lib/sync";
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

/**
 * Block writing automation config until ServerDataBootstrap has applied the
 * authoritative SQLite snapshot. Otherwise seed defaults / local rehydrate can
 * race ahead and overwrite durable isActive / isEnabled toggles on deploy.
 */
let erpAutomationConfigPersistReady = false;
let crmAutomationConfigPersistReady = false;
let lastKnownErpConfigHash = "";
let lastKnownCrmConfigHash = "";

function computeAutomationConfigHash(snapshot: {
  settings?: { automationsEnabled?: boolean; n8nWebhookBase?: string };
  endpoints?: { channel: string; isEnabled?: boolean; webhookUrl?: string; provider?: string }[];
  waha?: { apiUrl?: string; apiKey?: string; sessionName?: string; isEnabled?: boolean };
  healthCheck?: { webhookUrl?: string; httpMethod?: string };
  rules?: {
    id: string;
    name?: string;
    isActive?: boolean;
    templateSubject?: string;
    templateBody?: string;
    emailCc?: string;
    offsetMinutes?: number;
    attachments?: unknown[];
    updatedAt?: string;
  }[];
}) {
  return JSON.stringify({
    settings: {
      automationsEnabled: snapshot.settings?.automationsEnabled,
      n8nWebhookBase: snapshot.settings?.n8nWebhookBase,
    },
    endpoints: (snapshot.endpoints || []).map((e) => ({
      channel: e.channel,
      isEnabled: e.isEnabled,
      webhookUrl: e.webhookUrl,
      provider: e.provider,
    })),
    waha: {
      apiUrl: snapshot.waha?.apiUrl,
      apiKey: snapshot.waha?.apiKey,
      sessionName: snapshot.waha?.sessionName,
      isEnabled: snapshot.waha?.isEnabled,
    },
    healthCheck: {
      webhookUrl: snapshot.healthCheck?.webhookUrl,
      httpMethod: snapshot.healthCheck?.httpMethod,
    },
    rules: (snapshot.rules || []).map((r) => ({
      id: r.id,
      name: r.name,
      isActive: r.isActive,
      templateSubject: r.templateSubject,
      templateBody: r.templateBody,
      emailCc: r.emailCc,
      offsetMinutes: r.offsetMinutes,
      attachmentsCount: r.attachments?.length ?? 0,
      updatedAt: r.updatedAt,
    })),
  });
}

/** True once bootstrap has finished hydrating (or seeding) automation app_config. */
export function isAutomationConfigPersistReady() {
  return erpAutomationConfigPersistReady || crmAutomationConfigPersistReady;
}

/**
 * Drop any queued automation writes, then allow subsequent toggles to persist.
 * Call after hydrateCrmAutomationFromServer / hydrateAutomationFromServer (or empty seed).
 */
export function markAutomationConfigPersistReady(opts?: { erp?: boolean; crm?: boolean }) {
  const markErp = opts?.erp !== false;
  const markCrm = opts?.crm !== false;
  if (markErp) {
    cancelServerSyncDebounced("automation-config");
    erpAutomationConfigPersistReady = true;
    lastKnownErpConfigHash = computeAutomationConfigHash(automationSnapshot());
  }
  if (markCrm) {
    cancelServerSyncDebounced("crm-automation-config");
    crmAutomationConfigPersistReady = true;
    lastKnownCrmConfigHash = computeAutomationConfigHash(crmAutomationSnapshot());
  }
}

/** Used when the session ends so the next login re-gates against server state. */
export function resetAutomationConfigPersistReady() {
  erpAutomationConfigPersistReady = false;
  crmAutomationConfigPersistReady = false;
  lastKnownErpConfigHash = "";
  lastKnownCrmConfigHash = "";
  cancelServerSyncDebounced("automation-config");
  cancelServerSyncDebounced("crm-automation-config");
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
  if (!canPersistAppConfig() || !erpAutomationConfigPersistReady) return;
  const snap = automationSnapshot();
  const hash = computeAutomationConfigHash(snap);
  if (hash === lastKnownErpConfigHash) return;
  lastKnownErpConfigHash = hash;
  serverSyncDebounced("automation-config", 400, () =>
    setAppConfig({ data: { key: "automation", value: snap } }),
  );
}

function persistCrmAutomationConfig() {
  if (!canPersistAppConfig() || !crmAutomationConfigPersistReady) return;
  const snap = crmAutomationSnapshot();
  const hash = computeAutomationConfigHash(snap);
  if (hash === lastKnownCrmConfigHash) return;
  lastKnownCrmConfigHash = hash;
  serverSyncDebounced("crm-automation-config", 400, () =>
    setAppConfig({ data: { key: "crm-automation", value: snap } }),
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

/** Force pending ERP master config to SQLite now. */
export function flushMasterConfigPersistence() {
  if (!canPersistAppConfig()) return;
  flushServerSyncDebounced("master-config");
  void setAppConfig({ data: { key: "master", value: masterSnapshot() } });
}

/** Write the current ERP automation config to SQLite and wait until the write finishes. */
export async function persistAutomationConfigNow() {
  if (!canPersistAppConfig()) {
    throw new Error("Only an admin can save automation settings");
  }
  if (!erpAutomationConfigPersistReady) {
    if (useAutomationStore.getState().seeded) {
      erpAutomationConfigPersistReady = true;
    } else {
      throw new Error("Automation settings are still loading. Wait a moment and save again.");
    }
  }
  cancelServerSyncDebounced("automation-config");
  const snap = automationSnapshot();
  lastKnownErpConfigHash = computeAutomationConfigHash(snap);
  await setAppConfig({ data: { key: "automation", value: snap } });
}

/** Write the current CRM automation rules to SQLite and wait until the write finishes. */
export async function persistCrmAutomationConfigNow() {
  if (!canPersistAppConfig()) {
    throw new Error("Only an admin can save automation rules");
  }
  if (!crmAutomationConfigPersistReady) {
    if (useCrmAutomationStore.getState().seeded) {
      crmAutomationConfigPersistReady = true;
    } else {
      throw new Error("Automation settings are still loading. Wait a moment and save again.");
    }
  }
  cancelServerSyncDebounced("crm-automation-config");
  const snap = crmAutomationSnapshot();
  lastKnownCrmConfigHash = computeAutomationConfigHash(snap);
  await setAppConfig({ data: { key: "crm-automation", value: snap } });
}

/** Force pending automation config to SQLite now (settings/rules — logs sync separately). */
export function flushAutomationConfigPersistence(opts?: { erp?: boolean; crm?: boolean }) {
  if (!canPersistAppConfig()) return;
  const flushErp = opts?.erp !== false;
  const flushCrm = opts?.crm !== false;
  if (flushErp && erpAutomationConfigPersistReady) {
    flushServerSyncDebounced("automation-config");
  }
  if (flushCrm && crmAutomationConfigPersistReady) {
    flushServerSyncDebounced("crm-automation-config");
  }
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
      flushMasterConfigPersistence();
      flushServerSyncDebounced("crm-master-config");
    }
  };
  window.addEventListener("beforeunload", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
