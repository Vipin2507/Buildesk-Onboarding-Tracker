import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
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
import { DashboardWorkQueues } from "@/components/dashboard/dashboard-work-queues";
import { MODULE_CATALOG } from "@/data/module-catalog";
import { summarizeChecklistPhases } from "@/lib/checklist";
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
  useActivityStore,
  useCompanyStore,
  useDashboardOverview,
  useEmployeeStore,
  useOnboardingStore,
  useProjectStore,
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

type RangeId = "7" | "30" | "90" | "all";
type ChartMode = "status" | "plan" | "region" | "health";
type ModuleAudience = "all" | "in_progress" | "completed" | "on_hold";

const RANGES: { id: RangeId; label: string; days: number | null }[] = [
  { id: "7", label: "Last 7 days", days: 7 },
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "90", label: "Last 90 days", days: 90 },
  { id: "all", label: "All time", days: null },
];

const CHART_MODES: { id: ChartMode; label: string }[] = [
  { id: "status", label: "By status" },
  { id: "plan", label: "By plan" },
  { id: "region", label: "By region" },
  { id: "health", label: "By health" },
];

const MODULE_AUDIENCES: { id: ModuleAudience; label: string }[] = [
  { id: "all", label: "All companies" },
  { id: "in_progress", label: "In progress" },
  { id: "completed", label: "Completed" },
  { id: "on_hold", label: "On hold" },
];

const SLICE_COLORS = [
  "#2563eb",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#06b6d4",
  "#f43f5e",
  "#64748b",
  "#84cc16",
];

function localDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  date.setDate(date.getDate() + days);
  return localDate(date);
}

function companyStartDate(company: {
  startDate?: string;
  agreementDate?: string;
  createdAt?: string;
}) {
  const raw = company.startDate || company.agreementDate || company.createdAt || "";
  return raw.slice(0, 10);
}

