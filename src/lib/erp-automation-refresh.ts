import { getAppConfig } from "@/lib/api";
import { hydrateAutomationFromServer, useAutomationStore } from "@/stores/useAutomationStore";
import type { WahaConfig } from "@/types/automation";

/** Pull ERP automation / WAHA settings from SQLite before company WhatsApp calls. */
export async function pullErpAutomationConfigFromServer(): Promise<WahaConfig> {
  try {
    const snapshot = await getAppConfig({ data: { key: "automation" } });
    if (snapshot && typeof snapshot === "object" && Object.keys(snapshot).length > 0) {
      hydrateAutomationFromServer(snapshot as Parameters<typeof hydrateAutomationFromServer>[0]);
    }
  } catch (err) {
    console.warn("[automation] refresh from server failed", err);
  }
  return useAutomationStore.getState().waha;
}
