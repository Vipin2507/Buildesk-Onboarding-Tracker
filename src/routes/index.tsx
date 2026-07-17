import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import {
  Building2, TrendingUp, CheckCircle2, PauseCircle, ListChecks, RefreshCw, ArrowRight,
} from "lucide-react";

import { PageHeader, PageWrap } from "@/components/page-header";
import { ProgressBar, ProgressRing } from "@/components/progress-bar";
import { StatusPill, Pill } from "@/components/status-pill";
import { CountUp } from "@/components/count-up";
import { Button } from "@/components/ui/button";
import {
  useDashboardKpis,
  useModuleAdoption,
  useAccountHealth,
  useRecentActivity,
  useUpcomingRenewals,
  useProjectStore,
  useEmployeeStore,
  useUserStore,
} from "@/stores";
import { resolveAssigneeLabel } from "@/lib/managers";
import { formatRelativeTime } from "@/types/common";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const kpis = useDashboardKpis();
  const moduleData = useModuleAdoption();
  const health = useAccountHealth();
  const activities = useRecentActivity(6);
  const renewals = useUpcomingRenewals(5);
  const employees = useEmployeeStore((s) => s.employees);
  const users = useUserStore((s) => s.users);
  const projects = useProjectStore((s) => s.projects);
  const navigate = useNavigate();

  const kpiCards = [
    { label: "Total Companies", value: kpis.totalCompanies, icon: Building2, tone: "bg-primary/10 text-primary" },
    { label: "Active Onboarding", value: kpis.activeOnboarding, icon: TrendingUp, tone: "bg-warning/15 text-warning-foreground" },
    { label: "Completed", value: kpis.completed, icon: CheckCircle2, tone: "bg-success/15 text-success" },
    { label: "On Hold", value: kpis.onHold, icon: PauseCircle, tone: "bg-destructive/15 text-destructive" },
    { label: "Pending Tasks", value: kpis.pendingTasks, icon: ListChecks, tone: "bg-info/15 text-info" },
    { label: "Upcoming Renewals", value: kpis.upcomingRenewals, icon: RefreshCw, tone: "bg-primary/15 text-primary" },
  ];

  const donutData = [
    { name: "Completed", value: kpis.completed, color: "var(--color-success)" },
    { name: "In Progress", value: kpis.activeOnboarding, color: "var(--color-warning)" },
    { name: "Pending Review", value: kpis.companiesWithProgress.filter((c) => c.computedStatus === "review").length, color: "var(--color-info)" },
    { name: "Not Started", value: kpis.companiesWithProgress.filter((c) => c.computedStatus === "not_started").length, color: "var(--color-muted-foreground)" },
    { name: "On Hold", value: kpis.onHold, color: "var(--color-destructive)" },
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
        subtitle="Real Estate SaaS ERP — onboarding, post-sales, health at a glance."
        actions={
          <Button className="bg-primary hover:bg-primary/90" onClick={() => navigate({ to: "/companies" })}>
            + New Onboarding
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
        {kpiCards.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card-soft p-3 sm:p-4"
          >
            <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg sm:mb-3 sm:h-9 sm:w-9 ${k.tone}`}>
              <k.icon className="h-4 w-4" />
            </div>
            <div className="text-xl font-semibold tracking-tight sm:text-2xl">
              <CountUp to={k.value} />
            </div>
            <div className="text-[11px] text-muted-foreground sm:text-xs">{k.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="card-soft p-5 lg:col-span-1">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">Onboarding Progress</h3>
            <Pill tone="info">Live</Pill>
          </div>
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={donutData} innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3} stroke="none">
                  {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {donutData.map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                <span className="text-muted-foreground">{d.name}</span>
                <span className="ml-auto font-medium">{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card-soft p-5 lg:col-span-2">
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
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="card-soft p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Recent Onboarding</h3>
            <Link to="/companies" className="text-xs font-medium text-primary hover:underline">View all</Link>
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
                        <Link to="/projects/$projectId" params={{ projectId: project.id }} search={{ tab: "onboarding" }}>
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
                        <Link to="/companies/$companyId" params={{ companyId: c.id }} className="hover:underline">
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5"><StatusPill status={c.computedStatus} /></td>
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
                            <Link to="/projects/$projectId" params={{ projectId: project.id }} search={{ tab: "onboarding" }}>
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
          <div className="card-soft p-5">
            <h3 className="mb-3 font-semibold">Account Health</h3>
            <div className="flex items-center gap-4">
              <ProgressRing value={healthPct} />
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-success" />Healthy <span className="ml-auto font-medium">{health.Healthy}</span></div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-warning" />Moderate <span className="ml-auto font-medium">{health.Moderate}</span></div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-destructive" />Critical <span className="ml-auto font-medium">{health.Critical}</span></div>
              </div>
            </div>
          </div>

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
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    a.kind === "success" ? "bg-success" :
                    a.kind === "warning" ? "bg-warning" :
                    a.kind === "danger" ? "bg-destructive" : "bg-primary"
                  }`} />
                  <div className="min-w-0">
                    <div className="truncate">{a.what}</div>
                    <div className="text-xs text-muted-foreground">{a.who} · {formatRelativeTime(a.createdAt)}</div>
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
          <Link to="/renewals" className="text-xs font-medium text-primary hover:underline">Manage</Link>
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
                <Link to="/companies/$companyId" params={{ companyId: r.id }} className="font-medium hover:underline">
                  {r.name}
                </Link>
                <Pill tone={r.urgency === "urgent" ? "warning" : r.urgency === "overdue" ? "danger" : "info"}>
                  {r.urgency === "overdue" ? "Overdue" : "Upcoming"}
                </Pill>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Pill tone="accent">{r.plan}</Pill>
                <span>{r.planExpiry}</span>
                <Pill tone={r.daysLeft < 15 ? "danger" : r.daysLeft < 30 ? "warning" : "info"}>{r.daysLeft} days</Pill>
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
                    <Link to="/companies/$companyId" params={{ companyId: r.id }} className="hover:underline">{r.name}</Link>
                  </td>
                  <td className="px-3 py-2.5"><Pill tone="accent">{r.plan}</Pill></td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.planExpiry}</td>
                  <td className="px-3 py-2.5">
                    <Pill tone={r.daysLeft < 15 ? "danger" : r.daysLeft < 30 ? "warning" : "info"}>{r.daysLeft} days</Pill>
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
    </PageWrap>
  );
}
