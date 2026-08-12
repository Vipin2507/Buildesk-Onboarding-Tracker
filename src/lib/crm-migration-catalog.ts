import {
  CRM_MIGRATION_CATEGORIES,
  CRM_MIGRATION_CHECKLIST_LABELS,
  seedCrmMigrationFields,
} from "@/data/crm-onboarding-defaults";
import { getCrmMasterMigrationFields } from "@/stores/useCrmMasterStore";
import type { CrmMigrationFieldDef } from "@/types/crm-master";

export { seedCrmMigrationFields };

/** Active migration catalog from Master (falls back to seed). */
export function resolveCrmMigrationCatalog(): CrmMigrationFieldDef[] {
  return getCrmMasterMigrationFields();
}

export function resolveCrmMigrationCategories(
  catalog: CrmMigrationFieldDef[] = resolveCrmMigrationCatalog(),
): string[] {
  const preferred = [...CRM_MIGRATION_CATEGORIES];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const cat of preferred) {
    if (catalog.some((f) => f.category === cat) && !seen.has(cat)) {
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
  return out;
}

/** Seed labels used when Master store is unavailable (SSR / tests). */
export function defaultCrmMigrationCatalog(): typeof CRM_MIGRATION_CHECKLIST_LABELS {
  return CRM_MIGRATION_CHECKLIST_LABELS;
}
