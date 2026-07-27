import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";

import { CountUp } from "@/components/count-up";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

export type DashboardKpiCardProps = {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: string;
  hint?: string;
  delay?: number;
  active?: boolean;
  compact?: boolean;
  onClick?: () => void;
};

export function DashboardKpiCard({
  label,
  value,
  icon: Icon,
  tone,
  hint,
  delay = 0,
  active,
  compact = false,
  onClick,
}: DashboardKpiCardProps) {
  const interactive = Boolean(onClick);

  if (compact) {
    return (
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.28, ease: EASE }}
        whileHover={interactive ? { y: -1 } : undefined}
        whileTap={interactive ? { scale: 0.98 } : undefined}
        onClick={onClick}
        disabled={!interactive}
        className={cn(
          "flex items-center gap-2 rounded-lg border bg-card/60 px-2 py-1.5 text-left",
          interactive && "cursor-pointer hover:border-primary/30 hover:bg-card",
          active && "ring-2 ring-primary/40",
          !interactive && "cursor-default",
        )}
      >
        <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", tone)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold tabular-nums leading-none">
            <CountUp to={value} />
          </div>
          <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{label}</div>
        </div>
        {interactive ? (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/70" />
        ) : null}
      </motion.button>
    );
  }

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.38, ease: EASE }}
      whileHover={interactive ? { y: -3, transition: { duration: 0.2 } } : undefined}
      whileTap={interactive ? { scale: 0.98 } : undefined}
      onClick={onClick}
      disabled={!interactive}
      className={cn(
        "card-soft group relative w-full overflow-hidden p-3 text-left sm:p-4",
        interactive && "cursor-pointer hover:border-primary/30 hover:shadow-md",
        active && "ring-2 ring-primary/40",
        !interactive && "cursor-default",
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100",
          tone.includes("primary") && "bg-primary/20",
          tone.includes("success") && "bg-success/25",
          tone.includes("warning") && "bg-warning/25",
          tone.includes("destructive") && "bg-destructive/20",
          tone.includes("info") && "bg-info/25",
        )}
      />
      <div className="relative flex items-start justify-between gap-2">
        <div
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-lg sm:h-9 sm:w-9",
            tone,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        {interactive ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        ) : null}
      </div>
      <div className="relative mt-2 text-xl font-semibold tracking-tight sm:mt-3 sm:text-2xl">
        <CountUp to={value} />
      </div>
      <div className="relative text-[11px] text-muted-foreground sm:text-xs">{label}</div>
      {hint ? <div className="relative mt-1 text-[10px] text-muted-foreground/80">{hint}</div> : null}
    </motion.button>
  );
}
