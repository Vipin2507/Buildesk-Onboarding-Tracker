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
  LabelList,
} from "recharts";
import {
  Building2,
  TrendingUp,
  CheckCircle2,
  Clock,
  ArrowRight,
  PieChart as PieChartIcon,
  LayoutGrid,
  Activity as ActivityIcon,
  Zap,
  Calendar,
  ChevronDown,
} from "lucide-react";

import { DashboardDrillDownSheet } from "@/components/dashboard/dashboard-drill-down-sheet";
import type { DashboardDrillDownData } from "@/components/dashboard/dashboard-drill-down-sheet";
import { DashboardKpiCard } from "@/components/dashboard/dashboard-kpi-card";
import { DashboardPendingSummary } from "@/components/dashboard/dashboard-pending-summary";
import { OnboardingPipelineSection } from "@/components/dashboard/onboarding-pipeline";
import { PageWrap } from "@/components/page-header";
import { ProgressBar } from "@/components/progress-bar";
import { StatusPill } from "@/components/status-pill";
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

const AVATAR_TONES = [
  "bg-blue-50 text-blue-600 border-blue-200/60 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60",
  "bg-emerald-50 text-emerald-600 border-emerald-200/60 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60",
  "bg-purple-50 text-purple-600 border-purple-200/60 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/60",
  "bg-amber-50 text-amber-600 border-amber-200/60 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60",
  "bg-rose-50 text-rose-600 border-rose-200/60 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60",
  "bg-sky-50 text-sky-600 border-sky-200/60 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/60",
];

function getAvatarTone(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "CO";
}

