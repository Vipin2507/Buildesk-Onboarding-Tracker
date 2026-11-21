import { motion } from "framer-motion";
import { CheckCircle2, ChevronRight, CloudUpload, Layers, Package, Radio, TrendingUp } from "lucide-react";

import { CountUp } from "@/components/count-up";
import { cn } from "@/lib/utils";
import type { ChecklistPhaseBucket } from "@/lib/checklist";
import type { DashboardDrillDownFilter } from "@/stores/dashboard-selectors";

const EASE = [0.22, 1, 0.36, 1] as const;

const PHASES: {
  phase: ChecklistPhaseBucket;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof Package;
  barColor: string;
  dotColor: string;
  iconTone: string;
}[] = [
  {
    phase: "awaiting_collection",
    label: "Awaiting Collection",
    shortLabel: "Collect",
    description: "Waiting for client-provided masters or formats.",
    icon: Package,
    barColor: "bg-[#009bff]",
    dotColor: "bg-blue-500",
    iconTone: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  },
  {
    phase: "awaiting_upload",
    label: "Awaiting Upload",
    shortLabel: "Upload",
    description: "Data received and awaiting ERP loading.",
    icon: CloudUpload,
    barColor: "bg-[#8b5cf6]",
    dotColor: "bg-purple-500",
    iconTone: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  },
  {
    phase: "awaiting_live",
    label: "Awaiting Go-Live",
    shortLabel: "Live",
    description: "Setup is ready for verification and go-live.",
    icon: Radio,
    barColor: "bg-[#06b6d4]",
    dotColor: "bg-cyan-500",
    iconTone: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  },
  {
    phase: "complete",
    label: "Fully Complete",
    shortLabel: "Done",
    description: "Checklist items successfully completed.",
    icon: CheckCircle2,
    barColor: "bg-[#10b981]",
    dotColor: "bg-emerald-500",
    iconTone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
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
  compact = false,
}: Props) {
  const total =
    stats.awaitingCollection + stats.awaitingUpload + stats.awaitingLive + stats.complete || 1;

  const segments = [
    { count: stats.awaitingCollection, color: "bg-[#009bff]", label: "Collection" },
    { count: stats.awaitingUpload, color: "bg-[#8b5cf6]", label: "Upload" },
    { count: stats.awaitingLive, color: "bg-[#06b6d4]", label: "Go-Live" },
    { count: stats.complete, color: "bg-[#10b981]", label: "Complete" },
  ];

  const values: Record<ChecklistPhaseBucket, number> = {
    awaiting_collection: stats.awaitingCollection,
    awaiting_upload: stats.awaitingUpload,
    awaiting_live: stats.awaitingLive,
    complete: stats.complete,
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay: 0.08, ease: EASE }}
      className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs transition-shadow duration-300 hover:shadow-sm"
    >
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Layers className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold tracking-tight text-foreground">
              Onboarding Pipeline
            </h2>
            <p className="text-xs text-muted-foreground">
              {stats.applicable.toLocaleString()} tasks across your onboarding flow · click a phase to inspect
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 shadow-2xs">
            <TrendingUp className="h-3.5 w-3.5" />
            <CountUp to={stats.progressPercent} format={(n) => `${Math.round(n)}% Completion`} />
          </span>
        </div>
      </div>

      {/* Multi-Segment Stacked Progress Bar */}
      <div className="mb-4">
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted/60 p-0.5">
          {segments.map((seg, i) =>
            seg.count > 0 ? (
              <motion.div
                key={i}
                title={`${seg.label}: ${seg.count} (${Math.round((seg.count / total) * 100)}%)`}
                initial={{ width: 0 }}
                animate={{ width: `${(seg.count / total) * 100}%` }}
                transition={{ duration: 0.65, delay: 0.1 + i * 0.05, ease: EASE }}
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

      {/* 4 Phase Cards */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {PHASES.map((phase, i) => {
          const Icon = phase.icon;
          const value = values[phase.phase];
          const isActive = activePhase === phase.phase;
          const pct = Math.round((value / total) * 100);

          return (
            <motion.button
              key={phase.phase}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + i * 0.04, duration: 0.32, ease: EASE }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onPhaseClick({ type: "checklist", phase: phase.phase })}
              className={cn(
                "group relative flex flex-col justify-between rounded-xl border border-border/70 bg-card p-3.5 text-left transition-all duration-200 hover:border-primary/40 hover:bg-muted/[0.15] hover:shadow-xs",
                isActive && "border-primary ring-2 ring-primary/40 shadow-xs bg-muted/20",
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg transition-transform group-hover:scale-105", phase.iconTone)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                </div>

                <div className="mt-3 flex items-baseline justify-between gap-1">
                  <div className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums text-foreground">
                    <CountUp to={value} />
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                    {pct}%
                  </span>
                </div>

                <div className="mt-0.5 text-xs font-semibold text-foreground">
                  {phase.shortLabel}
                </div>
                <div className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                  {phase.description}
                </div>
              </div>

              {/* Progress track */}
              <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted/70">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", phase.barColor)}
                  style={{ width: `${Math.max(pct, value > 0 ? 3 : 0)}%` }}
                />
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.section>
  );
}
