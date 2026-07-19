import type {
  AttendanceRecord,
  Company,
  Employee,
  Integration,
  Labor,
  OnboardingChecklistItem,
  OtherCharge,
  PaymentRecord,
  Project,
  PurchaseOrder,
  Ticket,
  WorkOrder,
  FollowUpTask,
  CrmEvent,
} from "@/types";
import { STATUS_LABEL } from "@/types/common";
import { calcChecklistProgress } from "@/lib/checklist";
import { isTicketOpen, isTicketResolved } from "@/lib/tickets";

export const REPORT_IDS = [
  "onboarding",
  "due",
  "collection",
  "vendor",
  "labor",
  "team",
  "delay",
  "integrations",
  "ticket-aging",
  "bug-resolution",
  "follow-ups",
  "custom",
  "executive",
] as const;

export type ReportId = (typeof REPORT_IDS)[number];

export type ReportKpi = { label: string; value: string | number; tone?: "default" | "success" | "warning" | "danger" };
export type ReportChartPoint = { name: string; value: number; fill?: string };
export type ReportColumn = { key: string; label: string };
export type ReportRow = Record<string, string | number>;

export type ReportResult = {
  id: ReportId;
  title: string;
  description: string;
  kpis: ReportKpi[];
  chart: ReportChartPoint[];
  chartLabel?: string;
  columns: ReportColumn[];
  rows: ReportRow[];
};

export type ReportSnapshot = {
  companies: Company[];
  projects: Project[];
  checklist: OnboardingChecklistItem[];
  otherCharges: OtherCharge[];
  payments: PaymentRecord[];
  purchaseOrders: PurchaseOrder[];
  workOrders: WorkOrder[];
  labor: Labor[];
  attendance: AttendanceRecord[];
  employees: Employee[];
  integrations: Integration[];
  tickets: Ticket[];
  followUpTasks: FollowUpTask[];
  crmEvents: CrmEvent[];
};

function projectProgress(projectId: string, checklist: OnboardingChecklistItem[]) {
  return calcChecklistProgress(checklist.filter((i) => i.projectId === projectId));
}

function daysBetween(iso: string) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

function companyName(companies: Company[], id: string) {
  return companies.find((c) => c.id === id)?.name ?? "—";
}

function projectName(projects: Project[], id: string) {
  return projects.find((p) => p.id === id)?.name ?? "—";
}

function employeeName(employees: Employee[], id: string) {
  return employees.find((e) => e.id === id)?.name ?? "Unassigned";
}