function Dashboard() {
  const navigate = useNavigate();
  const { kpis, phaseStats, openDesignTickets, resolveDrillDown } = useDashboardOverview();
  const moduleData = useModuleAdoption();
  const health = useAccountHealth();
  const activities = useRecentActivity(6);
  const employees = useEmployeeStore((s) => s.employees);
  const users = useUserStore((s) => s.users);
  const projects = useProjectStore((s) => s.projects);
  const companies = useCompanyStore((s) => s.companies);

  const [drillDown, setDrillDown] = useState<DashboardDrillDownFilter | null>(null);
  const [activePhase, setActivePhase] = useState<ChecklistPhaseBucket | undefined>();
  const [timeframe, setTimeframe] = useState("Last 30 days");
  const [showTimeframeMenu, setShowTimeframeMenu] = useState(false);

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
      label: "Total Companies",
      value: kpis.totalCompanies,
      icon: Building2,
      trend: "+12%",
      variant: "primary" as const,
      filter: { type: "companies" as const, status: "all" as const },
    },
    {
      label: "In Progress",
      value: kpis.activeOnboarding,
      icon: TrendingUp,
      trend: "+8%",
      variant: "in_progress" as const,
      filter: { type: "companies" as const, status: "in_progress" as const },
    },
    {
      label: "Completed",
      value: kpis.completed,
      icon: CheckCircle2,
      trend: "+16%",
      variant: "completed" as const,
      filter: { type: "companies" as const, status: "completed" as const },
    },
    {
      label: "On Hold",
      value: kpis.onHold,
      icon: Clock,
      trend: "0%",
      variant: "on_hold" as const,
      filter: { type: "companies" as const, status: "on_hold" as const },
    },
  ];

  const reviewCount = kpis.companiesWithProgress.filter((c) => c.computedStatus === "review").length;
  const notStartedCount = kpis.companiesWithProgress.filter((c) => c.computedStatus === "not_started").length;

  const donutData = [
    {
      name: "Completed",
      value: kpis.completed,
      color: "#10b981", // green
      filter: { type: "companies" as const, status: "completed" as const },
    },
    {
      name: "In Progress",
      value: kpis.activeOnboarding,
      color: "#2563eb", // blue
      filter: { type: "companies" as const, status: "in_progress" as const },
    },
    {
      name: "Pending Review",
      value: reviewCount,
      color: "#06b6d4", // cyan
      filter: { type: "companies" as const, status: "review" as const },
    },
    {
      name: "On Hold",
      value: kpis.onHold,
      color: "#f59e0b", // amber
      filter: { type: "companies" as const, status: "on_hold" as const },
    },
    ...(notStartedCount > 0
      ? [
          {
            name: "Not Started",
            value: notStartedCount,
            color: "#94a3b8", // slate
            filter: { type: "companies" as const, status: "not_started" as const },
          },
        ]
      : []),
  ];

  const healthTotal = health.Healthy + health.Moderate + health.Critical;
  const healthPct = healthTotal ? Math.round((health.Healthy / healthTotal) * 100) : 100;

  const recent = kpis.companiesWithProgress
    .filter((c) => c.computedStatus !== "completed")
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 5);

  return (
    <PageWrap>
      {/* Top Header matching reference screenshot */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Track your progress, manage onboarding and grow your business.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Timeframe Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTimeframeMenu(!showTimeframeMenu)}
              className="flex items-center gap-2 rounded-xl border border-border/80 bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-2xs hover:bg-muted/40 transition-colors"
            >
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{timeframe}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>

            {showTimeframeMenu && (
              <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-xl border border-border/80 bg-card p-1 shadow-lg backdrop-blur-md">
                {["Last 7 days", "Last 30 days", "Last 90 days", "All time"].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setTimeframe(item);
                      setShowTimeframeMenu(false);
                    }}
                    className={`flex w-full items-center rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors ${
                      timeframe === item
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* New Onboarding Action */}
          <Button
            size="sm"
            className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all cursor-pointer"
            onClick={() => navigate({ to: "/companies" })}
          >
            + New Onboarding
          </Button>
        </div>
      </div>

      <div className="space-y-4 pt-1">
        {/* Smart Pending Work Overview */}
        <div id="overview">
          <DashboardPendingSummary
            openDesignTickets={openDesignTickets}
            overdueFollowUps={kpis.overdueFollowUpTasks ?? 0}
            tasksDueToday={kpis.tasksDueToday ?? 0}
            upcomingVisits={kpis.upcomingVisits ?? 0}
            upcomingRenewals={kpis.upcomingRenewals}
            onOpen={openDrillDown}
            activeFilter={drillDown}
          />
        </div>

        {/* Portfolio KPI Cards Row (4 cards matching screenshot) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {portfolioKpis.map((k, i) => (
            <DashboardKpiCard
              key={k.label}
              label={k.label}
              value={k.value}
              icon={k.icon}
              trend={k.trend}
              variant={k.variant}
              delay={i * 0.04}
              active={
                drillDown?.type === k.filter.type &&
                JSON.stringify(drillDown) === JSON.stringify(k.filter)
              }
              onClick={() => openDrillDown(k.filter)}
            />
          ))}
        </div>

        {/* Onboarding Pipeline Section */}
        <div id="pipeline">
          <OnboardingPipelineSection
            stats={phaseStats}
            activePhase={activePhase}
            onPhaseClick={openDrillDown}
          />
        </div>

        {/* Analytics 3-Column Row matching reference screenshot */}
        <div id="analytics" className="grid gap-3 lg:grid-cols-12">
          {/* Card 1: Onboarding Mix (Donut Chart) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08, ease: EASE }}
            className="rounded-2xl border border-border/70 bg-card p-4 shadow-2xs lg:col-span-4 flex flex-col justify-between"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <PieChartIcon className="h-4 w-4" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-foreground">Onboarding Mix</h3>
              </div>
              <span className="rounded-lg border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Chart ▾
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 my-auto py-2">
              {/* Donut Chart with Center Text */}
              <div className="relative h-44 w-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      innerRadius={52}
                      outerRadius={70}
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
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-lg border border-border/80 bg-popover px-2.5 py-1.5 text-xs shadow-md">
                              <span className="font-semibold text-foreground">{data.name}: </span>
                              <span className="font-bold text-primary">{data.value}</span>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black tabular-nums text-foreground leading-none">
                    {kpis.totalCompanies}
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground mt-0.5">Total</span>
                </div>
              </div>

              {/* Legend List */}
              <div className="flex flex-col gap-1.5 w-full sm:w-auto flex-1 sm:pl-2 text-xs">
                {donutData.map((d) => {
                  const selected =
                    drillDown?.type === "companies" &&
                    "status" in drillDown &&
                    drillDown.status === d.filter.status;

                  return (
                    <button
                      key={d.name}
                      type="button"
                      onClick={() => openDrillDown(d.filter)}
                      className={`group flex items-center justify-between rounded-lg px-2 py-1 text-left transition-colors hover:bg-muted/60 ${
                        selected ? "bg-muted" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: d.color }}
                        />
                        <span className="truncate text-muted-foreground group-hover:text-foreground transition-colors">
                          {d.name}
                        </span>
                      </div>
                      <span className="ml-2 font-bold tabular-nums text-foreground">{d.value}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {/* Card 2: Modules Opted (Bar Chart) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1, ease: EASE }}
            className="rounded-2xl border border-border/70 bg-card p-4 shadow-2xs lg:col-span-5 flex flex-col justify-between"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <LayoutGrid className="h-4 w-4" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-foreground">Modules Opted</h3>
              </div>
              <span className="text-xs font-semibold text-muted-foreground">
                {kpis.totalCompanies} companies ▾
              </span>
            </div>

            <div className="h-44 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={moduleData} margin={{ top: 18, right: 8, bottom: 4, left: -24 }}>
                  <defs>
                    <linearGradient id="modulesBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.6} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 9.5, fill: "var(--color-muted-foreground)" }}
                    stroke="var(--color-border)"
                    tickLine={false}
                    interval={0}
                    tickFormatter={(val) => {
                      if (val.length > 13) return val.slice(0, 11) + "…";
                      return val;
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 9.5, fill: "var(--color-muted-foreground)" }}
                    stroke="var(--color-border)"
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
                    formatter={(value: number) => {
                      const pct = kpis.totalCompanies
                        ? Math.round((Number(value) / kpis.totalCompanies) * 100)
                        : 0;
                      return [`${value} companies (${pct}%)`, "Opted In"];
                    }}
                  />
                  <Bar
                    dataKey="opted"
                    fill="url(#modulesBarGradient)"
                    radius={[6, 6, 0, 0]}
                  >
                    <LabelList
                      dataKey="opted"
                      position="top"
                      fill="var(--color-foreground)"
                      fontSize={11}
                      fontWeight={700}
                      offset={6}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Card 3: Account Health (Gauge & Legend with Bottom Wave) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.12, ease: EASE }}
            className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-4 shadow-2xs lg:col-span-3 flex flex-col justify-between"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                  <ActivityIcon className="h-4 w-4" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-foreground">Account Health</h3>
              </div>
            </div>

            <div className="flex items-center justify-around gap-2 my-auto py-3">
              {/* Circular Gauge */}
              <div className="relative flex flex-col items-center">
                <div className="relative h-20 w-20 flex items-center justify-center">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-muted/40"
                      strokeWidth="3.6"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-emerald-500 transition-all duration-1000 ease-out"
                      strokeDasharray={`${healthPct}, 100`}
                      strokeWidth="3.6"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-black text-foreground">{healthPct}%</span>
                  </div>
                </div>
                <span className="mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Healthy
                </span>
              </div>

              {/* Health Breakdown Legend */}
              <div className="space-y-1.5 text-xs">
                {[
                  { label: "Healthy" as const, color: "bg-emerald-500", count: health.Healthy },
                  { label: "Moderate" as const, color: "bg-amber-500", count: health.Moderate },
                  { label: "Critical" as const, color: "bg-rose-500", count: health.Critical },
                ].map(({ label, color, count }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => openDrillDown({ type: "account_health", health: label })}
                    className="flex w-28 items-center justify-between rounded-lg px-2 py-1 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${color}`} />
                      <span className="text-muted-foreground">{label}</span>
                    </div>
                    <span className="font-bold tabular-nums text-foreground">{count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Bottom Mint Wave Backdrop matching reference image */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 overflow-hidden opacity-35 dark:opacity-20">
              <svg
                viewBox="0 0 300 60"
                preserveAspectRatio="none"
                className="h-full w-full fill-emerald-400/30 text-emerald-500/20"
              >
                <path d="M0,35 C80,60 140,15 220,40 C260,50 280,30 300,35 L300,60 L0,60 Z" />
              </svg>
            </div>
          </motion.div>
        </div>

        {/* Bottom Row: Recent Onboarding Activity & Recent Activity */}
        <div id="recent" className="grid gap-3 lg:grid-cols-12">
          {/* Recent Onboarding Activity (Table with initials & avatars) */}
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-2xs lg:col-span-7 flex flex-col justify-between">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-bold text-foreground">
                    Recent Onboarding Activity
                  </h2>
                </div>
              </div>
              <Link
                to="/companies"
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
              >
                <span>View all</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Desktop Table View */}
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-[11px] font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-3.5 py-2.5">Company</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Progress</th>
                    <th className="px-3 py-2.5">Manager</th>
                    <th className="px-3 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {recent.map((c) => {
                    const project = projects.find((p) => p.companyId === c.id);
                    const managerName = resolveAssigneeLabel(c.onboardingManagerId, users, employees);
                    const tone = getAvatarTone(c.name);
                    const initials = getInitials(c.name);

                    return (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3.5 py-2.5">
                          <Link
                            to="/companies/$companyId"
                            params={{ companyId: c.id }}
                            className="group flex items-center gap-2.5"
                          >
                            <div
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border font-bold text-[10px] ${tone}`}
                            >
                              {initials}
                            </div>
                            <span className="font-semibold text-foreground group-hover:text-primary transition-colors truncate max-w-[150px] sm:max-w-[200px]">
                              {c.name}
                            </span>
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <StatusPill status={c.computedStatus} />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <ProgressBar value={c.progress} className="w-16 h-1.5" />
                            <span className="text-[11px] font-bold text-foreground tabular-nums">
                              {c.progress}%
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                              {managerName.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="truncate max-w-[100px] text-muted-foreground text-[11px]">
                              {managerName}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          {project ? (
                            <Link
                              to="/projects/$projectId"
                              params={{ projectId: project.id }}
                              search={{ tab: "onboarding" }}
                              className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline"
                            >
                              <span>Open</span>
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Activity Timeline Feed */}
          <div
            id="activity"
            className="rounded-2xl border border-border/70 bg-card p-4 shadow-2xs lg:col-span-5 flex flex-col justify-between"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                  <Clock className="h-4 w-4" />
                </div>
                <h2 className="text-xs sm:text-sm font-bold text-foreground">Recent Activity</h2>
              </div>
            </div>

            {activities.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground">
                No recent portfolio activity.
              </div>
            ) : (
              <div className="space-y-3 pl-1 flex-1">
                {activities.map((a) => {
                  const dotColor =
                    a.kind === "success"
                      ? "bg-emerald-500"
                      : a.kind === "warning"
                        ? "bg-amber-500"
                        : a.kind === "danger"
                          ? "bg-rose-500"
                          : "bg-blue-500";

                  return (
                    <div key={a.id} className="relative flex items-start gap-2.5 text-xs">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
                      <div className="min-w-0 flex-1 leading-snug">
                        <div className="text-foreground/90 font-medium line-clamp-1">{a.what}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {a.who} · {formatRelativeTime(a.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Drill-down Drawer Sheet */}
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