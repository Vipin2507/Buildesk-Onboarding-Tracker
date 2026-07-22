import { motion } from "framer-motion";
import { CheckCircle2, CloudUpload, Package, Radio } from "lucide-react";

import { CountUp } from "@/components/count-up";
import { cn } from "@/lib/utils";
import type { ChecklistPhaseBucket } from "@/lib/checklist";
import type { DashboardDrillDownFilter } from "@/stores/dashboard-selectors";

const EASE = [0.22, 1, 0.36, 1] as const;

const PHASES: {
  phase: ChecklistPhaseBucket;
  label: string;
  shortLabel: string;
  icon: typeof Package;
  barClass: string;
  cardTone: string;
}[] = [
  {
    phase: "awaiting_collection",
    label: "Awaiting Collection",
    shortLabel: "Collected",
    icon: Package,
    barClass: "bg-info",
    cardTone: "bg-info/15 text-info",
  },
  {
    phase: "awaiting_upload",
    label: "Awaiting Upload",
    shortLabel: "Uploaded",
    icon: CloudUpload,
    barClass: "bg-warning",
    cardTone: "bg-warning/15 text-warning-foreground",
  },
  {
    phase: "awaiting_live",
    label: "Awaiting Go-Live",
    shortLabel: "Live",
    icon: Radio,
    barClass: "bg-primary",
    cardTone: "bg-primary/15 text-primary",
  },
  {
    phase: "complete",
    label: "Fully Complete",
    shortLabel: "Done",
    icon: CheckCircle2,
    barClass: "bg-success",
    cardTone: "bg-success/15 text-success",
  },
];

type Props = {
  stats: {
    awaitingCollection: number;
    awaitingUpload: number;
    awaitingLive: number;
    complete: number;
    progressPercent: number;
    applicable: number;
  };
  activePhase?: ChecklistPhaseBucket;
  onPhaseClick: (filter: DashboardDrillDownFilter) => void;
};

export function OnboardingPipelineSection({ stats, activePhase, onPhaseClick }: Props) {
  const total =
    stats.awaitingCollection + stats.awaitingUpload + stats.awaitingLive + stats.complete || 1;

  const segments = [
    { count: stats.awaitingCollection, className: "bg-info" },
    { count: stats.awaitingUpload, className: "bg-warning" },
    { count: stats.awaitingLive, className: "bg-primary" },
    { count: stats.complete, className: "bg-success" },
  ];

  const values: Record<ChecklistPhaseBucket, number> = {
    awaiting_collection: stats.awaitingCollection,
    awaiting_upload: stats.awaitingUpload,
    awaiting_live: stats.awaitingLive,
    complete: stats.complete,
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.12, ease: EASE }}
      className="card-soft p-4 sm:p-5"
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-semibold">Onboarding Task Pipeline</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {stats.applicable} tasks across all companies · Collected → Uploaded → Live
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tabular-nums">
            <CountUp to={stats.progressPercent} format={(n) => `${Math.round(n)}%`} />
          </div>
          <div className="text-[11px] text-muted-foreground">Overall phase completion</div>
        </div>
      </div>

      <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-muted">
        {segments.map((seg, i) =>
          seg.count > 0 ? (
            <motion.div
              key={i}
              initial={{ width: 0 }}
              animate={{ width: `${(seg.count / total) * 100}%` }}
              transition={{ duration: 0.7, delay: 0.15 + i * 0.08, ease: EASE }}
              className={cn("h-full first:rounded-l-full last:rounded-r-full", seg.className)}
            />
          ) : null,
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {PHASES.map((phase, i) => {
          const Icon = phase.icon;
          const value = values[phase.phase];
          const isActive = activePhase === phase.phase;
          return (
            <motion.button
              key={phase.phase}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 + i * 0.05, duration: 0.35, ease: EASE }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onPhaseClick({ type: "checklist", phase: phase.phase })}
              className={cn(
                "rounded-xl border bg-card/60 p-3 text-left transition-colors hover:border-primary/35 hover:bg-card sm:p-3.5",
                isActive && "border-primary/50 ring-2 ring-primary/30",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className={cn("rounded-lg p-2", phase.cardTone)}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {phase.shortLabel}
                </span>
              </div>
              <div className="mt-2 text-xl font-semibold tabular-nums sm:text-2xl">
                <CountUp to={value} />
              </div>
              <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{phase.label}</div>
            </motion.button>
          );
        })}
      </div>
    </motion.section>
  );
}
