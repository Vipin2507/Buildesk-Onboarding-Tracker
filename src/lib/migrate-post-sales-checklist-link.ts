import { normalizeEntityName } from "@/lib/project-sheet-import";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { usePostSalesStore } from "@/stores/usePostSalesStore";
import { useProjectStore } from "@/stores/useProjectStore";

const MIGRATION_KEY = "buildesk-post-sales-checklist-v2";

/**
 * Post Sales uses the onboarding checklist workflow (Project + checklist items).
 * - Recovers any legacy Post Sales step-tracker projects as checklist projects
 * - Enables the post-sales module for companies that have checklist projects
 */
export function migratePostSalesChecklistLink(): { recovered: number; enabled: number } {
  if (typeof localStorage !== "undefined" && localStorage.getItem(MIGRATION_KEY) === "done") {
    return { recovered: 0, enabled: 0 };
  }

  const { addProject } = useProjectStore.getState();
  const { deleteProject: deletePostSalesProject } = usePostSalesStore.getState();
  const { enableModule } = useCompanyStore.getState();

  let recovered = 0;

  for (const ps of [...usePostSalesStore.getState().projects]) {
    const exists = useProjectStore
      .getState()
      .projects.some(
        (p) =>
          p.companyId === ps.companyId &&
          normalizeEntityName(p.name) === normalizeEntityName(ps.projectName),
      );

    if (!exists) {
      const company = useCompanyStore.getState().getById(ps.companyId);
      addProject({
        name: ps.projectName,
        companyId: ps.companyId,
        type: "Residential",
        units: 0,
        city: company?.city && company.city !== "—" ? company.city : "—",
        rera: "",
        status: "not_started",
        currentStep: 0,
        startDate: company?.startDate || new Date().toISOString().slice(0, 10),
      });
      recovered += 1;
    }

    deletePostSalesProject(ps.id);
  }

  let enabled = 0;
  const companyIds = new Set(useProjectStore.getState().projects.map((p) => p.companyId));
  for (const companyId of companyIds) {
    const company = useCompanyStore.getState().getById(companyId);
    if (!company) continue;
    const postSalesModule = company.modules?.find((m) => m.moduleKey === "post-sales");
    if (!postSalesModule?.optedIn) {
      enableModule(companyId, "post-sales");
      enabled += 1;
    }
  }

  if (typeof localStorage !== "undefined") localStorage.setItem(MIGRATION_KEY, "done");
  return { recovered, enabled };
}
