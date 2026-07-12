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

import { PageHeader, PageWrap } from "@/components/page-header";
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
    <PageWrap>
      <PageHeader
        title="Reports"
        subtitle="Live operational insights from your Buildesk data."
        actions={
          active ? (
            <div className="flex gap-2">
              <Button variant="outline" className="gap-1.5" onClick={clearReport}>
                <ArrowLeft className="h-4 w-4" /> All reports
              </Button>
              <Button className="gap-1.5 bg-primary hover:bg-primary/90" onClick={exportActive}>
                <Download className="h-4 w-4" /> Export CSV
              </Button>
            </div>
          ) : undefined
        }
      />

      <AnimatePresence mode="wait">
        {!active ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {REPORT_META.map((r) => {
              const Icon = ICONS[r.id];
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => openReport(r.id)}
                  className="card-soft group flex items-start gap-4 p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-sm text-muted-foreground">{r.desc}</div>
                  </div>
                </button>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-5"
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">{active.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {active.description} · as of {new Date().toLocaleString()}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {active.kpis.map((k) => (
                <div key={k.label} className="card-soft p-4">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {k.label}
                  </div>
                  <div
                    className={cn(
                      "mt-1 text-2xl font-semibold tabular-nums",
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

            <div className="grid gap-4 lg:grid-cols-5">
              <div className="card-soft p-4 lg:col-span-2">
                <div className="mb-3 text-sm font-medium">{active.chartLabel ?? "Distribution"}</div>
                <div className="h-64">
                  {active.chart.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      No chart data
                    </div>
                  ) : active.id === "collection" || active.id === "executive" || active.id === "integrations" ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie
                          data={active.chart}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={85}
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
                      <BarChart data={active.chart} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                          {active.chart.map((entry, i) => (
                            <Cell key={entry.name} fill={entry.fill ?? CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="lg:col-span-3">
                <ReportTable columns={active.columns} rows={active.rows} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageWrap>
  );
}
