import { purgeLegacyEntityCaches } from "./persist";
import { useMasterStore } from "./useMasterStore";
import { useSettingsStore } from "./useSettingsStore";
import { useCompanyPortalStore } from "./useCompanyPortalStore";
import { useAutomationStore } from "./useAutomationStore";
import { useChatStore } from "./useChatStore";

/** Config stores persist to disk; entity data (incl. design tickets) loads from SQLite. */
const persistedStores = [
  useMasterStore,
  useSettingsStore,
  useCompanyPortalStore,
  useAutomationStore,
  useChatStore,
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
