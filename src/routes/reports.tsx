import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileBarChart2,
  DollarSign,
  Truck,
  HardHat,
  Users,
  TrendingDown,
  Plug,
  Bug,
  Timer,
  Wrench,
  PieChart,
  ArrowLeft,
  Download,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart as RePieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { z } from "zod";

import { PageWrap } from "@/components/page-header";
import {
  DesignTicketPageHeader,
  DesignTicketSection,
  TICKET_EASE,
} from "@/components/design-ticket/design-ticket-shared";
import { ReportTable } from "@/components/report-table";
import { Button } from "@/components/ui/button";
import {
  REPORT_IDS,
  REPORT_META,
  buildReport,
  downloadCsv,
  type ReportId,
  type ReportSnapshot,
} from "@/lib/reports";
import { cn } from "@/lib/utils";
import {
  useCompanyStore,
  useEmployeeStore,
  useIntegrationStore,
  useLaborStore,
  useOnboardingStore,
  useProjectStore,
  useTicketStore,
  useTaskStore,
  useCrmEventStore,
  useVendorStore,
} from "@/stores";

const ICONS = {
  onboarding: FileBarChart2,
  due: DollarSign,
  collection: DollarSign,
  vendor: Truck,
  labor: HardHat,
  team: Users,
  delay: TrendingDown,
  integrations: Plug,
  "ticket-aging": Timer,
  "bug-resolution": Bug,
  "follow-ups": Timer,
  custom: Wrench,
  executive: PieChart,
} as const;

const CHART_COLORS = [
  "var(--color-primary)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-info)",
  "var(--color-destructive)",
  "#64748b",
  "#0ea5e9",
  "#8b5cf6",
];

const searchSchema = z.object({
  report: z.enum(REPORT_IDS).optional(),
});

export const Route = createFileRoute("/reports")({
  validateSearch: (search) => searchSchema.parse(search),
  component: Reports,
});

function useReportSnapshot(): ReportSnapshot {
  const companies = useCompanyStore((s) => s.companies);
  const projects = useProjectStore((s) => s.projects);
  const checklist = useOnboardingStore((s) => s.checklistItems);
  const otherCharges = useOnboardingStore((s) => s.otherCharges);
  const payments = useOnboardingStore((s) => s.paymentRecords);
  const purchaseOrders = useVendorStore((s) => s.purchaseOrders);
  const workOrders = useVendorStore((s) => s.workOrders);
  const labor = useLaborStore((s) => s.labor);
  const attendance = useLaborStore((s) => s.attendance);
  const employees = useEmployeeStore((s) => s.employees);
  const integrations = useIntegrationStore((s) => s.integrations);
  const tickets = useTicketStore((s) => s.tickets);
  const followUpTasks = useTaskStore((s) => s.tasks);
  const crmEvents = useCrmEventStore((s) => s.events);

  return useMemo(
    () => ({
      companies,
      projects,
      checklist,
      otherCharges,
      payments,
      purchaseOrders,
      workOrders,
      labor,
      attendance,
      employees,
      integrations,
      tickets,
      followUpTasks,
      crmEvents,
    }),
    [
      companies,
      projects,
      checklist,
      otherCharges,
      payments,
      purchaseOrders,
      workOrders,
      labor,
      attendance,
      employees,
      integrations,
      tickets,
      followUpTasks,
      crmEvents,
    ],
  );
}

function Reports() {
  const { report: activeId } = Route.useSearch();
  const navigate = useNavigate({ from: "/reports" });
  const snapshot = useReportSnapshot();

  const active = activeId ? buildReport(activeId, snapshot) : null;

  function openReport(id: ReportId) {
    void navigate({ search: { report: id } });
  }

  function clearReport() {
    void navigate({ search: {} });
  }

  function exportActive() {
    if (!active) return;
    downloadCsv(
      `buildesk-${active.id}-${new Date().toISOString().slice(0, 10)}.csv`,
      active.columns,
      active.rows,
    );
  }

  return (
    <PageWrap compact>
      <DesignTicketPageHeader
        compact
        title={active ? active.title : "Reports"}
        subtitle={
          active
            ? `${active.description} · as of ${new Date().toLocaleString()}`
            : "Live operational insights from your Buildesk data."
        }
        actions={
          active ? (
            <div className="flex flex-wrap gap-1.5">
              <Button variant="outline" size="sm" className="h-7 gap-1 px-2.5 text-xs" onClick={clearReport}>
                <ArrowLeft className="h-3.5 w-3.5" /> All reports
              </Button>
              <Button size="sm" className="h-7 gap-1 px-2.5 text-xs bg-primary hover:bg-primary/90" onClick={exportActive}>
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
            </div>
          ) : undefined
        }
      />

      <AnimatePresence mode="wait">
        {!active ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, ease: TICKET_EASE }}
            className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
          >
            {REPORT_META.map((r, i) => {
              const Icon = ICONS[r.id];
              return (
                <motion.button
                  key={r.id}
                  type="button"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.2), ease: TICKET_EASE }}
                  onClick={() => openReport(r.id)}
                  className="card-soft group flex min-h-[3.5rem] items-start gap-2.5 p-3 text-left transition-all active:scale-[0.99] hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold leading-tight">{r.name}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">{r.desc}</div>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.28, ease: TICKET_EASE }}
            className="space-y-3"
          >
            <div className="grid gap-1.5 grid-cols-2 xl:grid-cols-4">
              {active.kpis.map((k) => (
                <div key={k.label} className="card-soft p-2.5">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {k.label}
                  </div>
                  <div
                    className={cn(
                      "mt-0.5 text-lg font-semibold tabular-nums sm:text-xl",
                      k.tone === "success" && "text-success",
                      k.tone === "warning" && "text-warning-foreground",
                      k.tone === "danger" && "text-destructive",
                    )}
                  >
                    {k.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-2.5 lg:grid-cols-5">
              <DesignTicketSection title={active.chartLabel ?? "Distribution"} delay={0.02} compact className="lg:col-span-2">
                <div className="card-soft p-3">
                  <div className="h-48 sm:h-56">
                    {active.chart.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        No chart data
                      </div>
                    ) : active.id === "collection" || active.id === "executive" || active.id === "integrations" ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <RePieChart>
                          <Pie
                            data={active.chart}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={48}
                            outerRadius={72}
                            paddingAngle={2}
                          >
                            {active.chart.map((entry, i) => (
                              <Cell key={entry.name} fill={entry.fill ?? CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </RePieChart>
                      </ResponsiveContainer>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={active.chart} margin={{ top: 6, right: 6, left: 0, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={44} />
                          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={28} />
                          <Tooltip />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {active.chart.map((entry, i) => (
                              <Cell key={entry.name} fill={entry.fill ?? CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </DesignTicketSection>

              <DesignTicketSection title="Details" delay={0.04} compact className="lg:col-span-3">
                <ReportTable columns={active.columns} rows={active.rows} />
              </DesignTicketSection>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageWrap>
  );
}
