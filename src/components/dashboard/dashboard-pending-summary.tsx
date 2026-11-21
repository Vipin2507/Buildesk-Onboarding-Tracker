import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  AlarmClock,
  CalendarClock,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  CloudUpload,
  Radio,
  MapPin,
  RefreshCw,
  Ticket,
  Sparkles,
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
  badge?: string;
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
  const [collapsed, setCollapsed] = useState(false);

  const groups: ChipGroup[] = [
    {
      id: "priority",
      title: "Priority & Tasks",
      chips: [
        {
          id: "overdue",
          label: "Overdue",
          hint: "Open follow-ups past due",
          value: overdueFollowUps,
          icon: AlarmClock,
          tone: "border-destructive/30 bg-destructive/10 text-destructive dark:bg-destructive/20",
          urgent: overdueFollowUps > 0,
          filter: { type: "follow_ups", scope: "overdue" },
        },
        {
          id: "due-today",
          label: "Due Today",
          hint: "Follow-ups due today",
          value: tasksDueToday,
          icon: CalendarClock,
          tone: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 dark:bg-amber-500/15",
          urgent: tasksDueToday > 0,
          filter: { type: "follow_ups", scope: "due_today" },
        },
        {
          id: "follow-ups",
          label: "Follow-ups",
          hint: "All open follow-up tasks",
          value: pending.byKind.task,
          icon: CheckSquare,
          tone: "border-border/60 bg-muted/40 text-foreground hover:bg-muted/60",
          filter: { type: "follow_ups", scope: "open" },
        },
      ],
    },
    {
      id: "support",
      title: "Support & Tickets",
      chips: [
        {
          id: "support",
          label: "Support Tickets",
          hint: "Open internal TKT tickets",
          value: pending.byKind.ticket,
          icon: Ticket,
          tone: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300 dark:bg-sky-500/15",
          filter: { type: "support_tickets" },
        },
        {
          id: "design",
          label: "Client Tickets",
          hint: "Open portal DT tickets",
          value: openDesignTickets,
          icon: Ticket,
          tone: "border-primary/30 bg-primary/10 text-primary dark:bg-primary/20",
          filter: { type: "design_tickets" },
        },
      ],
    },
    {
      id: "onboarding",
      title: "Onboarding Bottlenecks",
      badge: "Pipeline",
      chips: [
        {
          id: "collection",
          label: "To Collect",
          hint: "Waiting on client inputs",
          value: pending.checklistCollection,
          icon: ClipboardList,
          tone: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 dark:bg-cyan-500/15",
          prominent: true,
          filter: { type: "checklist", phase: "awaiting_collection" },
        },
        {
          id: "upload",
          label: "To Upload",
          hint: "Ready to load into ERP",
          value: pending.checklistUpload,
          icon: CloudUpload,
          tone: "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300 dark:bg-amber-500/15",
          prominent: true,
          filter: { type: "checklist", phase: "awaiting_upload" },
        },
        {
          id: "live",
          label: "To Go Live",
          hint: "Ready for verification",
          value: pending.checklistLive,
          icon: Radio,
          tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 dark:bg-emerald-500/15",
          prominent: true,
          filter: { type: "checklist", phase: "awaiting_live" },
        },
      ],
    },
    {
      id: "engagement",
      title: "Client Engagement",
      chips: [
        {
          id: "visit-fu",
          label: "Visit Follow-ups",
          hint: "Visits needing follow-up",
          value: pending.byKind.visitFollowup,
          icon: MapPin,
          tone: "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300 dark:bg-purple-500/15",
          filter: { type: "visit_followups" },
        },
        {
          id: "visits",
          label: "Upcoming Visits",
          hint: "Scheduled field visits",
          value: upcomingVisits,
          icon: MapPin,
          tone: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300 dark:bg-blue-500/15",
          filter: { type: "visits" },
        },
        {
          id: "renewals",
          label: "Renewals",
          hint: "Expiring within window",
          value: upcomingRenewals,
          icon: RefreshCw,
          tone: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300 dark:bg-orange-500/15",
          filter: { type: "renewals" },
        },
      ],
    },
  ];

  const totalPending = pending.total + openDesignTickets;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/95 p-3.5 shadow-sm sm:p-4 backdrop-blur-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Pending Overview</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {totalPending} open items
              </span>
            </div>
            <p className="text-[12px] text-muted-foreground">
              Real-time operational queue across tasks, support tickets and bottlenecks
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pending.overdue > 0 && (
            <span className="relative flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive animate-pulse">
              <span className="h-2 w-2 rounded-full bg-destructive animate-ping" />
              {pending.overdue} overdue in queue
            </span>
          )}

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {collapsed ? (
              <>
                <span>Expand</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                <span>Collapse</span>
                <ChevronUp className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="grid gap-3 pt-1 sm:grid-cols-2 xl:grid-cols-4"
          >
            {groups.map((group) => (
              <div
                key={group.id}
                className="flex flex-col rounded-xl border border-border/50 bg-muted/20 p-2.5 sm:p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.title}
                  </span>
                  {group.badge && (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      {group.badge}
                    </span>
                  )}
                </div>

                <div
                  className={cn(
                    "grid gap-2 flex-1",
                    group.chips.length === 2 ? "grid-cols-2" : "grid-cols-3 sm:grid-cols-1 md:grid-cols-3 xl:grid-cols-1",
                  )}
                >
                  {group.chips.map((chip, i) => {
                    const Icon = chip.icon;
                    const isActive =
                      activeFilter && filterKey(activeFilter) === filterKey(chip.filter);

                    return (
                      <motion.button
                        key={chip.id}
                        type="button"
                        title={chip.hint}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.04, 0.15), duration: 0.2, ease: EASE }}
                        whileHover={{ y: -1, scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onOpen(chip.filter)}
                        className={cn(
                          "group relative flex min-w-0 items-center justify-between rounded-xl border px-3 py-2 text-left transition-all duration-150 hover:shadow-sm cursor-pointer",
                          chip.tone,
                          chip.urgent && "ring-1 ring-destructive/40 shadow-destructive/5",
                          isActive && "ring-2 ring-primary border-primary shadow-sm",
                        )}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <Icon className="h-3.5 w-3.5 shrink-0 opacity-80 group-hover:scale-110 transition-transform" />
                            <span className="truncate text-[12px] font-medium leading-tight">
                              {chip.label}
                            </span>
                          </div>
                          <p className="mt-0.5 line-clamp-1 text-[10px] opacity-70">
                            {chip.hint}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="text-base font-bold tabular-nums leading-none">
                            <CountUp to={chip.value} />
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
