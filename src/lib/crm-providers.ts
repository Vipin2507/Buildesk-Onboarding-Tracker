import {
  CRM_MODULE_PROVIDERS,
  CRM_PROVIDER_OTHER,
  moduleRequiresProvider,
  seedCrmModuleProviders,
} from "@/data/crm-onboarding-defaults";
import { getCrmMasterModuleProviders, useCrmMasterStore } from "@/stores/useCrmMasterStore";
import type { CrmProductModuleKey } from "@/types/crm-onboarding";

export { CRM_PROVIDER_OTHER, seedCrmModuleProviders };

/** Named providers from Master (or seed), without the Other sentinel. */
export function namedCrmProvidersFor(key: CrmProductModuleKey): string[] {
  const fromMaster = getCrmMasterModuleProviders()[key];
  const base =
    fromMaster && fromMaster.length > 0
      ? fromMaster
      : (CRM_MODULE_PROVIDERS[key] ?? []);
  return base.filter((p) => p.trim() && p !== CRM_PROVIDER_OTHER);
}

/** Dropdown options including Other. */
export function resolveCrmProviderOptions(key: CrmProductModuleKey): string[] {
  if (!moduleRequiresProvider(key)) return [];
  return [...namedCrmProvidersFor(key), CRM_PROVIDER_OTHER];
}

export function isCustomCrmProvider(key: CrmProductModuleKey, provider: string | undefined) {
  if (!provider?.trim()) return false;
  if (provider === CRM_PROVIDER_OTHER) return true;
  return !namedCrmProvidersFor(key).includes(provider);
}

/** Subscribe-friendly hook for provider option lists. */
export function useCrmProviderOptions(key: CrmProductModuleKey): string[] {
  const moduleProviders = useCrmMasterStore((s) => s.moduleProviders);
  const fromMaster = moduleProviders?.[key];
  const base =
    fromMaster && fromMaster.length > 0
      ? fromMaster
      : (CRM_MODULE_PROVIDERS[key] ?? []);
  const named = base.filter((p) => p.trim() && p !== CRM_PROVIDER_OTHER);
  return moduleRequiresProvider(key) ? [...named, CRM_PROVIDER_OTHER] : [];
}