function shareLabel(part: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function Dashboard() {
  const navigate = useNavigate();
  const { kpis, openDesignTickets, resolveDrillDown } = useDashboardOverview();
  const employees = useEmployeeStore((s) => s.employees);
  const users = useUserStore((s) => s.users);
  const projects = useProjectStore((s) => s.projects);
  const companies = useCompanyStore((s) => s.companies);
  const checklistItems = useOnboardingStore((s) => s.checklistItems);
  const activitiesAll = useActivityStore((s) => s.activities);

  const [drillDown, setDrillDown] = useState<DashboardDrillDownFilter | null>(null);
  const [activePhase, setActivePhase] = useState<ChecklistPhaseBucket | undefined>();
  const [rangeId, setRangeId] = useState<RangeId>("all");
  const [openMenu, setOpenMenu] = useState<"range" | "chart" | "modules" | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>("status");
  const [moduleAudience, setModuleAudience] = useState<ModuleAudience>("all");
  const [moduleLimit, setModuleLimit] = useState<number | null>(6);
  const [sliceOverride, setSliceOverride] = useState<{
    title: string;
    subtitle: string;
    companies: typeof kpis.companiesWithProgress;
  } | null>(null);
  const [showAllPortfolio, setShowAllPortfolio] = useState(false);

  const range = RANGES.find((item) => item.id === rangeId) ?? RANGES[3];
  const today = localDate();
  const rangeStart = range.days ? addDays(today, -(range.days - 1)) : null;

  const rangedCompanies = useMemo(() => {
    if (!rangeStart) return kpis.companiesWithProgress;
    return kpis.companiesWithProgress.filter((company) => {
      const start = companyStartDate(company);
      return Boolean(start) && start >= rangeStart && start <= today;
    });
  }, [kpis.companiesWithProgress, rangeStart, today]);

  const rangedIds = useMemo(
    () => new Set(rangedCompanies.map((company) => company.id)),
    [rangedCompanies],
  );

  function inAudience(company: (typeof rangedCompanies)[number], audience: ModuleAudience) {
    if (audience === "all") return true;
    if (audience === "completed") return company.isLive || company.computedStatus === "completed";
    if (audience === "in_progress") return company.computedStatus === "in_progress";
    return company.status === "on_hold";
  }

  const moduleCompanies = rangedCompanies.filter((company) => inAudience(company, moduleAudience));

  const moduleData = useMemo(() => {
    const rows = MODULE_CATALOG.map((mod) => ({
      key: mod.key,
      name: mod.label,
      opted: moduleCompanies.filter((company) =>
        company.modules.some((module) => module.moduleKey === mod.key && module.optedIn),
      ).length,
    })).sort((a, b) => b.opted - a.opted || a.name.localeCompare(b.name));
    return moduleLimit ? rows.slice(0, moduleLimit) : rows;
  }, [moduleCompanies, moduleLimit]);

  const phaseStats = useMemo(() => {
    const projectIds = new Set(
      projects.filter((project) => rangedIds.has(project.companyId)).map((project) => project.id),
    );
    return summarizeChecklistPhases(
      checklistItems.filter((item) => projectIds.has(item.projectId)),
    );
  }, [projects, checklistItems, rangedIds]);

  const activities = useMemo(() => {
    return [...activitiesAll]
      .filter((entry) => {
        if (!rangeStart) return true;
        const day = entry.createdAt.slice(0, 10);
        if (day < rangeStart || day > today) return false;
        return !entry.companyId || rangedIds.has(entry.companyId);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6);
  }, [activitiesAll, rangeStart, today, rangedIds]);

  useEffect(() => {
    if (!openMenu) return;
    function close(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-dashboard-menu]")) return;
      setOpenMenu(null);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [openMenu]);

  const drillDownData = useMemo(() => {
    if (sliceOverride) {
      return { kind: "companies" as const, companies: sliceOverride.companies };
    }
    if (!drillDown) return null;
    const resolved = resolveDrillDown(drillDown);
    if (!rangeStart) return resolved;
    if (resolved.kind === "companies") {
      return {
        kind: "companies" as const,
        companies: resolved.companies.filter((company) => rangedIds.has(company.id)),
      };
    }
    if (resolved.kind === "account_health") {
      return {
        kind: "account_health" as const,
        companies: resolved.companies.filter((company) => rangedIds.has(company.id)),
      };
    }
    if (resolved.kind === "checklist") {
      return {
        kind: "checklist" as const,
        groups: resolved.groups.filter((group) => rangedIds.has(group.companyId)),
      };
    }
    return resolved;
  }, [sliceOverride, drillDown, resolveDrillDown, rangeStart, rangedIds]);

  function openDrillDown(filter: DashboardDrillDownFilter) {
    setSliceOverride(null);
    setDrillDown(filter);
    if (filter.type === "checklist") setActivePhase(filter.phase);
    else setActivePhase(undefined);
  }

  function closeDrillDown() {
    setDrillDown(null);
    setSliceOverride(null);
    setActivePhase(undefined);
  }

  function openCompanySlice(title: string, subtitle: string, rows: typeof rangedCompanies) {
    setSliceOverride({ title, subtitle, companies: rows });
    setDrillDown({ type: "companies", status: "all" });
    setActivePhase(undefined);
  }

  const companyNameById = (id: string) => companies.find((c) => c.id === id)?.name ?? "Unknown";

  const totalInRange = rangedCompanies.length;
  const inProgressCount = rangedCompanies.filter(
    (company) => company.computedStatus === "in_progress",
  ).length;
  const completedCount = rangedCompanies.filter(
    (company) => company.isLive || company.computedStatus === "completed",
  ).length;
  const onHoldCount = rangedCompanies.filter((company) => company.status === "on_hold").length;
  const portfolioBase = kpis.totalCompanies;
  const rangeNote = range.days
    ? `Companies whose start date is in the last ${range.days} days`
    : "All companies, any start date";

  const portfolioKpis = [
    {
      label: "Total Companies",
      value: totalInRange,
      icon: Building2,
      trend: shareLabel(totalInRange, portfolioBase),
      trendTitle: `${totalInRange} of ${portfolioBase} companies. ${rangeNote}.`,
      variant: "primary" as const,
      filter: { type: "companies" as const, status: "all" as const },
    },
    {
      label: "In Progress",
      value: inProgressCount,
      icon: TrendingUp,
      trend: shareLabel(inProgressCount, totalInRange),
      trendTitle: `${inProgressCount} of ${totalInRange} companies in this range are still onboarding.`,
      variant: "in_progress" as const,
      filter: { type: "companies" as const, status: "in_progress" as const },
    },
    {
      label: "Completed",
      value: completedCount,
      icon: CheckCircle2,
      trend: shareLabel(completedCount, totalInRange),
      trendTitle: `${completedCount} of ${totalInRange} companies in this range are live or completed.`,
      variant: "completed" as const,
      filter: { type: "companies" as const, status: "completed" as const },
    },
    {
      label: "On Hold",
      value: onHoldCount,
      icon: Clock,
      trend: shareLabel(onHoldCount, totalInRange),
      trendTitle: `${onHoldCount} of ${totalInRange} companies in this range are on hold.`,
      variant: "on_hold" as const,
      filter: { type: "companies" as const, status: "on_hold" as const },
    },
  ];

  const reviewCount = rangedCompanies.filter((c) => c.computedStatus === "review").length;
  const notStartedCount = rangedCompanies.filter((c) => c.computedStatus === "not_started").length;

  const chartSlices = (() => {
    if (chartMode === "status") {
      return [
        {
          name: "Completed",
          value: completedCount,
          color: "#10b981",
          rows: rangedCompanies.filter((c) => c.isLive || c.computedStatus === "completed"),
        },
        {
          name: "In Progress",
          value: inProgressCount,
          color: "#2563eb",
          rows: rangedCompanies.filter((c) => c.computedStatus === "in_progress"),
        },
        {
          name: "Pending Review",
          value: reviewCount,
          color: "#06b6d4",
          rows: rangedCompanies.filter((c) => c.computedStatus === "review"),
        },
        {
          name: "On Hold",
          value: onHoldCount,
          color: "#f59e0b",
          rows: rangedCompanies.filter((c) => c.status === "on_hold"),
        },
        {
          name: "Not Started",
          value: notStartedCount,
          color: "#94a3b8",
          rows: rangedCompanies.filter((c) => c.computedStatus === "not_started"),
        },
      ].filter((slice) => slice.value > 0);
    }
    const field = chartMode as "plan" | "region" | "health";
    const counts = new Map<string, typeof rangedCompanies>();
    for (const company of rangedCompanies) {
      const name = String(company[field] || "Unset");
      const rows = counts.get(name) ?? [];
      rows.push(company);
      counts.set(name, rows);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      .map(([name, rows], index) => ({
        name,
        value: rows.length,
        color: SLICE_COLORS[index % SLICE_COLORS.length],
        rows,
      }));
  })();

  const chartTotal = chartSlices.reduce((sum, slice) => sum + slice.value, 0);

  const healthCounts = {
    Healthy: rangedCompanies.filter((c) => c.health === "Healthy").length,
    Moderate: rangedCompanies.filter((c) => c.health === "Moderate").length,
    Critical: rangedCompanies.filter((c) => c.health === "Critical").length,
  };
  const healthTotal = healthCounts.Healthy + healthCounts.Moderate + healthCounts.Critical;
  const healthPct = healthTotal ? Math.round((healthCounts.Healthy / healthTotal) * 100) : 0;

  const recent = [...rangedCompanies]
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
            {range.days
              ? `${totalInRange} companies started in the last ${range.days} days. Status percentages are their share of that set. Total is that set’s share of every company.`
              : "All companies. Each percentage is that status’s share of the portfolio."}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {/* Timeframe Dropdown */}
          <div className="relative" data-dashboard-menu>
            <button
              type="button"
              title="Filters companies by their onboarding start date. Open work above stays current."
              onClick={() => setOpenMenu(openMenu === "range" ? null : "range")}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border/80 bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-2xs transition-colors hover:bg-muted/40 sm:w-auto sm:text-xs"
            >
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{range.label}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>

            {openMenu === "range" && (
              <div className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-xl border border-border/80 bg-card p-1 shadow-lg">
                {RANGES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setRangeId(item.id);
                      setOpenMenu(null);
                      setSliceOverride(null);
                    }}
                    className={`flex w-full items-center rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors ${
                      rangeId === item.id
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* New Onboarding Action */}
          <Button
            size="sm"
            className="min-h-12 w-full cursor-pointer rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 sm:w-auto"
            onClick={() => navigate({ to: "/companies" })}
          >
            + New Onboarding
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 pt-1">
        {/* Smart Pending Work Overview */}
        <div id="overview" className="order-1">
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

        <div className="order-2">
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {portfolioKpis.map((k, i) => (
              <div
                key={k.label}
                className={i > 1 && !showAllPortfolio ? "max-md:hidden" : undefined}
              >
                <DashboardKpiCard
                  label={k.label}
                  value={k.value}
                  icon={k.icon}
                  trend={k.trend}
                  trendTitle={k.trendTitle}
                  variant={k.variant}
                  delay={i * 0.04}
                  active={
                    drillDown?.type === k.filter.type &&
                    JSON.stringify(drillDown) === JSON.stringify(k.filter)
                  }
                  onClick={() => openDrillDown(k.filter)}
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-2 min-h-12 w-full rounded-xl border bg-card text-sm font-semibold md:hidden"
            onClick={() => setShowAllPortfolio((open) => !open)}
          >
            {showAllPortfolio ? "Show fewer numbers" : "More portfolio numbers"}
          </button>
        </div>

        {/* Onboarding Pipeline Section */}
        <div id="pipeline" className="order-4 md:order-3">
          <OnboardingPipelineSection
            stats={phaseStats}
            activePhase={activePhase}
            onPhaseClick={openDrillDown}
          />
        </div>

        {/* Analytics 3-Column Row matching reference screenshot */}
        <div id="analytics" className="order-5 grid gap-2.5 md:order-4 lg:grid-cols-12">
          {/* Card 1: Onboarding Mix (Donut Chart) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.08, ease: EASE }}
            className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-2xs lg:col-span-4 flex flex-col justify-between"
          >
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <PieChartIcon className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-foreground">Onboarding Mix</h3>
              </div>
              <div className="relative" data-dashboard-menu>
                <button
                  type="button"
                  onClick={() => setOpenMenu(openMenu === "chart" ? null : "chart")}
                  className="rounded-lg border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {CHART_MODES.find((mode) => mode.id === chartMode)?.label} ▾
                </button>
                {openMenu === "chart" && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-32 overflow-hidden rounded-xl border border-border/80 bg-card p-1 shadow-lg">
                    {CHART_MODES.map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => {
                          setChartMode(mode.id);
                          setOpenMenu(null);
                        }}
                        className={`flex w-full rounded-lg px-2 py-1.5 text-left text-[11px] ${
                          chartMode === mode.id
                            ? "bg-primary font-semibold text-primary-foreground"
                            : "hover:bg-muted"
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 my-auto py-1">
              {/* Donut Chart with Center Text */}
              <div className="relative h-36 w-36 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartSlices}
                      innerRadius={42}
                      outerRadius={58}
                      dataKey="value"
                      paddingAngle={3}
                      stroke="none"
                      className="cursor-pointer outline-none"
                      onClick={(_, index) => {
                        const seg = chartSlices[index];
                        if (seg)
                          openCompanySlice(
                            seg.name,
                            `${seg.value} companies · ${range.label}`,
                            seg.rows,
                          );
                      }}
                    >
                      {chartSlices.map((d, i) => (
                        <Cell
                          key={i}
                          fill={d.color}
                          className="transition-opacity hover:opacity-80"
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-lg border border-border/80 bg-popover px-2 py-1 text-xs shadow-md">
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
                  <span className="text-xl font-black tabular-nums text-foreground leading-none">
                    {chartTotal}
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground mt-0.5">
                    Total
                  </span>
                </div>
              </div>

              {/* Legend List */}
              <div className="flex flex-col gap-1 w-full sm:w-auto flex-1 sm:pl-2 text-xs">
                {chartSlices.map((d) => {
                  const selected = sliceOverride?.title === d.name;

                  return (
                    <button
                      key={d.name}
                      type="button"
                      onClick={() =>
                        openCompanySlice(d.name, `${d.value} companies · ${range.label}`, d.rows)
                      }
                      className={`group flex items-center justify-between rounded-lg px-2 py-0.5 text-left transition-colors hover:bg-muted/60 ${
                        selected ? "bg-muted" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: d.color }}
                        />
                        <span className="truncate text-muted-foreground group-hover:text-foreground transition-colors text-[11px]">
                          {d.name}
                        </span>
                      </div>
                      <span className="ml-2 font-bold tabular-nums text-foreground text-xs">
                        {d.value}
                      </span>
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
            transition={{ duration: 0.32, delay: 0.1, ease: EASE }}
            className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-2xs lg:col-span-5 flex flex-col justify-between"
          >
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <LayoutGrid className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-foreground">Modules Opted</h3>
              </div>
              <div className="relative" data-dashboard-menu>
                <button
                  type="button"
                  title="Recounts each module for this group of companies in the selected date range."
                  onClick={() => setOpenMenu(openMenu === "modules" ? null : "modules")}
                  className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  {moduleCompanies.length} companies ▾
                </button>
                {openMenu === "modules" && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-xl border border-border/80 bg-card p-1 shadow-lg">
                    {MODULE_AUDIENCES.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setModuleAudience(item.id);
                          setOpenMenu(null);
                        }}
                        className={`flex w-full rounded-lg px-2 py-1.5 text-left text-[11px] ${
                          moduleAudience === item.id
                            ? "bg-primary font-semibold text-primary-foreground"
                            : "hover:bg-muted"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                    <div className="my-1 h-px bg-border" />
                    <button
                      type="button"
                      onClick={() => {
                        setModuleLimit(6);
                        setOpenMenu(null);
                      }}
                      className={`flex w-full rounded-lg px-2 py-1.5 text-left text-[11px] ${
                        moduleLimit === 6
                          ? "bg-primary font-semibold text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      Top 6 modules
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setModuleLimit(null);
                        setOpenMenu(null);
                      }}
                      className={`flex w-full rounded-lg px-2 py-1.5 text-left text-[11px] ${
                        moduleLimit === null
                          ? "bg-primary font-semibold text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      All modules
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="h-36 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={moduleData} margin={{ top: 14, right: 6, bottom: 2, left: -26 }}>
                  <defs>
                    <linearGradient id="modulesBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    opacity={0.6}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }}
                    stroke="var(--color-border)"
                    tickLine={false}
                    interval={0}
                    tickFormatter={(val) => {
                      if (val.length > 13) return val.slice(0, 11) + "…";
                      return val;
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }}
                    stroke="var(--color-border)"
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
                    formatter={(value: number) => {
                      const pct = moduleCompanies.length
                        ? Math.round((Number(value) / moduleCompanies.length) * 100)
                        : 0;
                      return [`${value} companies (${pct}%)`, "Opted in"];
                    }}
                  />
                  <Bar
                    dataKey="opted"
                    fill="url(#modulesBarGradient)"
                    radius={[5, 5, 0, 0]}
                    className="cursor-pointer"
                    onClick={(_, index) => {
                      const match = moduleData[index];
                      if (!match) return;
                      const rows = moduleCompanies.filter((company) =>
                        company.modules.some(
                          (module) => module.moduleKey === match.key && module.optedIn,
                        ),
                      );
                      openCompanySlice(
                        match.name,
                        `${rows.length} opted in · ${range.label}`,
                        rows,
                      );
                    }}
                  >
                    <LabelList
                      dataKey="opted"
                      position="top"
                      fill="var(--color-foreground)"
                      fontSize={10.5}
                      fontWeight={700}
                      offset={4}
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
            transition={{ duration: 0.32, delay: 0.12, ease: EASE }}
            className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-3.5 shadow-2xs lg:col-span-3 flex flex-col justify-between"
          >
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                  <ActivityIcon className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-foreground">Account Health</h3>
              </div>
            </div>

            <div className="flex items-center justify-around gap-2 my-auto py-2">
              {/* Circular Gauge */}
              <div className="relative flex flex-col items-center">
                <div className="relative h-16 w-16 flex items-center justify-center">
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
                    <span className="text-base font-black text-foreground">{healthPct}%</span>
                  </div>
                </div>
                <span className="mt-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Healthy
                </span>
              </div>

              {/* Health Breakdown Legend */}
              <div className="space-y-1 text-xs">
                {[
                  {
                    label: "Healthy" as const,
                    color: "bg-emerald-500",
                    count: healthCounts.Healthy,
                  },
                  {
                    label: "Moderate" as const,
                    color: "bg-amber-500",
                    count: healthCounts.Moderate,
                  },
                  {
                    label: "Critical" as const,
                    color: "bg-rose-500",
                    count: healthCounts.Critical,
                  },
                ].map(({ label, color, count }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => openDrillDown({ type: "account_health", health: label })}
                    className="flex w-24 items-center justify-between rounded-lg px-1.5 py-0.5 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
                      <span className="text-muted-foreground text-[11px]">{label}</span>
                    </div>
                    <span className="font-bold tabular-nums text-foreground text-xs">{count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Bottom Mint Wave Backdrop matching reference image */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 overflow-hidden opacity-30 dark:opacity-15">
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
        <div id="recent" className="order-3 grid gap-3 md:order-5 lg:grid-cols-12">
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

            <div className="space-y-2 md:hidden">
              {recent.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No companies in this range yet.
                </p>
              ) : (
                recent.map((c) => {
                  const managerName = resolveAssigneeLabel(c.onboardingManagerId, users, employees);
                  return (
                    <Link
                      key={c.id}
                      to="/companies/$companyId"
                      params={{ companyId: c.id }}
                      className="flex min-h-12 items-center gap-3 rounded-xl border border-border/70 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{c.name}</div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="truncate">{managerName}</span>
                          <span className="font-semibold text-foreground">{c.progress}%</span>
                        </div>
                      </div>
                      <StatusPill status={c.computedStatus} />
                    </Link>
                  );
                })
              )}
            </div>

            <div className="hidden overflow-x-auto rounded-xl border border-border/60 md:block">
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
                    const managerName = resolveAssigneeLabel(
                      c.onboardingManagerId,
                      users,
                      employees,
                    );
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

        <div className="order-6">
          <DashboardWorkQueues companies={kpis.companiesWithProgress} />
        </div>
      </div>

      {/* Drill-down Drawer Sheet */}
      <DashboardDrillDownSheet
        open={Boolean(drillDown)}
        filter={drillDown}
        data={drillDownData}
        onClose={closeDrillDown}
        companyNameById={companyNameById}
        title={sliceOverride?.title}
        subtitle={sliceOverride?.subtitle}
      />
    </PageWrap>
  );
}
