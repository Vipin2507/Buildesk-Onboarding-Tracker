import { useMemo } from "react";

import {
  useClientVisitStore,
  useCompanyStore,
  useOnboardingStore,
  useProjectStore,
  useErpTaskStore,
  useTicketStore,
} from "@/stores";
import { isTicketOpen } from "@/lib/tickets";
import type { FollowUpTask } from "@/types";

export type PendingWorkKind = "ticket" | "task" | "checklist" | "visit-followup";

export type PendingWorkItem = {
  id: string;
  kind: PendingWorkKind;
  title: string;
  subtitle: string;
  assigneeUserId?: string;
  dueDate?: string;
  href: string;
  companyId?: string;
  task?: FollowUpTask;
};

export function buildPendingWorkItems(input: {
  tickets: ReturnType<typeof useTicketStore.getState>["tickets"];
  tasks: ReturnType<typeof useErpTaskStore.getState>["tasks"];
  checklist: ReturnType<typeof useOnboardingStore.getState>["checklistItems"];
  visits: ReturnType<typeof useClientVisitStore.getState>["visits"];
  projects: ReturnType<typeof useProjectStore.getState>["projects"];
  companies: ReturnType<typeof useCompanyStore.getState>["companies"];
}): PendingWorkItem[] {
  const { tickets, tasks, checklist, visits, projects, companies } = input;
  const rows: PendingWorkItem[] = [];

  for (const ticket of tickets) {
    if (!isTicketOpen(ticket)) continue;
    const company = companies.find((c) => c.id === ticket.companyId);
    rows.push({
      id: ticket.id,
      kind: "ticket",
      title: ticket.title,
      subtitle: `${ticket.status} · ${company?.name ?? "Unknown company"}`,
      assigneeUserId: ticket.assignedUserId,
      dueDate: ticket.eta || undefined,
      href: `/support/${ticket.id}`,
      companyId: ticket.companyId,
    });
  }

  for (const task of tasks) {
    if (["completed", "cancelled"].includes(task.status)) continue;
    const company = companies.find((c) => c.id === task.companyId);
    rows.push({
      id: task.id,
      kind: "task",
      title: task.title,
      subtitle: `${task.status.replaceAll("_", " ")} · ${company?.name ?? "Unknown company"}`,
      assigneeUserId: task.assigneeUserId,
      dueDate: task.dueDate,
      href: `/companies/${task.companyId}?tab=Tasks`,
      companyId: task.companyId,
      task,
    });
  }

  for (const item of checklist) {
    if (item.notApplicable || item.live) continue;
    const project = projects.find((p) => p.id === item.projectId);
    const company = companies.find((c) => c.id === project?.companyId);
    rows.push({
      id: item.id,
      kind: "checklist",
      title: item.label,
      subtitle: `${project?.name ?? "Unknown project"} · ${
        item.uploaded ? "Awaiting live" : item.collected ? "Awaiting upload" : "Awaiting collection"
      }`,
      assigneeUserId: item.assigneeUserId || company?.onboardingManagerId,
      dueDate: item.dueDate,
      href: `/projects/${item.projectId}?tab=onboarding`,
      companyId: company?.id,
    });
  }

  for (const visit of visits) {
    if (visit.status === "cancelled" || !visit.nextFollowUpDate) continue;
    const company = companies.find((c) => c.id === visit.companyId);
    rows.push({
      id: visit.id,
      kind: "visit-followup",
      title: visit.nextAction || visit.purpose,
      subtitle: `Visit follow-up · ${company?.name ?? "Unknown company"}`,
      assigneeUserId: visit.assignedUserId,
      dueDate: visit.nextFollowUpDate,
      href: `/companies/${visit.companyId}?tab=Visits`,
      companyId: visit.companyId,
    });
  }

  return rows.sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return a.title.localeCompare(b.title);
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });
}

export function usePendingWorkSummary() {
  const tickets = useTicketStore((s) => s.tickets);
  const tasks = useErpTaskStore((s) => s.tasks);
  const checklist = useOnboardingStore((s) => s.checklistItems);
  const visits = useClientVisitStore((s) => s.visits);
  const projects = useProjectStore((s) => s.projects);
  const companies = useCompanyStore((s) => s.companies);

  return useMemo(() => {
    const items = buildPendingWorkItems({ tickets, tasks, checklist, visits, projects, companies });
    const today = new Date().toISOString().slice(0, 10);

    const byKind = {
      ticket: items.filter((i) => i.kind === "ticket").length,
      task: items.filter((i) => i.kind === "task").length,
      checklist: items.filter((i) => i.kind === "checklist").length,
      visitFollowup: items.filter((i) => i.kind === "visit-followup").length,
    };

    const checklistCollection = checklist.filter((i) => !i.notApplicable && !i.collected).length;
    const checklistUpload = checklist.filter(
      (i) => !i.notApplicable && i.collected && !i.uploaded,
    ).length;
    const checklistLive = checklist.filter(
      (i) => !i.notApplicable && i.uploaded && !i.live,
    ).length;

    const overdue = items.filter((i) => i.dueDate && i.dueDate < today).length;
    const dueToday = items.filter((i) => i.dueDate === today).length;

    return {
      items,
      total: items.length,
      byKind,
      checklistCollection,
      checklistUpload,
      checklistLive,
      overdue,
      dueToday,
    };
  }, [tickets, tasks, checklist, visits, projects, companies]);
}
