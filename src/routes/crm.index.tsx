import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BriefcaseBusiness,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  LifeBuoy,
  Plus,
  Rocket,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CrmDashboardActivityFeed } from "@/components/crm/crm-dashboard-activity-feed";
import { CrmDashboardDrillDownSheet } from "@/components/crm/crm-dashboard-drill-down";
import { CrmDashboardPendingSummary } from "@/components/crm/crm-dashboard-pending-summary";
import { CrmDashboardWorkloadCard } from "@/components/crm/crm-dashboard-workload-card";
import { DashboardKpiCard } from "@/components/dashboard/dashboard-kpi-card";
import { OnboardingPipelineSection } from "@/components/dashboard/onboarding-pipeline";
import { PageWrap } from "@/components/page-header";
import { ProgressBar, ProgressRing } from "@/components/progress-bar";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  DesignTicketPageHeader,
} from "@/components/design-ticket/design-ticket-shared";
import type { ChecklistPhaseBucket } from "@/lib/checklist";
import { isCrmAccountEnded } from "@/lib/crm-account-status";
import { crmDashboardSearchSchema } from "@/lib/crm-route-search";
import {
  crmDrillDownFilterKey,
  useCrmDashboardOverview,
  type CrmDashboardDrillDownFilter,
} from "@/stores/crm-dashboard-selectors";
import { useCrmAccountStore, useCrmOnboardingStore } from "@/stores";

export const Route = createFileRoute("/crm/")({
  beforeLoad: ({ search }) => {
    if ((search as { tab?: string }).tab === "activity") {
      throw redirect({ to: "/crm/activity" });
    }
  },
  validateSearch: (search) => crmDashboardSearchSchema.parse(search),
  component: CrmDashboardPage,
});

const EASE = [0.22, 1, 0.36, 1] as const;

