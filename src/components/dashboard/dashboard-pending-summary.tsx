import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  AlarmClock,
  CalendarClock,
  CheckSquare,
  ClipboardList,
  ListChecks,
  MapPin,
  RefreshCw,
  Ticket,
} from "lucide-react";

import { CountUp } from "@/components/count-up";
import { usePendingWorkSummary } from "@/hooks/use-pending-work-summary";
import { cn } from "@/lib/utils";
import type { DashboardDrillDownFilter } from "@/stores/dashboard-selectors";

const EASE = [0.22, 1, 0.36, 1] as const;

type SummaryChip = {
  id: string;
  label: string;
  value: number;
  icon: LucideIcon;
  tone: string;
  urgent?: boolean;
  filter: DashboardDrillDownFilter;
};

type Props = {
  openDesignTickets: number;
  overdueFollowUps: number;
  tasksDueToday: number;
  upcomingVisits: number;
  upcomingRenewals: number;
  onOpen: (filter: DashboardDrillDownFilter) => void;
  activeFilter?: DashboardDrillDownFilter | null;
};

function filterKey(filter: DashboardDrillDownFilter) {
  return JSON.stringify(filter);
}

export function DashboardPendingSummary({
  openDesignTickets,
  overdueFollowUps,
  tasksDueToday,
  upcomingVisits,
  upcomingRenewals,
  onOpen,
  activeFilter,
}: Props) {
  const pending = usePendingWorkSummary();

  const chips: SummaryChip[] = [
    {
      id: "overdue",
      label: "Overdue",
      value: overdueFollowUps,
      icon: AlarmClock,
      tone: "border-destructive/30 bg-destructive/10 text-destructive",
      urgent: overdueFollowUps > 0,
      filter: { type: "follow_ups", scope: "overdue" },
    },
    {
      id: "due-today",
      label: "Due today",
      value: tasksDueToday,
      icon: CalendarClock,
      tone: "border-warning/30 bg-warning/10 text-warning-foreground",
      urgent: tasksDueToday > 0,
      filter: { type: "follow_ups", scope: "due_today" },
    },
    {
      id: "support",
      label: "Support tickets",
      value: pending.byKind.ticket,
      icon: Ticket,
      tone: "border-info/30 bg-info/10 text-info",
      filter: { type: "support_tickets" },
    },
    {
      id: "design",
      label: "Client tickets",
      value: openDesignTickets,
      icon: Ticket,
      tone: "border-primary/30 bg-primary/10 text-primary",
      filter: { type: "design_tickets" },
    },
    {
      id: "follow-ups",
      label: "Follow-ups",
      value: pending.byKind.task,
      icon: CheckSquare,
      tone: "border-border bg-muted/40 text-foreground",
      filter: { type: "follow_ups", scope: "open" },
    },
    {
      id: "collection",
      label: "To collect",
      value: pending.checklistCollection,
      icon: ClipboardList,
      tone: "border-info/30 bg-info/10 text-info",
      filter: { type: "checklist", phase: "awaiting_collection" },
    },
    {
      id: "upload",
      label: "To upload",
      value: pending.checklistUpload,
      icon: ClipboardList,
      tone: "border-warning/30 bg-warning/10 text-warning-foreground",
      filter: { type: "checklist", phase: "awaiting_upload" },
    },
    {
      id: "live",
      label: "To go live",
      value: pending.checklistLive,
      icon: ListChecks,
      tone: "border-primary/30 bg-primary/10 text-primary",
      filter: { type: "checklist", phase: "awaiting_live" },
    },
    {
      id: "visit-fu",
      label: "Visit follow-ups",
      value: pending.byKind.visitFollowup,
      icon: MapPin,
      tone: "border-border bg-muted/40 text-foreground",
      filter: { type: "visit_followups" },
    },
    {
      id: "visits",
      label: "Upcoming visits",
      value: upcomingVisits,
      icon: MapPin,
      tone: "border-info/30 bg-info/10 text-info",
      filter: { type: "visits" },
    },
    {
      id: "renewals",
      label: "Renewals",
      value: upcomingRenewals,
      icon: RefreshCw,
      tone: "border-primary/30 bg-primary/10 text-primary",
      filter: { type: "renewals" },
    },
  ];

  const totalPending = pending.total + openDesignTickets;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="card-soft p-3 sm:p-3.5"
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Pending overview</h3>
          <p className="text-[11px] text-muted-foreground">
            {totalPending} open items · click any to view details
          </p>
        </div>
        {pending.overdue > 0 ? (
          <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
            {pending.overdue} overdue in queue
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {chips.map((chip, i) => {
          const Icon = chip.icon;
          const isActive = activeFilter && filterKey(activeFilter) === filterKey(chip.filter);
          return (
            <motion.button
              key={chip.id}
              type="button"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(i * 0.02, 0.15), duration: 0.25, ease: EASE }}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onOpen(chip.filter)}
              className={cn(
                "flex min-w-0 flex-col rounded-lg border px-2 py-1.5 text-left transition-shadow hover:shadow-sm",
                chip.tone,
                chip.urgent && "ring-1 ring-destructive/25",
                isActive && "ring-2 ring-primary/40",
              )}
            >
              <div className="flex items-center gap-1">
                <Icon className="h-3 w-3 shrink-0 opacity-80" />
                <span className="truncate text-[10px] font-medium leading-tight">{chip.label}</span>
              </div>
              <div className="mt-0.5 text-base font-semibold tabular-nums leading-none">
                <CountUp to={chip.value} />
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.section>
  );
}
