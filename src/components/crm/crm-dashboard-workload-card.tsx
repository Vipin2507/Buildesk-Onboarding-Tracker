import { motion } from "framer-motion";
import {
  AlarmClock,
  Calendar,
  ClipboardList,
  CloudUpload,
  GraduationCap,
  LifeBuoy,
  ListChecks,
  Radio,
  Ticket,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { CountUp } from "@/components/count-up";
import { cn } from "@/lib/utils";
import {
  crmDrillDownFilterKey,
  type CrmDashboardDrillDownFilter,
} from "@/stores/crm-dashboard-selectors";

const EASE = [0.22, 1, 0.36, 1] as const;

type Pending = {
  overdue: number;
  mastersCollect: number;
  mastersUpload: number;
  mastersLive: number;
  migrations: number;
  training: number;
  reports: number;
  tickets: number;
  bookings: number;
  support: number;
};

type WorkItem = {
  id: string;
  label: string;
  value: number;
  barClass: string;
  icon: LucideIcon;
  filter: CrmDashboardDrillDownFilter;
  navigateTo?: { to: string; search?: Record<string, string> };
};

type Props = {
  pending: Pending;
  mastersProgressPct: number;
  mastersApplicable: number;
  onOpen: (filter: CrmDashboardDrillDownFilter) => void;
  onNavigate?: (to: string, search?: Record<string, string>) => void;
  activeFilter?: CrmDashboardDrillDownFilter | null;
};

export function CrmDashboardWorkloadCard({
  pending,
  mastersProgressPct,
  mastersApplicable,
  onOpen,
  onNavigate,
  activeFilter,
}: Props) {
  const items: WorkItem[] = [
    {
      id: "bookings",
      label: "Pending bookings",
      value: pending.bookings,
      barClass: "bg-warning",
      icon: Calendar,
      filter: { type: "bookings", scope: "pending" },
      navigateTo: { to: "/crm/bookings", search: { tab: "pending" } },
    },
    {
      id: "support",
      label: "Portal tickets",
      value: pending.support,
      barClass: "bg-info",
      icon: LifeBuoy,
      filter: { type: "support" },
    },
    {
      id: "overdue",
      label: "Overdue accounts",
      value: pending.overdue,
      barClass: "bg-destructive",
      icon: AlarmClock,
      filter: { type: "overdue" },
    },
    {
      id: "collect",
      label: "Masters to collect",
      value: pending.mastersCollect,
      barClass: "bg-info",
      icon: ClipboardList,
      filter: { type: "masters", phase: "awaiting_collection" },
    },
    {
      id: "upload",
      label: "Masters to upload",
      value: pending.mastersUpload,
      barClass: "bg-warning",
      icon: CloudUpload,
      filter: { type: "masters", phase: "awaiting_upload" },
    },
    {
      id: "live",
      label: "Masters to go live",
      value: pending.mastersLive,
      barClass: "bg-primary",
      icon: Radio,
      filter: { type: "masters", phase: "awaiting_live" },
    },
    {
      id: "migrations",
      label: "Migration tasks",
      value: pending.migrations,
      barClass: "bg-muted-foreground/60",
      icon: Upload,
      filter: { type: "migrations" },
    },
    {
      id: "training",
      label: "Training pending",
      value: pending.training,
      barClass: "bg-primary/70",
      icon: GraduationCap,
      filter: { type: "training" },
    },
    {
      id: "reports",
      label: "Reports to explain",
      value: pending.reports,
      barClass: "bg-muted-foreground/50",
      icon: ListChecks,
      filter: { type: "reports" },
    },
    {
      id: "tickets",
      label: "Internal tickets",
      value: pending.tickets,
      barClass: "bg-info/80",
      icon: Ticket,
      filter: { type: "tickets" },
    },
  ];

  const visible = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const display = (visible.length > 0 ? visible : items.slice(0, 5)).slice(0, 5);
  const totalOpen = items.reduce((s, i) => s + i.value, 0);
  const maxValue = Math.max(1, ...display.map((i) => i.value));
  const activeKey = crmDrillDownFilterKey(activeFilter);

  const stackTotal = Math.max(1, totalOpen);
  const stackSegments = items.filter((i) => i.value > 0);

  function handleClick(item: WorkItem) {
    if (item.navigateTo && onNavigate) {
      onNavigate(item.navigateTo.to, item.navigateTo.search);
      return;
    }
    onOpen(item.filter);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.09, ease: EASE }}
      className="card-soft flex h-full flex-col p-3 lg:col-span-3"
    >
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold">Open workload</h3>
          <p className="text-[10px] text-muted-foreground">
            {totalOpen > 0 ? (
              <>
                <span className="font-medium text-foreground">{totalOpen}</span> actionable items
              </>
            ) : (
              "No pending work — portfolio is clear"
            )}
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold tabular-nums text-primary">
            <CountUp to={mastersProgressPct} format={(n) => `${Math.round(n)}%`} />
          </div>
          <div className="text-[9px] text-muted-foreground">
            {mastersApplicable} master{mastersApplicable === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="mb-2 flex h-1.5 overflow-hidden rounded-full bg-muted">
        {stackSegments.length === 0 ? (
          <div className="h-full w-full rounded-full bg-success/40" />
        ) : (
          stackSegments.map((seg) => (
            <button
              key={seg.id}
              type="button"
              title={`${seg.label}: ${seg.value}`}
              onClick={() => handleClick(seg)}
              className={cn("h-full transition-opacity hover:opacity-80", seg.barClass)}
              style={{ width: `${(seg.value / stackTotal) * 100}%`, minWidth: 4 }}
            />
          ))
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-1">
        {display.map((item, i) => {
          const Icon = item.icon;
          const active = activeKey === crmDrillDownFilterKey(item.filter);
          const pct = item.value === 0 ? 0 : Math.round((item.value / maxValue) * 100);
          return (
            <motion.button
              key={item.id}
              type="button"
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.03, duration: 0.22, ease: EASE }}
              onClick={() => handleClick(item)}
              className={cn(
                "flex w-full items-center gap-1.5 rounded-md px-0.5 py-0.5 text-left transition-colors hover:bg-muted/50",
                active && "bg-muted/40 ring-1 ring-primary/30",
              )}
            >
              <Icon className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
              <span className="w-[4.5rem] shrink-0 truncate text-[10px] text-muted-foreground">
                {item.label}
              </span>
              <span className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className={cn("absolute inset-y-0 left-0 rounded-full", item.barClass)}
                  style={{ width: `${Math.max(item.value > 0 ? 8 : 0, pct)}%` }}
                />
              </span>
              <span className="w-4 shrink-0 text-right text-[10px] font-semibold tabular-nums">
                {item.value}
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
