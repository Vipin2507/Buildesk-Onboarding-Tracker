import { motion } from "framer-motion";
import { CheckCircle2, ChevronRight, CloudUpload, Layers, Package, Radio, TrendingUp, Users } from "lucide-react";

import { CountUp } from "@/components/count-up";
import { cn } from "@/lib/utils";
import type { ChecklistPhaseBucket } from "@/lib/checklist";
import type { DashboardDrillDownFilter } from "@/stores/dashboard-selectors";

const EASE = [0.22, 1, 0.36, 1] as const;

const PHASES: {
  phase: ChecklistPhaseBucket;
  shortLabel: string;
  icon: typeof Package;
  iconTone: string;
}[] = [
  {
    phase: "awaiting_collection",
    shortLabel: "Collect",
    icon: Users,
    iconTone: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  },
  {
    phase: "awaiting_upload",
    shortLabel: "Upload",
    icon: CloudUpload,
    iconTone: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  },
  {
    phase: "awaiting_live",
    shortLabel: "Live",
    icon: Radio,
    iconTone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  {
    phase: "complete",
    shortLabel: "Done",
    icon: CheckCircle2,
    iconTone: "bg-blue-600/15 text-blue-600 dark:text-blue-400",
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
  compact?: boolean;
};

export function OnboardingPipelineSection({
  stats,
  activePhase,
  onPhaseClick,
}: Props) {
  const total =
    stats.awaitingCollection + stats.awaitingUpload + stats.awaitingLive + stats.complete || 1;

  const segments = [
    { count: stats.awaitingCollection, color: "bg-[#009bff]", label: "Collect" },
    { count: stats.awaitingUpload, color: "bg-[#8b5cf6]", label: "Upload" },
    { count: stats.awaitingLive, color: "bg-[#10b981]", label: "Live" },
    { count: stats.complete, color: "bg-[#059669]", label: "Done" },
  ];

  const values: Record<ChecklistPhaseBucket, number> = {
    awaiting_collection: stats.awaitingCollection,
    awaiting_upload: stats.awaitingUpload,
    awaiting_live: stats.awaitingLive,
    complete: stats.complete,
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: 0.06, ease: EASE }}
      className="rounded-2xl border border-border/75 bg-card p-3.5 sm:p-4 shadow-2xs transition-shadow duration-200"
    >
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-bold tracking-tight text-foreground">
              Onboarding Pipeline
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {stats.applicable.toLocaleString()} tasks across your onboarding flow
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            title="Completed checklist steps divided by every collect, upload, and go-live step for companies in the selected range."
            className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400"
          >
            <TrendingUp className="h-3 w-3" />
            <CountUp to={stats.progressPercent} format={(n) => `${Math.round(n)}% complete`} />
          </span>
        </div>
      </div>

      {/* Multi-Segment Stacked Progress Bar */}
      <div className="mb-3">
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted/60 p-0.5">
          {segments.map((seg, i) =>
            seg.count > 0 ? (
              <motion.div
                key={i}
                title={`${seg.label}: ${seg.count} (${Math.round((seg.count / total) * 100)}%)`}
                initial={{ width: 0 }}
                animate={{ width: `${(seg.count / total) * 100}%` }}
                transition={{ duration: 0.6, delay: 0.08 + i * 0.04, ease: EASE }}
                className={cn("h-full first:rounded-l-full last:rounded-r-full transition-all", seg.color)}
                role="progressbar"
                aria-valuenow={seg.count}
                aria-valuemin={0}
                aria-valuemax={total}
              />
            ) : null,
          )}
        </div>
      </div>

      {/* 4 Phase Cards matching reference screenshot */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {PHASES.map((phase, i) => {
          const Icon = phase.icon;
          const value = values[phase.phase];
          const isActive = activePhase === phase.phase;

          return (
            <motion.button
              key={phase.phase}
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.03, duration: 0.25, ease: EASE }}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onPhaseClick({ type: "checklist", phase: phase.phase })}
              className={cn(
                "group relative flex items-center justify-between rounded-xl border border-border/70 bg-card px-3 py-2 text-left transition-all duration-150 hover:border-primary/40 hover:bg-muted/20 hover:shadow-2xs cursor-pointer h-[54px]",
                isActive && "border-primary ring-2 ring-primary/40 bg-muted/20",
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105", phase.iconTone)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold tracking-tight tabular-nums text-foreground leading-none">
                    <CountUp to={value} />
                  </div>
                  <div className="mt-0.5 text-[11px] font-medium text-muted-foreground leading-none">
                    {phase.shortLabel}
                  </div>
                </div>
              </div>

              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </motion.button>
          );
        })}
      </div>
    </motion.section>
  );
}
