import { useMemo } from "react";
import { MODULE_CATALOG, normalizeCompanyModules } from "@/data/module-catalog";
import type { ModuleKey } from "@/types";
import { calcPostSalesProjectProgress } from "@/lib/post-sales-status";
import { calcChecklistProgress } from "@/lib/checklist";
import {
  calcManualGroupProgress,
  isCompanyModulesAllLive,
  MODULE_MILESTONE_GROUPS,
} from "@/lib/module-progress";
import { useActivityStore } from "./useActivityStore";
import { useCompanyStore } from "./useCompanyStore";
import { useOnboardingStore } from "./useOnboardingStore";
import { useProjectProgressStore } from "./useProjectProgressStore";
import { useProjectStore } from "./useProjectStore";
import { usePostSalesStore } from "./usePostSalesStore";
import { useTicketStore } from "./useTicketStore";
import { useEmployeeStore } from "./useEmployeeStore";
import { getDaysUntilExpiry, getRenewalUrgency } from "./useRenewalStore";

function calcOnboardingProjectProgress(
  projectId: string,
  checklistItems: ReturnType<typeof useOnboardingStore.getState>["checklistItems"],
) {
  return calcChecklistProgress(checklistItems.filter((i) => i.projectId === projectId));
}

/**
 * Project card / list progress: higher of onboarding checklist and Progress Tracker,
 * so Mark all on the tracker is reflected on project cards.
 */
function calcCombinedProjectProgress(
  projectId: string,
  checklistItems: ReturnType<typeof useOnboardingStore.getState>["checklistItems"],
) {
  const checklist = calcOnboardingProjectProgress(projectId, checklistItems);
  const manual = useProjectProgressStore.getState().calcPercent(projectId);
  return Math.max(checklist, manual);
}

export function getModuleProgressPercent(
  companyId: string,
  moduleKey: ModuleKey,
  postSalesProjects: ReturnType<typeof usePostSalesStore.getState>["projects"],
): number {
  if (moduleKey === "post-sales") {
    const projects = postSalesProjects.filter((p) => p.companyId === companyId);
    if (projects.length === 0) return 0;
    const total = projects.reduce((sum, p) => sum + calcPostSalesProjectProgress(p), 0);
    return Math.round(total / projects.length);
  }

  const groups = MODULE_MILESTONE_GROUPS[moduleKey];
  if (!groups) return 0;

  const projectIds = useProjectStore
    .getState()
    .projects.filter((p) => p.companyId === companyId)
    .map((p) => p.id);
  const progressRows = projectIds
    .map((id) => useProjectProgressStore.getState().byProjectId[id])
    .filter(Boolean);
  return calcManualGroupProgress(progressRows, groups);
}

export function getCompanyOverallProgress(
  companyId: string,
  modules: { moduleKey: ModuleKey; optedIn: boolean }[],
  postSalesProjects: ReturnType<typeof usePostSalesStore.getState>["projects"],
): number {
  const opted = modules.filter((m) => m.optedIn);
  if (opted.length === 0) return 0;
  const total = opted.reduce(
    (sum, m) => sum + getModuleProgressPercent(companyId, m.moduleKey, postSalesProjects),
    0,
  );
  return Math.round(total / opted.length);
}

export function useCompanyProgress(companyId: string) {
  const company = useCompanyStore((s) => s.companies.find((c) => c.id === companyId));
  const postSalesProjects = usePostSalesStore((s) => s.projects);
  const projects = useProjectStore((s) => s.projects);
  const progressByProject = useProjectProgressStore((s) => s.byProjectId);

  return useMemo(() => {
    if (!company) return 0;
    const modules = normalizeCompanyModules(company.modules);
    return getCompanyOverallProgress(companyId, modules, postSalesProjects);
  }, [company, companyId, postSalesProjects, projects, progressByProject]);
}

export function useModuleProgress(companyId: string, moduleKey: ModuleKey) {
  const postSalesProjects = usePostSalesStore((s) => s.projects);
  const projects = useProjectStore((s) => s.projects);
  const progressByProject = useProjectProgressStore((s) => s.byProjectId);
  return useMemo(
    () => getModuleProgressPercent(companyId, moduleKey, postSalesProjects),
    [companyId, moduleKey, postSalesProjects, projects, progressByProject],
  );
}

export function useCompanyModulesWithProgress(companyId: string) {
  const company = useCompanyStore((s) => s.companies.find((c) => c.id === companyId));
  const postSalesProjects = usePostSalesStore((s) => s.projects);
  const projects = useProjectStore((s) => s.projects);
  const progressByProject = useProjectProgressStore((s) => s.byProjectId);

  return useMemo(() => {
    if (!company) return [];
    const modules = normalizeCompanyModules(company.modules);
    return modules.map((m) => {
      const progressPercent = m.optedIn
        ? getModuleProgressPercent(companyId, m.moduleKey, postSalesProjects)
        : 0;
      return {
        ...m,
        progressPercent,
        isLive: Boolean(m.liveAt) || progressPercent >= 100,
      };
    });
  }, [company, companyId, postSalesProjects, projects, progressByProject]);
}

export function companyIsLive(companyId: string): boolean {
  const company = useCompanyStore.getState().companies.find((c) => c.id === companyId);
  if (!company) return false;
  const modules = normalizeCompanyModules(company.modules);
  const opted = modules.filter((m) => m.optedIn);
  if (opted.length === 0) return false;
  const postSalesProjects = usePostSalesStore.getState().projects;
  return opted.every((m) => {
    if (m.liveAt) return true;
    return getModuleProgressPercent(companyId, m.moduleKey, postSalesProjects) >= 100;
  });
}

