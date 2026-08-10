import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  AlarmClock,
  ClipboardList,
  CloudUpload,
  GraduationCap,
  ListChecks,
  Radio,
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
  highPriority: number;
  onOpen: (filter: CrmDashboardDrillDownFilter) => void;
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
  highPriority,
  onOpen,
  activeFilter,
}: Props) {
  const chips: SummaryChip[] = [
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
              onClick={() => onOpen(chip.filter)}
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
