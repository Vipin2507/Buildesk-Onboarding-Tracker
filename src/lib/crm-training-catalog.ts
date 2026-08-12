import {
  CRM_TRAINING_CATEGORIES_BROKER,
  CRM_TRAINING_CATEGORIES_DEVELOPER,
  isDeveloperCompanyType,
  seedCrmTrainingFields,
  type CrmTrainingTrack,
} from "@/data/crm-onboarding-defaults";
import { getCrmMasterTrainingFields } from "@/stores/useCrmMasterStore";
import type { CompanyType } from "@/types/company";
import type { CrmTrainingFieldDef } from "@/types/crm-master";

export { seedCrmTrainingFields };
export type { CrmTrainingTrack };

export function trainingTrackForCompanyType(companyType?: CompanyType): CrmTrainingTrack {
  return isDeveloperCompanyType(companyType) ? "developer" : "broker_cp";
}

/** Active training catalog from Master for a track (falls back to seed). */
export function resolveCrmTrainingCatalog(
  track: CrmTrainingTrack = "developer",
): CrmTrainingFieldDef[] {
  return getCrmMasterTrainingFields(track);
}

export function resolveCrmTrainingCatalogForCompany(
  companyType?: CompanyType,
): CrmTrainingFieldDef[] {
  return resolveCrmTrainingCatalog(trainingTrackForCompanyType(companyType));
}

export function resolveCrmTrainingCategories(
  track: CrmTrainingTrack = "developer",
  catalog: CrmTrainingFieldDef[] = resolveCrmTrainingCatalog(track),
): string[] {
  const preferred = [
    ...(track === "broker_cp" ? CRM_TRAINING_CATEGORIES_BROKER : CRM_TRAINING_CATEGORIES_DEVELOPER),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const cat of preferred) {
    if ((cat === "Custom" || catalog.some((f) => f.category === cat)) && !seen.has(cat)) {
      out.push(cat);
      seen.add(cat);
    }
  }
  for (const f of catalog) {
    if (!seen.has(f.category)) {
      out.push(f.category);
      seen.add(f.category);
    }
  }
  if (!seen.has("Custom")) out.push("Custom");
  return out;
}