export function usePostSalesProjectsForCompany(companyId: string) {
  const projects = usePostSalesStore((s) => s.projects);
  return useMemo(
    () =>
      projects
        .filter((p) => p.companyId === companyId)
        .map((p) => ({
          ...p,
          progress: calcPostSalesProjectProgress(p),
          stepsDone: p.steps.filter((s) => s.approvalStatus === "approved").length,
        }))
        .sort((a, b) => a.projectNumber.localeCompare(b.projectNumber)),
    [projects, companyId],
  );
}

export function useCompanyWithComputed(companyId: string) {
  const company = useCompanyStore((s) => s.companies.find((c) => c.id === companyId));
  const projects = useProjectStore((s) => s.projects);
  const employees = useEmployeeStore((s) => s.employees);
  const progress = useCompanyProgress(companyId);

  return useMemo(() => {
    if (!company) return undefined;
    const manager = employees.find((e) => e.id === company.onboardingManagerId);
    const csm = employees.find((e) => e.id === company.csmId);
    const projectCount = projects.filter((p) => p.companyId === companyId).length;
    return { ...company, progress, projectCount, manager, csm };
  }, [company, employees, projects, companyId, progress]);
}

export function useDashboardKpis() {
  const companies = useCompanyStore((s) => s.companies);
  const tickets = useTicketStore((s) => s.tickets);
  const postSalesProjects = usePostSalesStore((s) => s.projects);
  const progressByProject = useProjectProgressStore((s) => s.byProjectId);

  return useMemo(() => {
    const companiesWithProgress = companies.map((c) => {
      const modules = normalizeCompanyModules(c.modules);
      const progress = getCompanyOverallProgress(c.id, modules, postSalesProjects);
      const live =
        isCompanyModulesAllLive(modules) ||
        (modules.filter((m) => m.optedIn).length > 0 &&
          modules
            .filter((m) => m.optedIn)
            .every(
              (m) =>
                Boolean(m.liveAt) ||
                getModuleProgressPercent(c.id, m.moduleKey, postSalesProjects) >= 100,
            ));
      const computedStatus = live
        ? ("completed" as const)
        : progress > 0
          ? ("in_progress" as const)
          : c.status;
      return { ...c, progress, computedStatus, isLive: live };
    });

    const openTickets = tickets.filter((t) => t.status !== "Closed").length;
    const upcomingRenewals = companies.filter((c) => {
      const u = getRenewalUrgency(c.planExpiry);
      return u === "upcoming" || u === "urgent";
    }).length;

    return {
      totalCompanies: companies.length,
      activeOnboarding: companiesWithProgress.filter((c) => c.computedStatus === "in_progress").length,
      completed: companiesWithProgress.filter((c) => c.isLive || c.computedStatus === "completed").length,
      onHold: companiesWithProgress.filter((c) => c.status === "on_hold").length,
      pendingTasks: openTickets,
      upcomingRenewals,
      companiesWithProgress,
    };
  }, [companies, tickets, postSalesProjects, progressByProject]);
}

export function useModuleAdoption() {
  const companies = useCompanyStore((s) => s.companies);

  return useMemo(
    () =>
      MODULE_CATALOG.map((mod) => ({
        name: mod.label,
        opted: companies.filter((c) => c.modules.some((m) => m.moduleKey === mod.key && m.optedIn)).length,
      })),
    [companies],
  );
}

export function useAccountHealth() {
  const companies = useCompanyStore((s) => s.companies);

  return useMemo(
    () => ({
      Healthy: companies.filter((c) => c.health === "Healthy").length,
      Moderate: companies.filter((c) => c.health === "Moderate").length,
      Critical: companies.filter((c) => c.health === "Critical").length,
    }),
    [companies],
  );
}

export function useRecentActivity(limit = 8) {
  const activities = useActivityStore((s) => s.activities);

  return useMemo(
    () => [...activities].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit),
    [activities, limit],
  );
}

export function useUpcomingRenewals(limit = 5) {
  const companies = useCompanyStore((s) => s.companies);

  return useMemo(
    () =>
      [...companies]
        .map((c) => ({
          ...c,
          daysLeft: getDaysUntilExpiry(c.planExpiry),
          urgency: getRenewalUrgency(c.planExpiry),
        }))
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .slice(0, limit),
    [companies, limit],
  );
}

export function useProjectWithProgress(projectId: string) {
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  const checklistItems = useOnboardingStore((s) => s.checklistItems);
  const companies = useCompanyStore((s) => s.companies);

  return useMemo(() => {
    if (!project) return undefined;
    const progress = calcOnboardingProjectProgress(projectId, checklistItems);
    const company = companies.find((c) => c.id === project.companyId);
    return { ...project, progress, companyName: company?.name ?? "" };
  }, [project, checklistItems, companies, projectId]);
}

export function useGlobalSearch(query: string) {
  const q = query.toLowerCase().trim();
  const companies = useCompanyStore((s) => s.companies);
  const projects = useProjectStore((s) => s.projects);
  const employees = useEmployeeStore((s) => s.employees);

  return useMemo(() => {
    if (!q) return { companies: [], projects: [], managers: [] as typeof employees };

    return {
      companies: companies
        .filter((c) => c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q))
        .slice(0, 5),
      projects: projects
        .filter((p) => p.name.toLowerCase().includes(q) || p.city.toLowerCase().includes(q))
        .slice(0, 5),
      managers: employees.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 3),
    };
  }, [q, companies, projects, employees]);
}

export { calcCombinedProjectProgress as calcProjectProgress };