export function downloadCsv(filename: string, columns: ReportColumn[], rows: ReportRow[]) {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = columns.map((c) => escape(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => escape(r[c.key] ?? "")).join(",")).join("\n");
  const blob = new Blob([[header, body].filter(Boolean).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function onboardingReport(s: ReportSnapshot): ReportResult {
  const byStatus: Record<string, number> = {};
  for (const c of s.companies) {
    byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
  }
  const progressList = s.projects.map((p) => projectProgress(p.id, s.checklist));
  const avg = progressList.length
    ? Math.round(progressList.reduce((a, b) => a + b, 0) / progressList.length)
    : 0;
  const live = s.projects.filter((p) => p.goLiveAt).length;

  return {
    id: "onboarding",
    title: "Onboarding Report",
    description: "Progress across all companies and projects",
    kpis: [
      { label: "Companies", value: s.companies.length },
      { label: "Projects", value: s.projects.length },
      { label: "Avg progress", value: `${avg}%`, tone: avg >= 70 ? "success" : avg >= 40 ? "warning" : "danger" },
      { label: "Live projects", value: live, tone: "success" },
    ],
    chart: Object.entries(byStatus).map(([status, value]) => ({
      name: STATUS_LABEL[status as keyof typeof STATUS_LABEL] ?? status,
      value,
    })),
    chartLabel: "Companies by status",
    columns: [
      { key: "company", label: "Company" },
      { key: "project", label: "Project" },
      { key: "status", label: "Status" },
      { key: "progress", label: "Progress %" },
      { key: "city", label: "City" },
    ],
    rows: s.projects.map((p) => {
      const company = s.companies.find((c) => c.id === p.companyId);
      return {
        company: company?.name ?? "—",
        project: p.name,
        status: STATUS_LABEL[p.status] ?? p.status,
        progress: projectProgress(p.id, s.checklist),
        city: p.city,
      };
    }),
  };
}

function dueReport(s: ReportSnapshot): ReportResult {
  const byProject = new Map<string, number>();
  for (const c of s.otherCharges) {
    byProject.set(c.projectId, (byProject.get(c.projectId) ?? 0) + c.amount);
  }
  const total = [...byProject.values()].reduce((a, b) => a + b, 0);
  const rows = [...byProject.entries()]
    .map(([projectId, amount]) => {
      const p = s.projects.find((x) => x.id === projectId);
      return {
        company: p ? companyName(s.companies, p.companyId) : "—",
        project: p?.name ?? projectId,
        charges: s.otherCharges.filter((c) => c.projectId === projectId).length,
        amount,
      };
    })
    .sort((a, b) => Number(b.amount) - Number(a.amount));

  return {
    id: "due",
    title: "Due Report",
    description: "Outstanding other charges by project",
    kpis: [
      { label: "Projects with dues", value: byProject.size },
      { label: "Charge lines", value: s.otherCharges.length },
      { label: "Total due (₹)", value: total.toLocaleString("en-IN") },
    ],
    chart: rows.slice(0, 8).map((r) => ({ name: String(r.project).slice(0, 16), value: Number(r.amount) })),
    chartLabel: "Top dues by project",
    columns: [
      { key: "company", label: "Company" },
      { key: "project", label: "Project" },
      { key: "charges", label: "Charge lines" },
      { key: "amount", label: "Amount (₹)" },
    ],
    rows,
  };
}

function collectionReport(s: ReportSnapshot): ReportResult {
  const received = s.payments.filter((p) => p.status === "received");
  const pending = s.payments.filter((p) => p.status === "pending");
  const overdue = s.payments.filter((p) => p.status === "overdue");
  const sum = (list: PaymentRecord[]) => list.reduce((a, p) => a + p.amount, 0);

  return {
    id: "collection",
    title: "Collection Report",
    description: "Payments received vs pending / overdue",
    kpis: [
      { label: "Received (₹)", value: sum(received).toLocaleString("en-IN"), tone: "success" },
      { label: "Pending (₹)", value: sum(pending).toLocaleString("en-IN"), tone: "warning" },
      { label: "Overdue (₹)", value: sum(overdue).toLocaleString("en-IN"), tone: "danger" },
      { label: "Records", value: s.payments.length },
    ],
    chart: [
      { name: "Received", value: sum(received), fill: "var(--color-success)" },
      { name: "Pending", value: sum(pending), fill: "var(--color-warning)" },
      { name: "Overdue", value: sum(overdue), fill: "var(--color-destructive)" },
    ],
    chartLabel: "Collection mix",
    columns: [
      { key: "project", label: "Project" },
      { key: "customer", label: "Customer" },
      { key: "amount", label: "Amount (₹)" },
      { key: "status", label: "Status" },
    ],
    rows: s.payments.map((p) => ({
      project: projectName(s.projects, p.projectId),
      customer: p.customerName,
      amount: p.amount,
      status: p.status,
    })),
  };
}

function vendorReport(s: ReportSnapshot): ReportResult {
  const poByStatus: Record<string, number> = {};
  for (const po of s.purchaseOrders) poByStatus[po.status] = (poByStatus[po.status] ?? 0) + 1;
  const woOpen = s.workOrders.filter((w) => w.status !== "Completed" && w.status !== "Cancelled").length;

  return {
    id: "vendor",
    title: "Vendor Report",
    description: "Purchase & work order status",
    kpis: [
      { label: "Purchase orders", value: s.purchaseOrders.length },
      { label: "Work orders", value: s.workOrders.length },
      { label: "Open WOs", value: woOpen, tone: woOpen ? "warning" : "success" },
      {
        label: "PO value (₹)",
        value: s.purchaseOrders.reduce((a, p) => a + p.amount, 0).toLocaleString("en-IN"),
      },
    ],
    chart: Object.entries(poByStatus).map(([name, value]) => ({ name, value })),
    chartLabel: "POs by status",
    columns: [
      { key: "kind", label: "Type" },
      { key: "number", label: "Number" },
      { key: "status", label: "Status" },
      { key: "amount", label: "Amount (₹)" },
      { key: "date", label: "Date" },
    ],
    rows: [
      ...s.purchaseOrders.map((po) => ({
        kind: "PO",
        number: po.number,
        status: po.status,
        amount: po.amount,
        date: po.date,
      })),
      ...s.workOrders.map((wo) => ({
        kind: "WO",
        number: wo.number,
        status: wo.status,
        amount: wo.amount,
        date: wo.date,
      })),
    ],
  };
}

function laborReport(s: ReportSnapshot): ReportResult {
  const byRole: Record<string, number> = {};
  for (const l of s.labor) byRole[l.role || "Other"] = (byRole[l.role || "Other"] ?? 0) + 1;
  const attendanceRecords = s.attendance.reduce((a, r) => a + r.recordCount, 0);

  return {
    id: "labor",
    title: "Labor Report",
    description: "Workforce and attendance uploads",
    kpis: [
      { label: "Labor records", value: s.labor.length },
      { label: "Attendance files", value: s.attendance.length },
      { label: "Attendance rows", value: attendanceRecords },
    ],
    chart: Object.entries(byRole).map(([name, value]) => ({ name, value })),
    chartLabel: "Labor by role",
    columns: [
      { key: "name", label: "Name" },
      { key: "role", label: "Role" },
      { key: "phone", label: "Phone" },
      { key: "project", label: "Project" },
    ],
    rows: s.labor.map((l) => ({
      name: l.name,
      role: l.role,
      phone: l.phone,
      project: l.projectId ? projectName(s.projects, l.projectId) : "—",
    })),
  };
}

function teamReport(s: ReportSnapshot): ReportResult {
  const managers = s.employees.filter((e) => e.role === "Onboarding Manager" || e.role === "CSM");
  const rows = (managers.length ? managers : s.employees).map((e) => {
    const companies = s.companies.filter(
      (c) => c.onboardingManagerId === e.id || c.csmId === e.id || c.salesAgentId === e.id,
    );
    const asSales = s.companies.filter((c) => c.salesAgentId === e.id).length;
    const projects = s.projects.filter((p) => companies.some((c) => c.id === p.companyId));
    const avg =
      projects.length === 0
        ? 0
        : Math.round(
            projects.reduce((sum, p) => sum + projectProgress(p.id, s.checklist), 0) / projects.length,
          );
    return {
      name: e.name,
      role: e.role,
      companies: companies.length,
      salesAgentCompanies: asSales,
      projects: projects.length,
      avgProgress: avg,
      region: e.region,
    };
  });

  const assignedSales = s.companies.filter((c) => Boolean(c.salesAgentId)).length;

  return {
    id: "team",
    title: "Team Productivity",
    description: "Onboarding manager, CSM, and sales agent workload",
    kpis: [
      { label: "Team members", value: rows.length },
      { label: "Companies covered", value: s.companies.length },
      { label: "With sales agent", value: assignedSales },
      {
        label: "Avg team progress",
        value: rows.length
          ? `${Math.round(rows.reduce((a, r) => a + Number(r.avgProgress), 0) / rows.length)}%`
          : "0%",
      },
    ],
    chart: rows.slice(0, 10).map((r) => ({ name: String(r.name).split(" ")[0] ?? r.name, value: Number(r.avgProgress) })),
    chartLabel: "Avg progress by person",
    columns: [
      { key: "name", label: "Name" },
      { key: "role", label: "Role" },
      { key: "companies", label: "Companies" },
      { key: "salesAgentCompanies", label: "As sales agent" },
      { key: "projects", label: "Projects" },
      { key: "avgProgress", label: "Avg %" },
      { key: "region", label: "Region" },
    ],
    rows,
  };
}

function delayReport(s: ReportSnapshot): ReportResult {
  const rows = s.projects
    .map((p) => {
      const progress = projectProgress(p.id, s.checklist);
      const company = s.companies.find((c) => c.id === p.companyId);
      const targetDays = company ? daysBetween(company.goLiveTarget) : 0;
      const overdueTarget = company ? new Date(company.goLiveTarget).getTime() < Date.now() && !p.goLiveAt : false;
      return {
        company: company?.name ?? "—",
        project: p.name,
        step: p.currentStep,
        progress,
        status: STATUS_LABEL[p.status] ?? p.status,
        risk: overdueTarget ? "Overdue target" : progress < 30 ? "Low progress" : progress < 60 ? "Watch" : "On track",
        ageDays: daysBetween(p.updatedAt),
        targetLag: targetDays,
      };
    })
    .sort((a, b) => Number(a.progress) - Number(b.progress));

  const atRisk = rows.filter((r) => r.risk !== "On track").length;
  const byStep: Record<string, number> = {};
  for (const r of rows) {
    const key = `Step ${r.step}`;
    byStep[key] = (byStep[key] ?? 0) + 1;
  }

  return {
    id: "delay",
    title: "Delay Analysis",
    description: "Projects lagging on onboarding steps",
    kpis: [
      { label: "Projects", value: rows.length },
      { label: "At risk", value: atRisk, tone: atRisk ? "danger" : "success" },
      {
        label: "Avg progress",
        value: rows.length
          ? `${Math.round(rows.reduce((a, r) => a + Number(r.progress), 0) / rows.length)}%`
          : "0%",
      },
    ],
    chart: Object.entries(byStep).map(([name, value]) => ({ name, value })),
    chartLabel: "Projects by onboarding step",
    columns: [
      { key: "company", label: "Company" },
      { key: "project", label: "Project" },
      { key: "step", label: "Step" },
      { key: "progress", label: "Progress %" },
      { key: "risk", label: "Risk" },
      { key: "ageDays", label: "Days since update" },
    ],
    rows,
  };
}

function integrationsReport(s: ReportSnapshot): ReportResult {
  const connected = s.integrations.filter((i) => i.connected).length;
  const tested = s.integrations.filter((i) => i.tested).length;

  return {
    id: "integrations",
    title: "Integration Status",
    description: "Connected and tested integrations",
    kpis: [
      { label: "Integrations", value: s.integrations.length },
      { label: "Connected", value: connected, tone: "success" },
      { label: "Tested", value: tested },
      {
        label: "Coverage",
        value: s.integrations.length ? `${Math.round((connected / s.integrations.length) * 100)}%` : "0%",
      },
    ],
    chart: [
      { name: "Connected", value: connected },
      { name: "Not connected", value: s.integrations.length - connected },
      { name: "Tested", value: tested },
    ],
    chartLabel: "Integration health",
    columns: [
      { key: "name", label: "Name" },
      { key: "connected", label: "Connected" },
      { key: "tested", label: "Tested" },
      { key: "project", label: "Project" },
    ],
    rows: s.integrations.map((i) => ({
      name: i.name,
      connected: i.connected ? "Yes" : "No",
      tested: i.tested ? "Yes" : "No",
      project: i.projectId ? projectName(s.projects, i.projectId) : "—",
    })),
  };
}

function ticketAgingReport(s: ReportSnapshot): ReportResult {
  const open = s.tickets.filter((t) => isTicketOpen(t));
  const bands = { "0-7d": 0, "8-14d": 0, "15-30d": 0, "30d+": 0 };
  for (const t of open) {
    const d = daysBetween(t.raisedOn);
    if (d <= 7) bands["0-7d"] += 1;
    else if (d <= 14) bands["8-14d"] += 1;
    else if (d <= 30) bands["15-30d"] += 1;
    else bands["30d+"] += 1;
  }

  return {
    id: "ticket-aging",
    title: "Ticket Aging",
    description: "Open tickets by age band",
    kpis: [
      { label: "Open tickets", value: open.length, tone: open.length ? "warning" : "success" },
      { label: "Total tickets", value: s.tickets.length },
      { label: "30d+ open", value: bands["30d+"], tone: bands["30d+"] ? "danger" : "default" },
    ],
    chart: Object.entries(bands).map(([name, value]) => ({ name, value })),
    chartLabel: "Open tickets by age",
    columns: [
      { key: "id", label: "ID" },
      { key: "title", label: "Title" },
      { key: "priority", label: "Priority" },
      { key: "status", label: "Status" },
      { key: "actionTaken", label: "Action Taken" },
      { key: "backendAssigned", label: "Backend Assigned" },
      { key: "backendForwardedAt", label: "Backend Forwarded At" },
      { key: "eta", label: "Latest ETA" },
      { key: "etaRevisedAt", label: "ETA Revised At" },
      { key: "resolutionStatus", label: "Resolution Status" },
      { key: "resolutionAt", label: "Resolution Date" },
      { key: "resolutionNotes", label: "Resolution Notes" },
      { key: "age", label: "Age (days)" },
      { key: "company", label: "Company" },
    ],
    rows: open
      .map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        status: t.status,
        actionTaken: t.actionTaken ?? "",
        backendAssigned: t.backendAssigned ? "Yes" : "No",
        backendForwardedAt: t.backendForwardedAt ?? "",
        eta: t.eta,
        etaRevisedAt: t.etaRevisedAt ?? "",
        resolutionStatus: t.resolutionStatus,
        resolutionAt: t.resolutionAt ?? "",
        resolutionNotes: t.resolutionNotes ?? "",
        age: daysBetween(t.raisedOn),
        company: companyName(s.companies, t.companyId),
      }))
      .sort((a, b) => Number(b.age) - Number(a.age)),
  };
}

