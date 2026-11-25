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
  /** Explains the percentage, shown on hover. */
  trendTitle?: string;
  hint?: string;
  delay?: number;
  active?: boolean;
  compact?: boolean;
  onClick?: () => void;
};

const VARIANT_CONFIGS = {
  primary: {
    isSolid: true,
    bgClass: "bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 border-transparent",
    iconBg: "bg-white/20 text-white border border-white/25",
    labelClass: "text-blue-100",
    valueClass: "text-white",
    trendClass: "bg-white/20 text-white border border-white/20",
    waveColor: "#ffffff",
    waveStroke: "M 0,38 C 60,15 120,50 180,24 C 240,10 270,30 300,20",
    waveFill: "M 0,38 C 60,15 120,50 180,24 C 240,10 270,30 300,20 L 300,60 L 0,60 Z",
    glow: "from-white/20 via-white/5 to-transparent",
    border: "hover:shadow-lg hover:shadow-blue-500/30",
  },
  in_progress: {
    isSolid: false,
    bgClass: "bg-card border-border/75",
    iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
    labelClass: "text-muted-foreground",
    valueClass: "text-foreground",
    trendClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    waveColor: "#10b981",
    waveStroke: "M 0,42 C 70,55 130,22 190,38 C 250,48 280,25 300,28",
    waveFill: "M 0,42 C 70,55 130,22 190,38 C 250,48 280,25 300,28 L 300,60 L 0,60 Z",
    glow: "from-emerald-500/[0.08] via-emerald-500/[0.02] to-transparent",
    border: "hover:border-emerald-500/40",
  },
  completed: {
    isSolid: false,
    bgClass: "bg-card border-border/75",
    iconBg: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20",
    labelClass: "text-muted-foreground",
    valueClass: "text-foreground",
    trendClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    waveColor: "#8b5cf6",
    waveStroke: "M 0,34 C 50,14 110,44 170,22 C 230,38 270,18 300,24",
    waveFill: "M 0,34 C 50,14 110,44 170,22 C 230,38 270,18 300,24 L 300,60 L 0,60 Z",
    glow: "from-purple-500/[0.08] via-purple-500/[0.02] to-transparent",
    border: "hover:border-purple-500/40",
  },
  on_hold: {
    isSolid: false,
    bgClass: "bg-card border-border/75",
    iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20",
    labelClass: "text-muted-foreground",
    valueClass: "text-foreground",
    trendClass: "bg-muted text-muted-foreground",
    waveColor: "#f59e0b",
    waveStroke: "M 0,44 C 80,28 140,46 200,28 C 250,18 280,36 300,32",
    waveFill: "M 0,44 C 80,28 140,46 200,28 C 250,18 280,36 300,32 L 300,60 L 0,60 Z",
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
  trendTitle,
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
        transition={{ delay, duration: 0.25, ease: EASE }}
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
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
            tone ?? cfg.iconBg,
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold tabular-nums leading-none">
            <CountUp to={value} />
          </div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{label}</div>
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.32, ease: EASE }}
      whileHover={interactive ? { y: -2, transition: { duration: 0.18 } } : undefined}
      whileTap={interactive ? { scale: 0.98 } : undefined}
      onClick={onClick}
      disabled={!interactive}
      className={cn(
        "group relative w-full overflow-hidden rounded-2xl border p-3.5 text-left shadow-2xs transition-all duration-200 min-h-[112px] flex flex-col justify-between",
        cfg.bgClass,
        interactive && cn("cursor-pointer", cfg.border),
        active && "ring-2 ring-primary border-primary shadow-sm",
        !interactive && "cursor-default",
      )}
    >
      {/* Background radial gradient glow */}
      <div
        className={cn(
          "pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br opacity-40 blur-xl transition-opacity duration-300 group-hover:opacity-80",
          cfg.glow,
        )}
      />

      {/* Responsive SVG Wave Contour */}
      <svg
        className={cn(
          "pointer-events-none absolute bottom-0 left-0 right-0 h-11 w-full transition-opacity duration-300",
          cfg.isSolid ? "opacity-35 group-hover:opacity-60" : "opacity-35 group-hover:opacity-75 dark:opacity-20",
        )}
        viewBox="0 0 300 60"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={cfg.waveColor} stopOpacity={cfg.isSolid ? "0.3" : "0.3"} />
            <stop offset="100%" stopColor={cfg.waveColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={cfg.waveFill} fill={`url(#${gradId})`} />
        <path
          d={cfg.waveStroke}
          fill="none"
          stroke={cfg.waveColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="relative z-10 flex items-center justify-between">
        <div
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105",
            cfg.iconBg,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        {interactive ? (
          <div
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full opacity-0 transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0.5",
              cfg.isSolid ? "text-white/80" : "text-muted-foreground",
            )}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </div>
        ) : null}
      </div>

      <div className="relative z-10 mt-2.5">
        <div className={cn("text-xs font-semibold tracking-normal", cfg.labelClass)}>
          {label}
        </div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className={cn("text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums leading-none", cfg.valueClass)}>
            <CountUp to={value} />
          </span>
          {trend ? (
            <span
              title={trendTitle}
              className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none", cfg.trendClass)}
            >
              {trend}
            </span>
          ) : null}
        </div>
      </div>
    </motion.button>
  );
}
