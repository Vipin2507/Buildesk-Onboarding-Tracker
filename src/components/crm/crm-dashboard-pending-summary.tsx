import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  AlarmClock,
  Calendar,
  CheckSquare,
  ClipboardList,
  CloudUpload,
  GraduationCap,
  LifeBuoy,
  ListChecks,
  MessageSquare,
  Radio,
  Rocket,
  Ticket,
  TrendingUp,
  Upload,
} from "lucide-react";

import { CountUp } from "@/components/count-up";
import { cn } from "@/lib/utils";
import {
  crmDrillDownFilterKey,
  type CrmDashboardDrillDownFilter,
} from "@/stores/crm-dashboard-selectors";

const EASE = [0.22, 1, 0.36, 1] as const;

type SummaryChip = {
  id: string;
  label: string;
  value: number;
  icon: LucideIcon;
  tone: string;
  urgent?: boolean;
  filter: CrmDashboardDrillDownFilter;
};

type Props = {
  overdue: number;
  mastersCollect: number;
  mastersUpload: number;
  mastersLive: number;
  migrations: number;
  training: number;
  reports: number;
  tickets: number;
  tasks?: number;
  tasksOverdue?: number;
  tasksDueToday?: number;
  queries?: number;
  goLive?: number;
  highPriority: number;
  bookings?: number;
  support?: number;
  onOpen: (filter: CrmDashboardDrillDownFilter) => void;
  onNavigate?: (to: string, search?: Record<string, string>) => void;
  activeFilter?: CrmDashboardDrillDownFilter | null;
};

export function CrmDashboardPendingSummary({
  overdue,
  mastersCollect,
  mastersUpload,
  mastersLive,
  migrations,
  training,
  reports,
  tickets,
  tasks = 0,
  tasksOverdue = 0,
  tasksDueToday = 0,
  queries = 0,
  goLive = 0,
  highPriority,
  bookings = 0,
  support = 0,
  onOpen,
  onNavigate,
  activeFilter,
}: Props) {
  const chips: SummaryChip[] = [
    {
      id: "tasks-overdue",
      label: "Overdue tasks",
      value: tasksOverdue,
      icon: AlarmClock,
      tone: "border-destructive/30 bg-destructive/10 text-destructive",
      urgent: tasksOverdue > 0,
      filter: { type: "tasks_overdue" },
    },
    {
      id: "tasks-today",
      label: "Tasks today",
      value: tasksDueToday,
      icon: CheckSquare,
      tone: "border-warning/30 bg-warning/10 text-warning-foreground",
      urgent: tasksDueToday > 0,
      filter: { type: "tasks_due_today" },
    },
    {
      id: "queries",
      label: "Open queries",
      value: queries,
      icon: MessageSquare,
      tone: "border-info/30 bg-info/10 text-info",
      urgent: queries > 0,
      filter: { type: "queries" },
    },
    {
      id: "tasks",
      label: "Open tasks",
      value: tasks,
      icon: CheckSquare,
      tone: "border-primary/30 bg-primary/10 text-primary",
      filter: { type: "tasks" },
    },
    {
      id: "bookings",
      label: "Pending meetings",
      value: bookings,
      icon: Calendar,
      tone: "border-warning/30 bg-warning/10 text-warning-foreground",
      urgent: bookings > 0,
      filter: { type: "bookings", scope: "pending" },
    },
    {
      id: "support",
      label: "Portal tickets",
      value: support,
      icon: LifeBuoy,
      tone: "border-info/30 bg-info/10 text-info",
      urgent: support > 0,
      filter: { type: "support" },
    },
    {
      id: "overdue",
      label: "Overdue",
      value: overdue,
      icon: AlarmClock,
      tone: "border-destructive/30 bg-destructive/10 text-destructive",
      urgent: overdue > 0,
      filter: { type: "overdue" },
    },
    {
      id: "priority",
      label: "High priority",
      value: highPriority,
      icon: TrendingUp,
      tone: "border-warning/30 bg-warning/10 text-warning-foreground",
      urgent: highPriority > 0,
      filter: { type: "priority", level: "high" },
    },
    {
      id: "tickets",
      label: "Open tickets",
      value: tickets,
      icon: Ticket,
      tone: "border-info/30 bg-info/10 text-info",
      filter: { type: "tickets" },
    },
    {
      id: "collect",
      label: "To collect",
      value: mastersCollect,
      icon: ClipboardList,
      tone: "border-info/30 bg-info/10 text-info",
      filter: { type: "masters", phase: "awaiting_collection" },
    },
    {
      id: "upload",
      label: "To upload",
      value: mastersUpload,
      icon: CloudUpload,
      tone: "border-warning/30 bg-warning/10 text-warning-foreground",
      filter: { type: "masters", phase: "awaiting_upload" },
    },
    {
      id: "live",
      label: "Masters to live",
      value: mastersLive,
      icon: Radio,
      tone: "border-primary/30 bg-primary/10 text-primary",
      filter: { type: "masters", phase: "awaiting_live" },
    },
    {
      id: "migration",
      label: "Migrations",
      value: migrations,
      icon: Upload,
      tone: "border-border bg-muted/40 text-foreground",
      filter: { type: "migrations" },
    },
    {
      id: "training",
      label: "Training",
      value: training,
      icon: GraduationCap,
      tone: "border-primary/30 bg-primary/10 text-primary",
      filter: { type: "training" },
    },
    {
      id: "reports",
      label: "Reports",
      value: reports,
      icon: ListChecks,
      tone: "border-border bg-muted/40 text-foreground",
      filter: { type: "reports" },
    },
    {
      id: "golive",
      label: "Go-live pending",
      value: goLive,
      icon: Rocket,
      tone: "border-success/30 bg-success/10 text-success",
      urgent: goLive > 0,
      filter: { type: "golive" },
    },
  ];

  const activeKey = crmDrillDownFilterKey(activeFilter);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="card-soft p-2 sm:p-2.5"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Pending overview
        </h3>
        <span className="text-[10px] text-muted-foreground">Click a chip to filter</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip, i) => {
          const Icon = chip.icon;
          const active = activeKey === crmDrillDownFilterKey(chip.filter);
          return (
            <motion.button
              key={chip.id}
              type="button"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02, duration: 0.25, ease: EASE }}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (chip.id === "bookings" && onNavigate) {
                  onNavigate("/crm/bookings", { tab: "pending" });
                  return;
                }
                if (chip.id === "tasks" && onNavigate) {
                  onNavigate("/crm/tasks", { tab: "open" });
                  return;
                }
                if (chip.id === "tasks-overdue" && onNavigate) {
                  onNavigate("/crm/tasks", { tab: "overdue" });
                  return;
                }
                if (chip.id === "tasks-today" && onNavigate) {
                  onNavigate("/crm/tasks", { tab: "today" });
                  return;
                }
                if (chip.id === "queries" && onNavigate) {
                  onNavigate("/crm/queries", { status: "open" });
                  return;
                }
                onOpen(chip.filter);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-left transition-shadow",
                chip.tone,
                active && "ring-2 ring-primary/40",
                chip.urgent && chip.value > 0 && "shadow-sm",
              )}
            >
              <Icon className="h-3 w-3 shrink-0 opacity-80" />
              <span className="text-[10px] font-medium leading-none">{chip.label}</span>
              <span className="text-xs font-semibold tabular-nums leading-none">
                <CountUp to={chip.value} />
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