function bugResolutionReport(s: ReportSnapshot): ReportResult {
  const bugs = s.tickets.filter((t) => t.type === "Bug");
  const closed = bugs.filter((t) => isTicketResolved(t));
  const open = bugs.filter((t) => isTicketOpen(t));
  const byPriority: Record<string, number> = {};
  for (const b of open) byPriority[b.priority] = (byPriority[b.priority] ?? 0) + 1;
  const rate = bugs.length ? Math.round((closed.length / bugs.length) * 100) : 0;
  const mttrSamples = closed
    .map((t) => {
      if (!t.resolutionAt) return null;
      const raised = new Date(t.raisedOn).getTime();
      const resolved = new Date(t.resolutionAt).getTime();
      if (Number.isNaN(raised) || Number.isNaN(resolved) || resolved < raised) return null;
      return Math.floor((resolved - raised) / 86400000);
    })
    .filter((days): days is number => days !== null);
  const mttr =
    mttrSamples.length === 0
      ? "n/a"
      : `${Math.round(mttrSamples.reduce((a, b) => a + b, 0) / mttrSamples.length)}d`;

  return {
    id: "bug-resolution",
    title: "Bug Resolution",
    description: "Bug closure rate, MTTR (when resolution date is known), and open bugs by priority",
    kpis: [
      { label: "Bugs", value: bugs.length },
      { label: "Open", value: open.length, tone: open.length ? "warning" : "success" },
      { label: "Closed", value: closed.length, tone: "success" },
      { label: "Closure rate", value: `${rate}%` },
      { label: "MTTR", value: mttr },
    ],
    chart: Object.entries(byPriority).map(([name, value]) => ({ name, value })),
    chartLabel: "Open bugs by priority",
    columns: [
      { key: "id", label: "ID" },
      { key: "title", label: "Title" },
      { key: "priority", label: "Priority" },
      { key: "status", label: "Status" },
      { key: "resolutionAt", label: "Resolved At" },
      { key: "mttrDays", label: "Resolve Days" },
      { key: "age", label: "Age (days)" },
      { key: "developer", label: "Developer" },
    ],
    rows: bugs.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      resolutionAt: t.resolutionAt ?? "",
      mttrDays:
        t.resolutionAt && !Number.isNaN(new Date(t.resolutionAt).getTime())
          ? Math.max(0, Math.floor((new Date(t.resolutionAt).getTime() - new Date(t.raisedOn).getTime()) / 86400000))
          : "date unavailable",
      age: daysBetween(t.raisedOn),
      developer: employeeName(s.employees, t.developerId),
    })),
  };
}

