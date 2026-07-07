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
] as const;

export async function rehydrateAllStores() {
  await Promise.all(stores.map((store) => store.persist.rehydrate()));
}
