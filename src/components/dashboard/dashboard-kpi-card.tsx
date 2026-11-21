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
  tone?: string;
  variant?: "primary" | "in_progress" | "completed" | "on_hold";
  trend?: string;
  hint?: string;
  delay?: number;
  active?: boolean;
  compact?: boolean;
  onClick?: () => void;
};

const VARIANT_CONFIGS = {
  primary: {
    waveColor: "#009bff",
    waveStroke: "M 0,48 C 60,20 120,62 180,32 C 240,12 270,38 300,26",
    waveFill: "M 0,48 C 60,20 120,62 180,32 C 240,12 270,38 300,26 L 300,80 L 0,80 Z",
    iconBg: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    glow: "from-blue-500/[0.08] via-blue-500/[0.02] to-transparent",
    border: "hover:border-blue-500/40",
  },
  in_progress: {
    waveColor: "#10b981",
    waveStroke: "M 0,52 C 70,68 130,28 190,48 C 250,58 280,32 300,36",
    waveFill: "M 0,52 C 70,68 130,28 190,48 C 250,58 280,32 300,36 L 300,80 L 0,80 Z",
    iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    glow: "from-emerald-500/[0.08] via-emerald-500/[0.02] to-transparent",
    border: "hover:border-emerald-500/40",
  },
  completed: {
    waveColor: "#8b5cf6",
    waveStroke: "M 0,42 C 50,16 110,54 170,28 C 230,48 270,22 300,32",
    waveFill: "M 0,42 C 50,16 110,54 170,28 C 230,48 270,22 300,32 L 300,80 L 0,80 Z",
    iconBg: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
    glow: "from-purple-500/[0.08] via-purple-500/[0.02] to-transparent",
    border: "hover:border-purple-500/40",
  },
  on_hold: {
    waveColor: "#f59e0b",
    waveStroke: "M 0,56 C 80,36 140,58 200,36 C 250,22 280,46 300,42",
    waveFill: "M 0,56 C 80,36 140,58 200,36 C 250,22 280,46 300,42 L 300,80 L 0,80 Z",
    iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    glow: "from-amber-500/[0.08] via-amber-500/[0.02] to-transparent",
    border: "hover:border-amber-500/40",
  },
};

export function DashboardKpiCard({
  label,
  value,
  icon: Icon,
  tone,
  variant,
  trend,
  hint,
  delay = 0,
  active,
  compact = false,
  onClick,
}: DashboardKpiCardProps) {
  const interactive = Boolean(onClick);

  // Auto-resolve variant if not explicitly provided
  const resolvedVariant =
    variant ??
    (label.toLowerCase().includes("in progress")
      ? "in_progress"
      : label.toLowerCase().includes("completed")
        ? "completed"
        : label.toLowerCase().includes("hold")
          ? "on_hold"
          : "primary");

  const cfg = VARIANT_CONFIGS[resolvedVariant];

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
          "flex items-center gap-2 rounded-xl border bg-card/70 px-2.5 py-2 text-left transition-all",
          interactive && "cursor-pointer hover:border-primary/30 hover:bg-card hover:shadow-xs",
          active && "ring-2 ring-primary/40 border-primary",
          !interactive && "cursor-default",
        )}
      >
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", cfg.iconBg)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold tabular-nums leading-none">
            <CountUp to={value} />
          </div>
          <div className="mt-1 truncate text-[11px] text-muted-foreground">{label}</div>
        </div>
        {interactive ? (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
        ) : null}
      </motion.button>
    );
  }

  const gradId = `kpi-wave-grad-${resolvedVariant}-${label.replace(/\s+/g, "").toLowerCase()}`;

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
        "group relative w-full overflow-hidden rounded-2xl border border-border/80 bg-card p-4 text-left shadow-xs transition-all duration-300",
        interactive && cn("cursor-pointer hover:shadow-md", cfg.border),
        active && "ring-2 ring-primary border-primary shadow-sm",
        !interactive && "cursor-default",
      )}
    >
      {/* Background radial gradient glow */}
      <div
        className={cn(
          "pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-gradient-to-br opacity-50 blur-2xl transition-opacity duration-500 group-hover:opacity-100",
          cfg.glow,
        )}
      />

      {/* Responsive SVG Wave Contour */}
      <svg
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-14 w-full opacity-40 transition-opacity duration-300 group-hover:opacity-80 dark:opacity-25 dark:group-hover:opacity-60"
        viewBox="0 0 300 80"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={cfg.waveColor} stopOpacity="0.35" />
            <stop offset="100%" stopColor={cfg.waveColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={cfg.waveFill} fill={`url(#${gradId})`} />
        <path
          d={cfg.waveStroke}
          fill="none"
          stroke={cfg.waveColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="relative z-10">
        <div className="flex items-center justify-between gap-2">
          <div
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105",
              cfg.iconBg,
            )}
          >
            <Icon className="h-4.5 w-4.5" />
          </div>
          {interactive ? (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted/40 text-muted-foreground opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0.5">
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          ) : null}
        </div>

        <div className="mt-3">
          <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground tabular-nums">
              <CountUp to={value} />
            </span>
            {trend ? (
              <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                {trend}
              </span>
            ) : null}
          </div>
          {hint ? (
            <div className="mt-1 text-[10px] text-muted-foreground/80">{hint}</div>
          ) : null}
        </div>
      </div>
    </motion.button>
  );
}
