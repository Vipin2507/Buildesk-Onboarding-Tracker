import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Building2,
  TrendingUp,
  CheckCircle2,
  ListChecks,
  RefreshCw,
  ArrowRight,
  MapPin,
  AlarmClock,
  Ticket,
  Palette,
} from "lucide-react";

import { DashboardDrillDownSheet } from "@/components/dashboard/dashboard-drill-down-sheet";
import type { DashboardDrillDownData } from "@/components/dashboard/dashboard-drill-down-sheet";
import { DashboardKpiCard } from "@/components/dashboard/dashboard-kpi-card";
import { OnboardingPipelineSection } from "@/components/dashboard/onboarding-pipeline";
import { PageHeader, PageWrap } from "@/components/page-header";
import { ProgressBar, ProgressRing } from "@/components/progress-bar";
import { StatusPill, Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { PendingWorkDashboard } from "@/components/pending-work-dashboard";
import { resolveAssigneeLabel } from "@/lib/managers";
import type { ChecklistPhaseBucket } from "@/lib/checklist";
import {
  useAccountHealth,
  useCompanyStore,
  useDashboardOverview,
  useEmployeeStore,
  useModuleAdoption,
  useProjectStore,
  useRecentActivity,
  useUpcomingRenewals,
  useUserStore,
} from "@/stores";
import type { DashboardDrillDownFilter } from "@/stores/dashboard-selectors";
import { formatRelativeTime } from "@/types/common";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

const EASE = [0.22, 1, 0.36, 1] as const;

function Dashboard() {
  const navigate = useNavigate();
  const { kpis, phaseStats, openDesignTickets, resolveDrillDown } = useDashboardOverview();
  const moduleData = useModuleAdoption();
  const health = useAccountHealth();
  const activities = useRecentActivity(6);
  const renewals = useUpcomingRenewals(5);
  const employees = useEmployeeStore((s) => s.employees);
  const users = useUserStore((s) => s.users);
  const projects = useProjectStore((s) => s.projects);
  const companies = useCompanyStore((s) => s.companies);

  const [drillDown, setDrillDown] = useState<DashboardDrillDownFilter | null>(null);
  const [activePhase, setActivePhase] = useState<ChecklistPhaseBucket | undefined>();

  const drillDownData = useMemo(
    () => (drillDown ? resolveDrillDown(drillDown) : null),
    [drillDown, resolveDrillDown],
  ) as DashboardDrillDownData | null;

  function openDrillDown(filter: DashboardDrillDownFilter) {
    setDrillDown(filter);
    if (filter.type === "checklist") setActivePhase(filter.phase);
  }

  function closeDrillDown() {
    setDrillDown(null);
    setActivePhase(undefined);
  }

  const companyNameById = (id: string) => companies.find((c) => c.id === id)?.name ?? "Unknown";

  const kpiCards: {
    label: string;
    value: number;
    icon: typeof Building2;
    tone: string;
    hint?: string;
    filter: DashboardDrillDownFilter;
  }[] = [
    {
      label: "Total Companies",
      value: kpis.totalCompanies,
      icon: Building2,
      tone: "bg-primary/10 text-primary",
      filter: { type: "companies", status: "all" },
    },
    {
      label: "Active Onboarding",
      value: kpis.activeOnboarding,
      icon: TrendingUp,
      tone: "bg-warning/15 text-warning-foreground",
      filter: { type: "companies", status: "in_progress" },
    },
    {
      label: "Completed",
      value: kpis.completed,
      icon: CheckCircle2,
      tone: "bg-success/15 text-success",
      filter: { type: "companies", status: "completed" },
    },
    {
      label: "Open Support Tickets",
      value: kpis.openTickets ?? kpis.pendingTasks,
      icon: ListChecks,
      tone: "bg-info/15 text-info",
      filter: { type: "support_tickets" },
    },
    {
      label: "Design Tickets",
      value: openDesignTickets,
      icon: Palette,
      tone: "bg-primary/15 text-primary",
      hint: "Client portal requests",
      filter: { type: "design_tickets" },
    },
    {
      label: "Overdue Follow-ups",
      value: kpis.overdueFollowUpTasks ?? 0,
      icon: AlarmClock,
      tone: "bg-destructive/15 text-destructive",
      filter: { type: "follow_ups", scope: "overdue" },
    },
    {
      label: "Tasks Due Today",
      value: kpis.tasksDueToday ?? 0,
      icon: Ticket,
      tone: "bg-warning/15 text-warning-foreground",
      filter: { type: "follow_ups", scope: "due_today" },
    },
    {
      label: "Upcoming Visits",
      value: kpis.upcomingVisits ?? 0,
      icon: MapPin,
      tone: "bg-info/15 text-info",
      filter: { type: "visits" },
    },
    {
      label: "Upcoming Renewals",
      value: kpis.upcomingRenewals,
      icon: RefreshCw,
      tone: "bg-primary/15 text-primary",
      filter: { type: "renewals" },
    },
  ];

  const donutData = [
    {
      name: "Completed",
      value: kpis.completed,
      color: "var(--color-success)",
      filter: { type: "companies" as const, status: "completed" as const },
    },
    {
      name: "In Progress",
      value: kpis.activeOnboarding,
      color: "var(--color-warning)",
      filter: { type: "companies" as const, status: "in_progress" as const },
    },
    {
      name: "Pending Review",
      value: kpis.companiesWithProgress.filter((c) => c.computedStatus === "review").length,
      color: "var(--color-info)",
      filter: { type: "companies" as const, status: "review" as const },
    },
    {
      name: "Not Started",
      value: kpis.companiesWithProgress.filter((c) => c.computedStatus === "not_started").length,
      color: "var(--color-muted-foreground)",
      filter: { type: "companies" as const, status: "not_started" as const },
    },
    {
      name: "On Hold",
      value: kpis.onHold,
      color: "var(--color-destructive)",
      filter: { type: "companies" as const, status: "on_hold" as const },
    },
  ];

  const healthTotal = health.Healthy + health.Moderate + health.Critical;
  const healthPct = healthTotal ? Math.round((health.Healthy / healthTotal) * 100) : 0;
  const recent = kpis.companiesWithProgress
    .filter((c) => c.computedStatus !== "completed")
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 6);

  return (
    <PageWrap>
      <PageHeader
        title="Dashboard"
        subtitle="Real Estate SaaS ERP — onboarding pipeline, tasks, and health at a glance. Click any metric to drill down."
        actions={
          <Button className="bg-primary hover:bg-primary/90" onClick={() => navigate({ to: "/companies" })}>
            + New Onboarding
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-5">
        {kpiCards.map((k, i) => (
          <DashboardKpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            icon={k.icon}
            tone={k.tone}
            hint={k.hint}
            delay={i * 0.04}
            active={drillDown?.type === k.filter.type && JSON.stringify(drillDown) === JSON.stringify(k.filter)}
            onClick={() => openDrillDown(k.filter)}
          />
        ))}
      </div>

      <div className="mt-4">
        <OnboardingPipelineSection
          stats={phaseStats}
          activePhase={activePhase}
          onPhaseClick={openDrillDown}
        />
      </div>

      <PendingWorkDashboard />

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: EASE }}
          className="card-soft p-5 lg:col-span-1"
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">Onboarding Progress</h3>
            <Pill tone="info">Click segments</Pill>
          </div>
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={donutData}
                  innerRadius={55}
                  outerRadius={80}
                  dataKey="value"
                  paddingAngle={3}
                  stroke="none"
                  className="cursor-pointer outline-none"
                  onClick={(_, index) => {
                    const seg = donutData[index];
                    if (seg?.filter) openDrillDown(seg.filter);
                  }}
                >
                  {donutData.map((d, i) => (
                    <Cell key={i} fill={d.color} className="transition-opacity hover:opacity-80" />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {donutData.map((d) => (
              <button
                key={d.name}
                type="button"
                onClick={() => openDrillDown(d.filter)}
                className="flex items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors hover:bg-muted/60"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                <span className="text-muted-foreground">{d.name}</span>
                <span className="ml-auto font-medium">{d.value}</span>
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.14, ease: EASE }}
          className="card-soft p-5 lg:col-span-2"
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">Modules Opted</h3>
            <span className="text-xs text-muted-foreground">of {kpis.totalCompanies} companies</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={moduleData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                <Tooltip cursor={{ fill: "var(--color-muted)" }} />
                <Bar dataKey="opted" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="card-soft p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Recent Onboarding</h3>
            <Link to="/companies" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2.5 md:hidden">
            {recent.map((c, i) => {
              const project = projects.find((p) => p.companyId === c.id);
              const managerName = resolveAssigneeLabel(c.onboardingManagerId, users, employees);
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.24) }}
                  className="rounded-xl border border-border p-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to="/companies/$companyId"
                      params={{ companyId: c.id }}
                      className="min-w-0 font-medium hover:underline"
                    >
                      {c.name}
                    </Link>
                    <StatusPill status={c.computedStatus} />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <ProgressBar value={c.progress} className="flex-1" />
                    <span className="text-xs text-muted-foreground">{c.progress}%</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{managerName === "—" ? "Unassigned" : managerName}</span>
                    {project && (
                      <Button size="sm" variant="ghost" className="h-8 gap-1 px-2 text-primary" asChild>
                        <Link
                          to="/projects/$projectId"
                          params={{ projectId: project.id }}
                          search={{ tab: "onboarding" }}
                        >
                          Continue <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
          <div className="hidden overflow-hidden rounded-lg border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Company</th>
                  <th className="px-3 py-2 text-left font-medium">Current Step</th>
                  <th className="px-3 py-2 text-left font-medium">Progress</th>
                  <th className="px-3 py-2 text-left font-medium">Manager</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {recent.map((c) => {
                  const project = projects.find((p) => p.companyId === c.id);
                  const managerName = resolveAssigneeLabel(c.onboardingManagerId, users, employees);
                  return (
                    <tr key={c.id} className="border-t transition-colors hover:bg-muted/40">
                      <td className="px-3 py-2.5 font-medium">
                        <Link
                          to="/companies/$companyId"
                          params={{ companyId: c.id }}
                          className="hover:underline"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusPill status={c.computedStatus} />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <ProgressBar value={c.progress} className="w-28" />
                          <span className="text-xs text-muted-foreground">{c.progress}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{managerName}</td>
                      <td className="px-3 py-2.5 text-right">
                        {project && (
                          <Button size="sm" variant="ghost" className="gap-1 text-primary" asChild>
                            <Link
                              to="/projects/$projectId"
                              params={{ projectId: project.id }}
                              search={{ tab: "onboarding" }}
                            >
                              Continue <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.12, ease: EASE }}
            className="card-soft p-5"
          >
            <h3 className="mb-3 font-semibold">Account Health</h3>
            <div className="flex items-center gap-4">
              <ProgressRing value={healthPct} />
              <div className="space-y-1.5 text-sm">
                {(
                  [
                    { label: "Healthy" as const, dot: "bg-success", count: health.Healthy },
                    { label: "Moderate" as const, dot: "bg-warning", count: health.Moderate },
                    { label: "Critical" as const, dot: "bg-destructive", count: health.Critical },
                  ] as const
                ).map(({ label, dot, count }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => openDrillDown({ type: "account_health", health: label })}
                    className="flex w-full items-center gap-2 rounded-lg px-1 py-0.5 transition-colors hover:bg-muted/60"
                  >
                    <span className={`h-2 w-2 rounded-full ${dot}`} />
                    {label}
                    <span className="ml-auto font-medium">{count}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          <div className="card-soft p-5">
            <h3 className="mb-3 font-semibold">Activity</h3>
            <ol className="space-y-3">
              {activities.map((a, i) => (
                <motion.li
                  key={a.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex gap-3 text-sm"
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      a.kind === "success"
                        ? "bg-success"
                        : a.kind === "warning"
                          ? "bg-warning"
                          : a.kind === "danger"
                            ? "bg-destructive"
                            : "bg-primary"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="truncate">{a.what}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.who} · {formatRelativeTime(a.createdAt)}
                    </div>
                  </div>
                </motion.li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <div className="mt-6 card-soft p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Upcoming Renewals</h3>
          <button
            type="button"
            onClick={() => openDrillDown({ type: "renewals" })}
            className="text-xs font-medium text-primary hover:underline"
          >
            View all
          </button>
        </div>
        <div className="space-y-2.5 md:hidden">
          {renewals.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.2) }}
              className="rounded-xl border border-border p-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <Link
                  to="/companies/$companyId"
                  params={{ companyId: r.id }}
                  className="font-medium hover:underline"
                >
                  {r.name}
                </Link>
                <Pill tone={r.urgency === "urgent" ? "warning" : r.urgency === "overdue" ? "danger" : "info"}>
                  {r.urgency === "overdue" ? "Overdue" : "Upcoming"}
                </Pill>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Pill tone="accent">{r.plan}</Pill>
                <span>{r.planExpiry}</span>
                <Pill tone={r.daysLeft < 15 ? "danger" : r.daysLeft < 30 ? "warning" : "info"}>
                  {r.daysLeft} days
                </Pill>
              </div>
            </motion.div>
          ))}
        </div>
        <div className="hidden overflow-hidden rounded-lg border md:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Company</th>
                <th className="px-3 py-2 text-left font-medium">Plan</th>
                <th className="px-3 py-2 text-left font-medium">Expiry</th>
                <th className="px-3 py-2 text-left font-medium">Days Left</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {renewals.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2.5 font-medium">
                    <Link
                      to="/companies/$companyId"
                      params={{ companyId: r.id }}
                      className="hover:underline"
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <Pill tone="accent">{r.plan}</Pill>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.planExpiry}</td>
                  <td className="px-3 py-2.5">
                    <Pill tone={r.daysLeft < 15 ? "danger" : r.daysLeft < 30 ? "warning" : "info"}>
                      {r.daysLeft} days
                    </Pill>
                  </td>
                  <td className="px-3 py-2.5">
                    <Pill tone={r.urgency === "urgent" ? "warning" : r.urgency === "overdue" ? "danger" : "info"}>
                      {r.urgency === "overdue" ? "Overdue" : "Upcoming"}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DashboardDrillDownSheet
        open={Boolean(drillDown)}
        filter={drillDown}
        data={drillDownData}
        onClose={closeDrillDown}
        companyNameById={companyNameById}
      />
    </PageWrap>
  );
}