function customReport(s: ReportSnapshot): ReportResult {
  return {
    id: "custom",
    title: "Custom Report",
    description: "Companies & projects flat extract (filter in CSV)",
    kpis: [
      { label: "Companies", value: s.companies.length },
      { label: "Projects", value: s.projects.length },
    ],
    chart: [
      { name: "Companies", value: s.companies.length },
      { name: "Projects", value: s.projects.length },
    ],
    chartLabel: "Volume",
    columns: [
      { key: "company", label: "Company" },
      { key: "health", label: "Health" },
      { key: "status", label: "Company status" },
      { key: "salesAgentId", label: "Sales agent ID" },
      { key: "salesAgentAssigned", label: "Sales agent assigned" },
      { key: "project", label: "Project" },
      { key: "type", label: "Type" },
      { key: "city", label: "City" },
      { key: "units", label: "Units" },
      { key: "progress", label: "Progress %" },
    ],
    rows: s.projects.map((p) => {
      const c = s.companies.find((x) => x.id === p.companyId);
      return {
        company: c?.name ?? "—",
        health: c?.health ?? "—",
        status: c ? STATUS_LABEL[c.status] ?? c.status : "—",
        salesAgentId: c?.salesAgentId || "",
        salesAgentAssigned: c?.salesAgentId ? "Yes" : "No",
        project: p.name,
        type: p.type,
        city: p.city,
        units: p.units,
        progress: projectProgress(p.id, s.checklist),
      };
    }),
  };
}

