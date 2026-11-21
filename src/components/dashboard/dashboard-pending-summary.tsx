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
  hint: string;
  value: number;
  icon: LucideIcon;
  tone: string;
  urgent?: boolean;
  prominent?: boolean;
  filter: DashboardDrillDownFilter;
};

type ChipGroup = {
  id: string;
  title: string;
  chips: SummaryChip[];
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

  const groups: ChipGroup[] = [
    {
      id: "priority",
      title: "Priority",
      chips: [
        {
          id: "overdue",
          label: "Overdue",
          hint: "Open follow-ups past due",
          value: overdueFollowUps,
          icon: AlarmClock,
          tone: "border-destructive/25 bg-destructive/10 text-destructive",
          urgent: overdueFollowUps > 0,
          filter: { type: "follow_ups", scope: "overdue" },
        },
        {
          id: "due-today",
          label: "Due today",
          hint: "Follow-ups due today",
          value: tasksDueToday,
          icon: CalendarClock,
          tone: "border-warning/30 bg-warning/10 text-warning-foreground",
          urgent: tasksDueToday > 0,
          filter: { type: "follow_ups", scope: "due_today" },
        },
        {
          id: "follow-ups",
          label: "Follow-ups",
          hint: "All open follow-up tasks",
          value: pending.byKind.task,
          icon: CheckSquare,
          tone: "border-border bg-muted/50 text-foreground",
          filter: { type: "follow_ups", scope: "open" },
        },
      ],
    },
    {
      id: "support",
      title: "Support",
      chips: [
        {
          id: "support",
          label: "Support tickets",
          hint: "Open internal TKT tickets",
          value: pending.byKind.ticket,
          icon: Ticket,
          tone: "border-info/30 bg-info/10 text-info",
          filter: { type: "support_tickets" },
        },
        {
          id: "design",
          label: "Client tickets",
          hint: "Open portal DT tickets",
          value: openDesignTickets,
          icon: Ticket,
          tone: "border-primary/30 bg-primary/10 text-primary",
          filter: { type: "design_tickets" },
        },
      ],
    },
    {
      id: "onboarding",
      title: "Onboarding",
      chips: [
        {
          id: "collection",
          label: "To collect",
          hint: "Waiting on the client",
          value: pending.checklistCollection,
          icon: ClipboardList,
          tone: "border-info/30 bg-info/10 text-info",
          prominent: true,
          filter: { type: "checklist", phase: "awaiting_collection" },
        },
        {
          id: "upload",
          label: "To upload",
          hint: "Ready to load into ERP",
          value: pending.checklistUpload,
          icon: ClipboardList,
          tone: "border-warning/30 bg-warning/10 text-warning-foreground",
          prominent: true,
          filter: { type: "checklist", phase: "awaiting_upload" },
        },
        {
          id: "live",
          label: "To go live",
          hint: "Ready for verification",
          value: pending.checklistLive,
          icon: ListChecks,
          tone: "border-primary/30 bg-primary/10 text-primary",
          prominent: true,
          filter: { type: "checklist", phase: "awaiting_live" },
        },
      ],
    },
    {
      id: "engagement",
      title: "Client engagement",
      chips: [
        {
          id: "visit-fu",
          label: "Visit follow-ups",
          hint: "Visits still needing a follow-up",
          value: pending.byKind.visitFollowup,
          icon: MapPin,
          tone: "border-border bg-muted/40 text-foreground",
          filter: { type: "visit_followups" },
        },
        {
          id: "visits",
          label: "Upcoming visits",
          hint: "Scheduled field visits",
          value: upcomingVisits,
          icon: MapPin,
          tone: "border-info/30 bg-info/10 text-info",
          filter: { type: "visits" },
        },
        {
          id: "renewals",
          label: "Renewals",
          hint: "Plans inside the renewal window",
          value: upcomingRenewals,
          icon: RefreshCw,
          tone: "border-primary/25 bg-primary/10 text-primary",
          filter: { type: "renewals" },
        },
      ],
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
          <h2 className="text-sm font-semibold tracking-tight">Pending overview</h2>
          <p className="text-[12px] text-muted-foreground">
            What needs attention today · {totalPending} open items
          </p>
        </div>
        {pending.overdue > 0 ? (
          <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
            {pending.overdue} overdue in queue
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {groups.map((group) => (
          <div key={group.id} className="min-w-0">
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {group.title}
            </div>
            <div
              className={cn(
                "grid gap-1.5",
                group.chips.length === 2 ? "grid-cols-2" : "grid-cols-3",
              )}
            >
              {group.chips.map((chip, i) => {
                const Icon = chip.icon;
                const isActive = activeFilter && filterKey(activeFilter) === filterKey(chip.filter);
                return (
                  <motion.button
                    key={chip.id}
                    type="button"
                    title={chip.hint}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.12), duration: 0.22, ease: EASE }}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onOpen(chip.filter)}
                    className={cn(
                      "flex min-w-0 flex-col rounded-[14px] border px-2.5 py-2 text-left transition-shadow hover:shadow-sm",
                      chip.tone,
                      chip.prominent && "min-h-[72px]",
                      chip.urgent && "ring-1 ring-destructive/30",
                      isActive && "ring-2 ring-primary/45",
                    )}
                  >
                    <div className="flex items-center gap-1">
                      <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                      <span className="truncate text-[11px] font-medium leading-tight">{chip.label}</span>
                    </div>
                    <div className="mt-1 text-lg font-semibold tabular-nums leading-none">
                      <CountUp to={chip.value} />
                    </div>
                    <div className="mt-1 line-clamp-2 text-[10px] leading-snug opacity-80">{chip.hint}</div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