function CrmDashboardPage() {
  const navigate = useNavigate();
  const accounts = useCrmAccountStore((s) => s.accounts);
  const ensure = useCrmOnboardingStore((s) => s.ensureForCompany);
  const overview = useCrmDashboardOverview();

  const [drillDown, setDrillDown] = useState<CrmDashboardDrillDownFilter | null>(null);
  const [activePhase, setActivePhase] = useState<ChecklistPhaseBucket | undefined>();

  useEffect(() => {
    for (const a of accounts) ensure(a.id, a.companyType);
  }, [accounts, ensure]);

  const drillDownData = useMemo(
    () => (drillDown ? overview.resolveDrillDown(drillDown) : null),
    [drillDown, overview],
  );

  function openDrillDown(filter: CrmDashboardDrillDownFilter) {
    setDrillDown(filter);
    if (filter.type === "masters") setActivePhase(filter.phase);
    else setActivePhase(undefined);
  }

  function closeDrillDown() {
    setDrillDown(null);
    setActivePhase(undefined);
  }

  const { kpis, pending, phaseStats, health, moduleAdoption, recentActivity, rows } = overview;

  const progressBuckets = useMemo(() => {
    const low = rows.filter((r) => r.progress < 40).length;
    const mid = rows.filter((r) => r.progress >= 40 && r.progress < 75).length;
    const high = rows.filter((r) => r.progress >= 75).length;
    return [
      {
        name: "<40%",
        value: low,
        color: "var(--color-destructive)",
        filter: { type: "progress" as const, bucket: "low" as const },
      },
      {
        name: "40–74%",
        value: mid,
        color: "var(--color-warning)",
        filter: { type: "progress" as const, bucket: "mid" as const },
      },
      {
        name: "75%+",
        value: high,
        color: "var(--color-success)",
        filter: { type: "progress" as const, bucket: "high" as const },
      },
    ];
  }, [rows]);

  const portfolioKpis = [
    {
      label: "Accounts",
      value: kpis.totalAccounts,
      icon: BriefcaseBusiness,
      tone: "bg-primary/10 text-primary",
      filter: { type: "accounts" as const, status: "all" as const },
    },
    {
      label: "Onboarding",
      value: kpis.onboarding,
      icon: ClipboardList,
      tone: "bg-warning/15 text-warning-foreground",
      filter: { type: "accounts" as const, status: "onboarding" as const },
    },
    {
      label: "Live",
      value: kpis.live,
      icon: Rocket,
      tone: "bg-success/15 text-success",
      filter: { type: "accounts" as const, status: "live" as const },
    },
    {
      label: "Avg completion %",
      value: kpis.avgCompletion,
      icon: TrendingUp,
      tone: "bg-info/15 text-info",
      filter: { type: "progress" as const, bucket: "mid" as const },
    },
  ];

  const opsKpis = [
    {
      label: "Pending meetings",
      value: kpis.pendingBookings,
      icon: Calendar,
      tone: "bg-warning/15 text-warning-foreground",
      onClick: () => navigate({ to: "/crm/bookings", search: { tab: "pending" } }),
      activeKey: null as string | null,
    },
    {
      label: "Upcoming calls",
      value: kpis.upcomingBookings,
      icon: CalendarClock,
      tone: "bg-primary/10 text-primary",
      onClick: () => navigate({ to: "/crm/bookings", search: { tab: "upcoming" } }),
      activeKey: null as string | null,
    },
    {
      label: "Portal tickets",
      value: kpis.openSupportTickets,
      icon: LifeBuoy,
      tone: "bg-info/15 text-info",
      filter: { type: "support" as const },
      activeKey: crmDrillDownFilterKey({ type: "support" }),
    },
  ];

  const donutData = [
    {
      name: "Live",
      value: kpis.live,
      color: "var(--color-success)",
      filter: { type: "accounts" as const, status: "live" as const },
    },
    {
      name: "Onboarding",
      value: kpis.onboarding,
      color: "var(--color-warning)",
      filter: { type: "accounts" as const, status: "onboarding" as const },
    },
    {
      name: "Active",
      value: kpis.active,
      color: "var(--color-info)",
      filter: { type: "accounts" as const, status: "active" as const },
    },
    {
      name: "Closed",
      value: kpis.closed,
      color: "var(--color-destructive)",
      filter: { type: "accounts" as const, status: "closed" as const },
    },
  ].filter((d) => d.value > 0 || kpis.totalAccounts === 0);

  const healthTotal = health.Healthy + health.Moderate + health.Critical;
  const healthPct = healthTotal ? Math.round((health.Healthy / healthTotal) * 100) : 0;

  const recent = rows
    .filter((r) => r.status !== "live" && !isCrmAccountEnded(r.status))
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 5);

  const chartModules =
    moduleAdoption.length > 0
      ? moduleAdoption
      : [{ key: "none", name: "No modules", fullName: "None enabled", opted: 0 }];

  return (
    <PageWrap compact>
      <DesignTicketPageHeader
        compact
        title="CRM Dashboard"
        subtitle="Pending work and onboarding status across CRM accounts."
        actions={
          <Button
            size="sm"
            className="h-8 gap-1 bg-primary text-xs"
            onClick={() => navigate({ to: "/crm/accounts" })}
          >
            <Plus className="h-3.5 w-3.5" />
            New account
          </Button>
        }
      />

      <div className="space-y-2.5">
        <CrmDashboardPendingSummary
          overdue={pending.overdue}
          mastersCollect={pending.mastersCollect}
          mastersUpload={pending.mastersUpload}
          mastersLive={pending.mastersLive}
          migrations={pending.migrations}
          training={pending.training}
          reports={pending.reports}
          tickets={pending.tickets}
          highPriority={pending.highPriority}
          bookings={pending.bookings}
          support={pending.support}
          onOpen={openDrillDown}
          onNavigate={(to, search) => void navigate({ to, search })}
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
              active={crmDrillDownFilterKey(drillDown) === crmDrillDownFilterKey(k.filter)}
              onClick={() => openDrillDown(k.filter)}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {opsKpis.map((k, i) => (
            <DashboardKpiCard
              key={k.label}
              compact
              label={k.label}
              value={k.value}
              icon={k.icon}
              tone={k.tone}
              delay={0.12 + i * 0.03}
              active={
                k.filter
                  ? crmDrillDownFilterKey(drillDown) === k.activeKey
                  : false
              }
              onClick={
                k.onClick ??
                (k.filter ? () => openDrillDown(k.filter!) : undefined)
              }
            />
          ))}
        </div>

        <OnboardingPipelineSection
          compact
          stats={phaseStats}
          activePhase={activePhase}
          onPhaseClick={(filter) => {
            if (filter.type === "checklist") {
              openDrillDown({ type: "masters", phase: filter.phase });
            }
          }}
        />

        <div className="grid gap-2.5 lg:grid-cols-12">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08, ease: EASE }}
            className="card-soft p-3 lg:col-span-3"
          >
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-xs font-semibold">Account mix</h3>
              <Pill tone="info">Click</Pill>
            </div>
            <div className="h-28">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={donutData.length ? donutData : [{ name: "Empty", value: 1, color: "var(--color-muted)" }]}
                    innerRadius={28}
                    outerRadius={46}
                    dataKey="value"
                    paddingAngle={2}
                    stroke="none"
                    className="cursor-pointer outline-none"
                    onClick={(_, index) => {
                      const seg = donutData[index];
                      if (seg?.filter) openDrillDown(seg.filter);
                    }}
                  >
                    {(donutData.length
                      ? donutData
                      : [{ name: "Empty", value: 1, color: "var(--color-muted)" }]
                    ).map((d, i) => (
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

          <CrmDashboardWorkloadCard
            pending={pending}
            mastersProgressPct={phaseStats.progressPercent}
            mastersApplicable={phaseStats.applicable}
            onOpen={openDrillDown}
            onNavigate={(to, search) => void navigate({ to, search })}
            activeFilter={drillDown}
          />

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1, ease: EASE }}
            className="card-soft p-3 lg:col-span-3"
          >
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-xs font-semibold">Modules opted</h3>
              <span className="text-[10px] text-muted-foreground">{kpis.totalAccounts} accounts</span>
            </div>
            <div className="h-28">
              <ResponsiveContainer>
                <BarChart data={chartModules} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                  <CartesianGrid vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 8 }} stroke="var(--color-muted-foreground)" interval={0} angle={-20} textAnchor="end" height={36} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 9 }} stroke="var(--color-muted-foreground)" />
                  <Tooltip
                    cursor={{ fill: "var(--color-muted)" }}
                    formatter={(value: number, _name, item) => [
                      value,
                      (item?.payload as { fullName?: string })?.fullName ?? "Enabled",
                    ]}
                  />
                  <Bar
                    dataKey="opted"
                    fill="var(--color-primary)"
                    radius={[4, 4, 0, 0]}
                    className="cursor-pointer"
                    onClick={(data) => {
                      const key = (data as { key?: string })?.key;
                      if (key && key !== "none") openDrillDown({ type: "modules", key });
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.12, ease: EASE }}
            className="card-soft p-3 lg:col-span-3"
          >
            <h3 className="mb-2 text-xs font-semibold">Health & completion</h3>
            <div className="flex items-center gap-3">
              <ProgressRing value={healthPct} size={56} className="shrink-0" />
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
                    onClick={() => openDrillDown({ type: "health", bucket: label })}
                    className="flex w-full items-center gap-1.5 rounded px-0.5 py-0.5 hover:bg-muted/60"
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                    {label}
                    <span className="ml-auto font-medium">{count}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 space-y-1">
              <div className="text-[10px] text-muted-foreground">Completion spread</div>
              <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                {progressBuckets.map((b) => (
                  <button
                    key={b.name}
                    type="button"
                    title={`${b.name}: ${b.value}`}
                    onClick={() => openDrillDown(b.filter)}
                    className="h-full transition-opacity hover:opacity-80"
                    style={{
                      width: rows.length ? `${(b.value / rows.length) * 100}%` : "33%",
                      background: b.color,
                      minWidth: b.value > 0 ? 4 : 0,
                    }}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                {progressBuckets.map((b) => (
                  <button
                    key={b.name}
                    type="button"
                    onClick={() => openDrillDown(b.filter)}
                    className="hover:text-foreground"
                  >
                    {b.name} ({b.value})
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid gap-2.5 lg:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.14, ease: EASE }}
            className="card-soft p-3 lg:col-span-2"
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold">Active onboarding</h3>
              <Link
                to="/crm/accounts"
                className="text-[10px] font-medium text-primary hover:underline"
              >
                View all
              </Link>
            </div>

            {recent.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <CheckCircle2 className="h-6 w-6 text-success" />
                <p className="text-xs text-muted-foreground">No active onboarding accounts.</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => navigate({ to: "/crm/accounts" })}
                >
                  Manage accounts
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2 md:hidden">
                  {recent.map((a) => (
                    <Link
                      key={a.id}
                      to="/crm/accounts/$accountId"
                      params={{ accountId: a.id }}
                      className="block rounded-lg border bg-card p-3 transition-colors hover:bg-muted/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 text-sm font-medium">{a.name}</div>
                        <Pill tone={a.overdue ? "danger" : "muted"}>{a.status}</Pill>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <ProgressBar value={a.progress} className="flex-1" />
                        <span className="text-[10px] text-muted-foreground">{a.progress}%</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                        <span className="truncate">{a.stageLabel}</span>
                        <span className="inline-flex items-center gap-0.5 text-primary">
                          Open <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                      <div className="mt-1.5 space-y-0.5 text-[10px] text-muted-foreground">
                        <div className="truncate">Sales: {a.salesManagerName || "—"}</div>
                        <div className="truncate">Support 1: {a.supportManager1 || "—"}</div>
                        <div className="truncate">Support 2: {a.supportManager2 || "—"}</div>
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="hidden overflow-hidden rounded-lg border md:block">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/60 text-[10px] text-muted-foreground">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium">Account</th>
                        <th className="px-2 py-1.5 text-left font-medium">Status</th>
                        <th className="px-2 py-1.5 text-left font-medium">Progress</th>
                        <th className="px-2 py-1.5 text-left font-medium">Stage</th>
                        <th className="px-2 py-1.5 text-left font-medium">Managers</th>
                        <th className="px-2 py-1.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((a) => (
                        <tr key={a.id} className="border-t hover:bg-muted/30">
                          <td className="px-2 py-1.5 font-medium">
                            <Link
                              to="/crm/accounts/$accountId"
                              params={{ accountId: a.id }}
                              className="hover:underline"
                            >
                              {a.name}
                            </Link>
                          </td>
                          <td className="px-2 py-1.5">
                            <Pill tone={a.overdue ? "danger" : a.status === "live" ? "success" : "muted"}>
                              {a.status}
                            </Pill>
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <ProgressBar value={a.progress} className="w-16" />
                              <span className="text-[10px] text-muted-foreground">{a.progress}%</span>
                            </div>
                          </td>
                          <td className="max-w-[100px] truncate px-2 py-1.5 text-muted-foreground">
                            {a.stageLabel}
                          </td>
                          <td className="min-w-[9rem] px-2 py-1.5 text-[10px] text-muted-foreground">
                            <div className="space-y-0.5">
                              <div className="truncate" title={a.salesManagerName || undefined}>
                                Sales: {a.salesManagerName || "—"}
                              </div>
                              <div className="truncate" title={a.supportManager1 || undefined}>
                                Support 1: {a.supportManager1 || "—"}
                              </div>
                              <div className="truncate" title={a.supportManager2 || undefined}>
                                Support 2: {a.supportManager2 || "—"}
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <Button size="sm" variant="ghost" className="h-7 gap-0.5 px-1.5 text-primary" asChild>
                              <Link to="/crm/accounts/$accountId" params={{ accountId: a.id }}>
                                Open <ArrowRight className="h-3 w-3" />
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.16, ease: EASE }}
            className="card-soft p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold">Recent activity</h3>
              <span className="text-[10px] text-muted-foreground">Live · 15s sync</span>
            </div>
            <CrmDashboardActivityFeed items={recentActivity} />
          </motion.div>
        </div>
      </div>

      <CrmDashboardDrillDownSheet
        open={Boolean(drillDown)}
        filter={drillDown}
        data={drillDownData}
        onClose={closeDrillDown}
      />
    </PageWrap>
  );
}