function followUpReport(s: ReportSnapshot): ReportResult {
  const today = new Date().toISOString().slice(0, 10);
  const open = s.followUpTasks.filter(
    (task) => !["completed", "cancelled"].includes(task.status),
  );
  const overdue = open.filter((task) => task.dueDate && task.dueDate < today);
  const dueToday = open.filter((task) => task.dueDate === today);

  const rows = s.followUpTasks
    .map((task) => {
      const latestUpdate = s.crmEvents
        .filter((event) => event.taskId === task.id && Boolean(event.remark))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      return {
        id: task.id,
        company: companyName(s.companies, task.companyId),
        title: task.title,
        status: task.status,
        priority: task.priority,
        progress: task.progressPercent,
        dueDate: task.dueDate ?? "",
        assigneeUserId: task.assigneeUserId ?? "",
        latestFollowUp: latestUpdate?.remark ?? "",
        latestFollowUpAt: latestUpdate?.createdAt ?? "",
        latestFollowUpBy: latestUpdate?.actorName ?? "",
      };
    })
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));

  return {
    id: "follow-ups",
    title: "Follow-up Activity",
    description: "Open, overdue, and completed CRM follow-ups with latest discussion notes",
    kpis: [
      { label: "Open", value: open.length, tone: open.length ? "warning" : "success" },
      { label: "Overdue", value: overdue.length, tone: overdue.length ? "danger" : "success" },
      { label: "Due today", value: dueToday.length },
      { label: "Total", value: s.followUpTasks.length },
    ],
    chart: [
      { name: "Open", value: open.length },
      { name: "Overdue", value: overdue.length },
      {
        name: "Completed",
        value: s.followUpTasks.filter((task) => task.status === "completed").length,
      },
    ],
    chartLabel: "Follow-up status",
    columns: [
      { key: "id", label: "ID" },
      { key: "company", label: "Company" },
      { key: "title", label: "Follow-up" },
      { key: "status", label: "Status" },
      { key: "priority", label: "Priority" },
      { key: "progress", label: "Progress %" },
      { key: "dueDate", label: "Due Date" },
      { key: "assigneeUserId", label: "Assignee User ID" },
      { key: "latestFollowUp", label: "Latest Update" },
      { key: "latestFollowUpAt", label: "Update Date" },
      { key: "latestFollowUpBy", label: "Updated By" },
    ],
    rows,
  };
}

