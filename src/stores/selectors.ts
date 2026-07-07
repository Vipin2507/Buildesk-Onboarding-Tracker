import { useMemo } from "react";
import { MODULES } from "@/data/constants";
import { useActivityStore } from "./useActivityStore";
import { useCompanyStore } from "./useCompanyStore";
import { useOnboardingStore } from "./useOnboardingStore";
import { useProjectStore } from "./useProjectStore";
import { useTicketStore } from "./useTicketStore";
import { useEmployeeStore } from "./useEmployeeStore";
import { getDaysUntilExpiry, getRenewalUrgency } from "./useRenewalStore";

function calcProjectProgress(
  projectId: string,
  checklistItems: ReturnType<typeof useOnboardingStore.getState>["checklistItems"],
) {
  const items = checklistItems.filter((i) => i.projectId === projectId);
  if (items.length === 0) return 0;
  const total = items.length * 3;
  const done = items.reduce((sum, i) => sum + (i.collected ? 1 : 0) + (i.uploaded ? 1 : 0) + (i.live ? 1 : 0), 0);
  return Math.round((done / total) * 100);
}

export function useCompanyProgress(companyId: string) {
  const projects = useProjectStore((s) => s.projects);
  const checklistItems = useOnboardingStore((s) => s.checklistItems);

  return useMemo(() => {
    const companyProjects = projects.filter((p) => p.companyId === companyId);
    if (companyProjects.length === 0) return 0;
    const total = companyProjects.reduce((sum, p) => sum + calcProjectProgress(p.id, checklistItems), 0);
    return Math.round(total / companyProjects.length);
  }, [projects, checklistItems, companyId]);
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
  const projects = useProjectStore((s) => s.projects);
  const checklistItems = useOnboardingStore((s) => s.checklistItems);

  return useMemo(() => {
    const companiesWithProgress = companies.map((c) => {
      const companyProjects = projects.filter((p) => p.companyId === c.id);
      const progress =
        companyProjects.length > 0
          ? Math.round(
              companyProjects.reduce((sum, p) => sum + calcProjectProgress(p.id, checklistItems), 0) /
                companyProjects.length,
            )
          : 0;
      const computedStatus =
        progress >= 100 ? ("completed" as const) : progress > 0 ? ("in_progress" as const) : c.status;
      return { ...c, progress, computedStatus };
    });

    const openTickets = tickets.filter((t) => t.status !== "Closed").length;
    const upcomingRenewals = companies.filter((c) => {
      const u = getRenewalUrgency(c.planExpiry);
      return u === "upcoming" || u === "urgent";
    }).length;

    return {
      totalCompanies: companies.length,
      activeOnboarding: companiesWithProgress.filter((c) => c.computedStatus === "in_progress").length,
      completed: companiesWithProgress.filter((c) => c.computedStatus === "completed").length,
      onHold: companiesWithProgress.filter((c) => c.status === "on_hold").length,
      pendingTasks: openTickets,
      upcomingRenewals,
      companiesWithProgress,
    };
  }, [companies, tickets, projects, checklistItems]);
}

export function useModuleAdoption() {
  const companies = useCompanyStore((s) => s.companies);

  return useMemo(
    () =>
      MODULES.map((mod) => ({
        name: mod.replace(" Management", "").replace(" (General)", ""),
        opted: companies.filter((c) => c.modules.includes(mod)).length,
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
    const progress = calcProjectProgress(projectId, checklistItems);
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

export { calcProjectProgress };
