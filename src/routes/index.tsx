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
  ArrowRight,
  PauseCircle,
} from "lucide-react";

import { DashboardDrillDownSheet } from "@/components/dashboard/dashboard-drill-down-sheet";
import type { DashboardDrillDownData } from "@/components/dashboard/dashboard-drill-down-sheet";
import { DashboardKpiCard } from "@/components/dashboard/dashboard-kpi-card";
import { DashboardPendingSummary } from "@/components/dashboard/dashboard-pending-summary";
import { OnboardingPipelineSection } from "@/components/dashboard/onboarding-pipeline";
import { PageHeader, PageWrap } from "@/components/page-header";
import { ProgressBar, ProgressRing } from "@/components/progress-bar";
import { StatusPill, Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
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
  const activities = useRecentActivity(4);
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

  const portfolioKpis = [
    {
      label: "Companies",
      value: kpis.totalCompanies,
      icon: Building2,
      tone: "bg-primary/10 text-primary",
      filter: { type: "companies" as const, status: "all" as const },
    },
    {
      label: "In progress",
      value: kpis.activeOnboarding,
      icon: TrendingUp,
      tone: "bg-warning/15 text-warning-foreground",
      filter: { type: "companies" as const, status: "in_progress" as const },
    },
    {
      label: "Completed",
      value: kpis.completed,
      icon: CheckCircle2,
      tone: "bg-success/15 text-success",
      filter: { type: "companies" as const, status: "completed" as const },
    },
    {
      label: "On hold",
      value: kpis.onHold,
      icon: PauseCircle,
      tone: "bg-muted text-muted-foreground",
      filter: { type: "companies" as const, status: "on_hold" as const },
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
    .slice(0, 4);

  return (
    <PageWrap>
      <PageHeader
        title="Dashboard"
        subtitle="Pending work and portfolio status at a glance."
        actions={
          <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => navigate({ to: "/companies" })}>
            + New Onboarding
          </Button>
        }
      />

      <div className="space-y-2.5">
        <DashboardPendingSummary
          openDesignTickets={openDesignTickets}
          overdueFollowUps={kpis.overdueFollowUpTasks ?? 0}
          tasksDueToday={kpis.tasksDueToday ?? 0}
          upcomingVisits={kpis.upcomingVisits ?? 0}
          upcomingRenewals={kpis.upcomingRenewals}
          onOpen={openDrillDown}
          activeFilter={drillDown}
        />

        <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
          {portfolioKpis.map((k, i) => (
            <DashboardKpiCard
              key={k.label}
              compact
              label={k.label}
              value={k.value}
              icon={k.icon}
              tone={k.tone}
              delay={i * 0.03}
              active={
                drillDown?.type === k.filter.type &&
                JSON.stringify(drillDown) === JSON.stringify(k.filter)
              }
              onClick={() => openDrillDown(k.filter)}
            />
          ))}
        </div>

        <OnboardingPipelineSection
          compact
          stats={phaseStats}
          activePhase={activePhase}
          onPhaseClick={openDrillDown}
        />

        <div className="grid gap-2.5 lg:grid-cols-12">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08, ease: EASE }}
            className="card-soft p-3 lg:col-span-3"
          >
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-xs font-semibold">Onboarding mix</h3>
              <Pill tone="info">Click</Pill>
            </div>
            <div className="h-32">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={donutData}
                    innerRadius={32}
                    outerRadius={52}
                    dataKey="value"
                    paddingAngle={2}
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
            <div className="grid grid-cols-2 gap-0.5 text-[10px]">
              {donutData.map((d) => (
                <button
                  key={d.name}
                  type="button"
                  onClick={() => openDrillDown(d.filter)}
                  className="flex items-center gap-1 rounded px-0.5 py-0.5 text-left hover:bg-muted/60"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color }} />
                  <span className="truncate text-muted-foreground">{d.name}</span>
                  <span className="ml-auto font-medium">{d.value}</span>
                </button>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1, ease: EASE }}
            className="card-soft p-3 lg:col-span-5"
          >
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-xs font-semibold">Modules opted</h3>
              <span className="text-[10px] text-muted-foreground">{kpis.totalCompanies} cos.</span>
            </div>
            <div className="h-32">
              <ResponsiveContainer>
                <BarChart data={moduleData} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                  <CartesianGrid vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="var(--color-muted-foreground)" />
                  <YAxis tick={{ fontSize: 9 }} stroke="var(--color-muted-foreground)" />
                  <Tooltip cursor={{ fill: "var(--color-muted)" }} />
                  <Bar dataKey="opted" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.12, ease: EASE }}
            className="card-soft p-3 lg:col-span-4"
          >
            <h3 className="mb-2 text-xs font-semibold">Account health</h3>
            <div className="flex items-center gap-3">
              <ProgressRing value={healthPct} size={64} className="shrink-0" />
              <div className="min-w-0 flex-1 space-y-1 text-xs">
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
                    className="flex w-full items-center gap-1.5 rounded px-0.5 py-0.5 hover:bg-muted/60"
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                    {label}
                    <span className="ml-auto font-medium">{count}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid gap-2.5 lg:grid-cols-3">
          <div className="card-soft p-3 lg:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold">Recent onboarding</h3>
              <Link to="/companies" className="text-[10px] font-medium text-primary hover:underline">
                View all
              </Link>
            </div>
            <div className="space-y-2 md:hidden">
              {recent.map((c) => {
                const project = projects.find((p) => p.companyId === c.id);
                const managerName = resolveAssigneeLabel(c.onboardingManagerId, users, employees);
                return (
                  <div key={c.id} className="rounded-lg border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to="/companies/$companyId"
                        params={{ companyId: c.id }}
                        className="min-w-0 text-sm font-medium hover:underline"
                      >
                        {c.name}
                      </Link>
                      <StatusPill status={c.computedStatus} />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <ProgressBar value={c.progress} className="flex-1" />
                      <span className="text-[10px] text-muted-foreground">{c.progress}%</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                      <span className="truncate">Mgr: {managerName}</span>
                      {project ? (
                        <Button size="sm" variant="ghost" className="h-7 shrink-0 gap-0.5 px-1.5 text-primary" asChild>
                          <Link
                            to="/projects/$projectId"
                            params={{ projectId: project.id }}
                            search={{ tab: "onboarding" }}
                          >
                            Open <ArrowRight className="h-3 w-3" />
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden overflow-hidden rounded-lg border md:block">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 text-[10px] text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">Company</th>
                    <th className="px-2 py-1.5 text-left font-medium">Status</th>
                    <th className="px-2 py-1.5 text-left font-medium">Progress</th>
                    <th className="px-2 py-1.5 text-left font-medium">Manager</th>
                    <th className="px-2 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {recent.map((c) => {
                    const project = projects.find((p) => p.companyId === c.id);
                    const managerName = resolveAssigneeLabel(c.onboardingManagerId, users, employees);
                    return (
                      <tr key={c.id} className="border-t hover:bg-muted/30">
                        <td className="px-2 py-1.5 font-medium">
                          <Link
                            to="/companies/$companyId"
                            params={{ companyId: c.id }}
                            className="hover:underline"
                          >
                            {c.name}
                          </Link>
                        </td>
                        <td className="px-2 py-1.5">
                          <StatusPill status={c.computedStatus} />
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <ProgressBar value={c.progress} className="w-16" />
                            <span className="text-[10px] text-muted-foreground">{c.progress}%</span>
                          </div>
                        </td>
                        <td className="max-w-[80px] truncate px-2 py-1.5 text-muted-foreground">
                          {managerName}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          {project ? (
                            <Button size="sm" variant="ghost" className="h-7 gap-0.5 px-1.5 text-primary" asChild>
                              <Link
                                to="/projects/$projectId"
                                params={{ projectId: project.id }}
                                search={{ tab: "onboarding" }}
                              >
                                Open <ArrowRight className="h-3 w-3" />
                              </Link>
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card-soft p-3">
            <h3 className="mb-2 text-xs font-semibold">Recent activity</h3>
            <ol className="space-y-2">
              {activities.map((a) => (
                <li key={a.id} className="flex gap-2 text-xs">
                  <span
                    className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
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
                    <div className="line-clamp-2 leading-snug">{a.what}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {a.who} · {formatRelativeTime(a.createdAt)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
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