function executiveReport(s: ReportSnapshot): ReportResult {
  const onboarding = onboardingReport(s);
  const tickets = ticketAgingReport(s);
  const renewals = s.companies.filter((c) => {
    const days = (new Date(c.planExpiry).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 60;
  });
  const critical = s.companies.filter((c) => c.health === "Critical").length;
  const live = s.projects.filter((p) => p.goLiveAt).length;

  return {
    id: "executive",
    title: "Executive Summary",
    description: "Leadership one-pager across ops",
    kpis: [
      { label: "Companies", value: s.companies.length },
      { label: "Live projects", value: live, tone: "success" },
      { label: "Open tickets", value: tickets.kpis[0]?.value ?? 0, tone: "warning" },
      { label: "Renewals (60d)", value: renewals.length },
      { label: "Critical health", value: critical, tone: critical ? "danger" : "success" },
    ],
    chart: [
      { name: "Healthy", value: s.companies.filter((c) => c.health === "Healthy").length },
      { name: "Moderate", value: s.companies.filter((c) => c.health === "Moderate").length },
      { name: "Critical", value: critical },
    ],
    chartLabel: "Account health",
    columns: [
      { key: "area", label: "Area" },
      { key: "metric", label: "Metric" },
      { key: "value", label: "Value" },
    ],
    rows: [
      { area: "Onboarding", metric: "Avg project progress", value: onboarding.kpis[2]?.value ?? "—" },
      { area: "Onboarding", metric: "Live projects", value: live },
      { area: "Support", metric: "Open tickets", value: tickets.kpis[0]?.value ?? 0 },
      { area: "Commercial", metric: "Renewals in 60 days", value: renewals.length },
      { area: "Risk", metric: "Critical accounts", value: critical },
      ...renewals.slice(0, 8).map((c) => ({
        area: "Renewal",
        metric: c.name,
        value: c.planExpiry,
      })),
    ],
  };
}

export function buildReport(id: ReportId, snapshot: ReportSnapshot): ReportResult {
  switch (id) {
    case "onboarding":
      return onboardingReport(snapshot);
    case "due":
      return dueReport(snapshot);
    case "collection":
      return collectionReport(snapshot);
    case "vendor":
      return vendorReport(snapshot);
    case "labor":
      return laborReport(snapshot);
    case "team":
      return teamReport(snapshot);
    case "delay":
      return delayReport(snapshot);
    case "integrations":
      return integrationsReport(snapshot);
    case "ticket-aging":
      return ticketAgingReport(snapshot);
    case "bug-resolution":
      return bugResolutionReport(snapshot);
    case "follow-ups":
      return followUpReport(snapshot);
    case "custom":
      return customReport(snapshot);
    case "executive":
      return executiveReport(snapshot);
    default:
      return onboardingReport(snapshot);
  }
}

export const REPORT_META: {
  id: ReportId;
  name: string;
  desc: string;
}[] = [
  { id: "onboarding", name: "Onboarding Report", desc: "Progress across all companies" },
  { id: "due", name: "Due Report", desc: "Outstanding balances by project" },
  { id: "collection", name: "Collection Report", desc: "Payments received" },
  { id: "vendor", name: "Vendor Report", desc: "PO / bill status" },
  { id: "labor", name: "Labor Report", desc: "Attendance & site coverage" },
  { id: "team", name: "Team Productivity", desc: "Onboarding manager performance" },
  { id: "delay", name: "Delay Analysis", desc: "Time in each onboarding step" },
  { id: "integrations", name: "Integration Status", desc: "Connected & tested integrations" },
  { id: "ticket-aging", name: "Ticket Aging", desc: "Open tickets by age band" },
  { id: "bug-resolution", name: "Bug Resolution", desc: "Bug MTTR and closure rate" },
  { id: "follow-ups", name: "Follow-up Activity", desc: "CRM discussion updates and due work" },
  { id: "custom", name: "Custom Report", desc: "Flat extract for your own filters" },
  { id: "executive", name: "Executive Summary", desc: "One-pager for leadership" },
];
