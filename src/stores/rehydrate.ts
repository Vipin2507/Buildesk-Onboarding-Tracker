import { purgeLegacyEntityCaches } from "./persist";
import { useMasterStore } from "./useMasterStore";
import { useSettingsStore } from "./useSettingsStore";
import { useCompanyPortalStore } from "./useCompanyPortalStore";
import { useAutomationStore } from "./useAutomationStore";
import { useCrmAutomationStore } from "./useCrmAutomationStore";
import { useChatStore } from "./useChatStore";
import { useCrmMasterStore } from "./useCrmMasterStore";
import { useCrmSettingsStore } from "./useCrmSettingsStore";

/** Config stores persist to disk; CRM accounts / onboarding / ERP entities load from SQLite. */
const persistedStores = [
  useMasterStore,
  useSettingsStore,
  useCompanyPortalStore,
  useAutomationStore,
  useCrmAutomationStore,
  useChatStore,
  useCrmMasterStore,
  useCrmSettingsStore,
] as const;

export async function rehydrateAllStores() {
  purgeLegacyEntityCaches();
  await Promise.all(
    persistedStores.map(async (store) => {
      if ("persist" in store && store.persist?.rehydrate) {
        await store.persist.rehydrate();
      }
    }),
  );
}
