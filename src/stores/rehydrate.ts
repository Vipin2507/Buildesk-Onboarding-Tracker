import { purgeLegacyEntityCaches } from "./persist";
import { useMasterStore } from "./useMasterStore";
import { useSettingsStore } from "./useSettingsStore";
import { useCompanyPortalStore } from "./useCompanyPortalStore";
import { useAutomationStore } from "./useAutomationStore";
import { useChatStore } from "./useChatStore";
import { useCrmOnboardingStore } from "./useCrmOnboardingStore";
import { useCrmAccountStore } from "./useCrmAccountStore";
import { useCrmMasterStore } from "./useCrmMasterStore";
import { useCrmSettingsStore } from "./useCrmSettingsStore";

/** Config / CRM client stores persist to disk; ERP entity data loads from SQLite. */
const persistedStores = [
  useMasterStore,
  useSettingsStore,
  useCompanyPortalStore,
  useAutomationStore,
  useChatStore,
  useCrmOnboardingStore,
  useCrmAccountStore,
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
