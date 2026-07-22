import { useMemo } from "react";

import { getChecklistPhaseBucket, summarizeChecklistPhases } from "@/lib/checklist";
import type { ChecklistPhaseBucket } from "@/lib/checklist";
import { isTicketOpen } from "@/lib/tickets";
import { getDaysUntilExpiry, getRenewalUrgency } from "@/stores/useRenewalStore";
import { useCompanyStore } from "./useCompanyStore";
import { useOnboardingStore } from "./useOnboardingStore";
import { useProjectStore } from "./useProjectStore";
import { usePostSalesStore } from "./usePostSalesStore";
import { useProjectProgressStore } from "./useProjectProgressStore";
import { useTicketStore } from "./useTicketStore";
import { useTaskStore } from "./useTaskStore";
import { useClientVisitStore } from "./useClientVisitStore";
import { useDesignTicketStore } from "./useDesignTicketStore";
import { useDashboardKpis } from "./selectors";
import { isDesignTicketActive } from "./design-ticket-selectors";
import type { Company, OnboardingChecklistItem } from "@/types";

export type CompanyStatusFilter =
  | "all"
  | "in_progress"
  | "completed"
  | "on_hold"
  | "review"
  | "not_started";

export type DashboardDrillDownFilter =
  | { type: "companies"; status: CompanyStatusFilter }
  | { type: "checklist"; phase: ChecklistPhaseBucket }
  | { type: "support_tickets" }
  | { type: "design_tickets" }
  | { type: "follow_ups"; scope: "overdue" | "due_today" | "open" }
  | { type: "visits" }
  | { type: "renewals" }
  | { type: "account_health"; health: "Healthy" | "Moderate" | "Critical" };

export type ChecklistDrillDownRow = {
  item: OnboardingChecklistItem;
  projectId: string;
  projectName: string;
  companyId: string;
  companyName: string;
  phase: ChecklistPhaseBucket;
};

export type ChecklistCompanyGroup = {
  companyId: string;
  companyName: string;
  projects: {
    projectId: string;
    projectName: string;
    items: ChecklistDrillDownRow[];
  }[];
};

function filterCompaniesByStatus(
  companies: ReturnType<typeof useDashboardKpis>["companiesWithProgress"],
  status: CompanyStatusFilter,
) {
  if (status === "all") return companies;
  if (status === "completed") {
    return companies.filter((c) => c.isLive || c.computedStatus === "completed");
  }
  if (status === "in_progress") {
    return companies.filter((c) => c.computedStatus === "in_progress");
  }
  if (status === "on_hold") return companies.filter((c) => c.status === "on_hold");
  if (status === "review") return companies.filter((c) => c.computedStatus === "review");
  return companies.filter((c) => c.computedStatus === "not_started");
}

export function groupChecklistByCompanyProject(rows: ChecklistDrillDownRow[]): ChecklistCompanyGroup[] {
  const byCompany = new Map<string, ChecklistCompanyGroup>();

  for (const row of rows) {
    let company = byCompany.get(row.companyId);
    if (!company) {
      company = { companyId: row.companyId, companyName: row.companyName, projects: [] };
      byCompany.set(row.companyId, company);
    }
    let project = company.projects.find((p) => p.projectId === row.projectId);
    if (!project) {
      project = { projectId: row.projectId, projectName: row.projectName, items: [] };
      company.projects.push(project);
    }
    project.items.push(row);
  }

  return [...byCompany.values()]
    .sort((a, b) => a.companyName.localeCompare(b.companyName))
    .map((company) => ({
      ...company,
      projects: company.projects
        .sort((a, b) => a.projectName.localeCompare(b.projectName))
        .map((project) => ({
          ...project,
          items: project.items.sort((a, b) => a.item.label.localeCompare(b.item.label)),
        })),
    }));
}

