import { syncCompanyModuleLabels } from "@/lib/api";
import { MODULE_CATALOG } from "@/data/module-catalog";
import { isAdminRoleKey } from "@/lib/permissions";
import { useAuthStore } from "@/stores/useAuthStore";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { useMasterStore } from "@/stores/useMasterStore";
import type { ModuleKey } from "@/types";

let syncInFlight: Promise<{ updated: number } | null> | null = null;

/**
 * Push Master Config module labels into company_modules (DB + local store).
 * Safe to call after master hydrate or when a module is renamed.
 */
export async function syncMasterModuleLabelsToCompanies(): Promise<{ updated: number } | null> {
  const user = useAuthStore.getState().user;
  if (!user || !isAdminRoleKey(user.role)) return null;

  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    try {
      const masterModules = useMasterStore.getState().modules;
      const byKey = new Map(masterModules.map((m) => [m.key, m.label.trim()]));
      const labels = MODULE_CATALOG.map((c) => ({
        moduleKey: c.key,
        label: byKey.get(c.key) || c.label,
      })).filter((row) => row.label.length > 0);

      if (labels.length === 0) return { updated: 0 };

      const result = await syncCompanyModuleLabels({ data: { labels } });

      const labelMap = new Map(labels.map((l) => [l.moduleKey as ModuleKey, l.label]));
      useCompanyStore.setState((s) => ({
        companies: s.companies.map((company) => ({
          ...company,
          modules: (company.modules ?? []).map((mod) => {
            const nextLabel = labelMap.get(mod.moduleKey);
            return nextLabel && nextLabel !== mod.label ? { ...mod, label: nextLabel } : mod;
          }),
        })),
      }));

      return { updated: result.updated };
    } catch (err) {
      console.warn("[sync] Master module labels → companies failed", err);
      return null;
    } finally {
      syncInFlight = null;
    }
  })();

  return syncInFlight;
}
