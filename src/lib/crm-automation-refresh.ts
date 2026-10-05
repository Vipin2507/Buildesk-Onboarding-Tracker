import { getAppConfig } from "@/lib/api";
import {
  hydrateCrmAutomationFromServer,
  useCrmAutomationStore,
} from "@/stores/useCrmAutomationStore";
import type { WahaConfig } from "@/types/automation";

/**
 * Pull authoritative CRM automation / WAHA settings from SQLite into the client store.
 * Use before client-side WAHA calls so executives don't keep a stale sessionName
 * from localStorage after an admin update.
 */
export async function pullCrmAutomationConfigFromServer(): Promise<WahaConfig> {
  try {
    const snapshot = await getAppConfig({ data: { key: "crm-automation" } });
    if (snapshot && typeof snapshot === "object" && Object.keys(snapshot).length > 0) {
      hydrateCrmAutomationFromServer(snapshot as Record<string, unknown>);
    }
  } catch (err) {
    console.warn("[crm-automation] refresh from server failed", err);
  }
  return useCrmAutomationStore.getState().waha;
}