export function useDashboardOverview() {
  const kpis = useDashboardKpis();
  const checklistItems = useOnboardingStore((s) => s.checklistItems);
  const projects = useProjectStore((s) => s.projects);
  const companies = useCompanyStore((s) => s.companies);
  const tickets = useTicketStore((s) => s.tickets);
  const followUpTasks = useTaskStore((s) => s.tasks);
  const clientVisits = useClientVisitStore((s) => s.visits);
  const designTickets = useDesignTicketStore((s) => s.tickets);

  void usePostSalesStore((s) => s.projects);
  void useProjectProgressStore((s) => s.byProjectId);

  return useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const phaseStats = summarizeChecklistPhases(checklistItems);

    const checklistRows: ChecklistDrillDownRow[] = [];
    for (const item of checklistItems) {
      const phase = getChecklistPhaseBucket(item);
      if (!phase) continue;
      const project = projects.find((p) => p.id === item.projectId);
      if (!project) continue;
      const company = companies.find((c) => c.id === project.companyId);
      checklistRows.push({
        item,
        projectId: project.id,
        projectName: project.name,
        companyId: project.companyId,
        companyName: company?.name ?? "Unknown company",
        phase,
      });
    }

    const openFollowUps = followUpTasks.filter((t) =>
      ["open", "in_progress", "blocked"].includes(t.status),
    );

    const renewalRows = companies
      .map((c) => ({
        ...c,
        daysLeft: getDaysUntilExpiry(c.planExpiry),
        urgency: getRenewalUrgency(c.planExpiry),
      }))
      .filter((c) => c.urgency === "upcoming" || c.urgency === "urgent")
      .sort((a, b) => a.daysLeft - b.daysLeft);

    const openDesignTickets = designTickets.filter((t) => isDesignTicketActive(t.status));

    function getChecklistGroups(phase: ChecklistPhaseBucket) {
      return groupChecklistByCompanyProject(checklistRows.filter((r) => r.phase === phase));
    }

    function getCompanies(status: CompanyStatusFilter) {
      return filterCompaniesByStatus(kpis.companiesWithProgress, status);
    }

    function resolveDrillDown(filter: DashboardDrillDownFilter) {
      switch (filter.type) {
        case "companies":
          return { kind: "companies" as const, companies: getCompanies(filter.status) };
        case "checklist":
          return { kind: "checklist" as const, groups: getChecklistGroups(filter.phase) };
        case "support_tickets":
          return {
            kind: "support_tickets" as const,
            tickets: tickets.filter((t) => isTicketOpen(t)),
          };
        case "design_tickets":
          return { kind: "design_tickets" as const, tickets: openDesignTickets };
        case "follow_ups": {
          if (filter.scope === "overdue") {
            const overdueTasks = openFollowUps.filter((t) => t.dueDate && t.dueDate < today);
            const overdueVisits = clientVisits.filter(
              (v) =>
                v.status !== "cancelled" && v.nextFollowUpDate && v.nextFollowUpDate < today,
            );
            return { kind: "follow_ups" as const, tasks: overdueTasks, visits: overdueVisits };
          }
          if (filter.scope === "due_today") {
            return {
              kind: "follow_ups" as const,
              tasks: openFollowUps.filter((t) => t.dueDate === today),
              visits: [],
            };
          }
          return { kind: "follow_ups" as const, tasks: openFollowUps, visits: [] };
        }
        case "visits":
          return {
            kind: "visits" as const,
            visits: clientVisits.filter(
              (v) => v.status === "scheduled" && v.scheduledAt.slice(0, 10) >= today,
            ),
          };
        case "renewals":
          return { kind: "renewals" as const, companies: renewalRows };
        case "account_health":
          return {
            kind: "account_health" as const,
            companies: companies.filter((c) => c.health === filter.health),
          };
      }
    }

    return {
      kpis,
      phaseStats,
      openDesignTickets: openDesignTickets.length,
      getChecklistGroups,
      getCompanies,
      resolveDrillDown,
    };
  }, [
    kpis,
    checklistItems,
    projects,
    companies,
    tickets,
    followUpTasks,
    clientVisits,
    designTickets,
  ]);
}

export function drillDownTitle(filter: DashboardDrillDownFilter): string {
  switch (filter.type) {
    case "companies":
      if (filter.status === "all") return "All Companies";
      if (filter.status === "in_progress") return "Active Onboarding";
      if (filter.status === "completed") return "Completed Companies";
      if (filter.status === "on_hold") return "On Hold";
      if (filter.status === "review") return "Pending Review";
      return "Not Started";
    case "checklist":
      if (filter.phase === "awaiting_collection") return "Awaiting Collection";
      if (filter.phase === "awaiting_upload") return "Awaiting Upload";
      if (filter.phase === "awaiting_live") return "Awaiting Go-Live";
      return "Fully Complete Tasks";
    case "support_tickets":
      return "Open Support Tickets";
    case "design_tickets":
      return "Open Design Tickets";
    case "follow_ups":
      if (filter.scope === "overdue") return "Overdue Follow-ups";
      if (filter.scope === "due_today") return "Due Today";
      return "Open Follow-ups";
    case "visits":
      return "Upcoming Visits";
    case "renewals":
      return "Upcoming Renewals";
    case "account_health":
      return `${filter.health} Accounts`;
  }
}

export function drillDownSubtitle(filter: DashboardDrillDownFilter): string {
  switch (filter.type) {
    case "checklist":
      return "Grouped by company → project → task. Click a task to open onboarding.";
    case "companies":
      return "Click a company to view profile and projects.";
    default:
      return "Click any row to open the detail view.";
  }
}
