import { useActivityStore } from "./useActivityStore";
import { useCompanyStore } from "./useCompanyStore";
import { useProjectStore } from "./useProjectStore";
import { useOnboardingStore } from "./useOnboardingStore";
import { useVendorStore } from "./useVendorStore";
import { useLaborStore } from "./useLaborStore";
import { useTicketStore } from "./useTicketStore";
import { useTrainingStore } from "./useTrainingStore";
import { useEmployeeStore } from "./useEmployeeStore";
import { useUserStore } from "./useUserStore";
import { useDocumentStore } from "./useDocumentStore";
import { useIntegrationStore } from "./useIntegrationStore";
import { usePostSalesStore } from "./usePostSalesStore";
import { useNotesAttachmentsStore } from "./useNotesAttachmentsStore";
import { useMasterStore } from "./useMasterStore";
import { useSettingsStore } from "./useSettingsStore";
import { useProjectProgressStore } from "./useProjectProgressStore";

const stores = [
  useActivityStore,
  useCompanyStore,
  useProjectStore,
  useOnboardingStore,
  useVendorStore,
  useLaborStore,
  useTicketStore,
  useTrainingStore,
  useEmployeeStore,
  useUserStore,
  useDocumentStore,
  useIntegrationStore,
  usePostSalesStore,
  useNotesAttachmentsStore,
  useMasterStore,
  useSettingsStore,
  useProjectProgressStore,
] as const;

export async function rehydrateAllStores() {
  await Promise.all(
    stores.map(async (store) => {
      if ("persist" in store && store.persist?.rehydrate) {
        await store.persist.rehydrate();
      }
    }),
  );
}
