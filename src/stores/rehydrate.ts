import { purgeLegacyEntityCaches } from "./persist";
import { useMasterStore } from "./useMasterStore";
import { useSettingsStore } from "./useSettingsStore";
import { useCompanyPortalStore } from "./useCompanyPortalStore";
import { useAutomationStore } from "./useAutomationStore";
import { useChatStore } from "./useChatStore";
import { useCrmOnboardingStore } from "./useCrmOnboardingStore";
import { useCrmMasterStore } from "./useCrmMasterStore";
import { useCrmSettingsStore } from "./useCrmSettingsStore";

/** Config stores persist to disk; CRM accounts / ERP entities load from SQLite. */
const persistedStores = [
  useMasterStore,
  useSettingsStore,
  useCompanyPortalStore,
  useAutomationStore,
  useChatStore,
  useCrmOnboardingStore,
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
