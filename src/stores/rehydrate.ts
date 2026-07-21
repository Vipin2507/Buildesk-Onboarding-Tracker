import { purgeLegacyEntityCaches } from "./persist";
import { useMasterStore } from "./useMasterStore";
import { useSettingsStore } from "./useSettingsStore";
import { useDesignTicketStore } from "./useDesignTicketStore";
import { useCompanyPortalStore } from "./useCompanyPortalStore";

/** Config + client-portal ticket stores persist to disk; entity data loads from SQLite. */
const persistedStores = [
  useMasterStore,
  useSettingsStore,
  useDesignTicketStore,
  useCompanyPortalStore,
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
