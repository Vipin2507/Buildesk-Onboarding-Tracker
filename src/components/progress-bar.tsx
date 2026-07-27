import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CountUp } from "@/components/count-up";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

type ProgressTone = "auto" | "primary" | "success" | "warning" | "danger";

const TONE_VARS = {
  primary: "var(--primary)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--destructive)",
} as const;

const TONE_TEXT = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning-foreground",
  danger: "text-destructive",
} as const;

function resolveToneKey(value: number, tone: ProgressTone): keyof typeof TONE_VARS {
  if (tone !== "auto") return tone;
  if (value >= 100) return "success";
  if (value >= 60) return "primary";
  if (value >= 30) return "warning";
  return "danger";
}

function defaultStroke(size: number) {
  return Math.max(4, Math.round(size * 0.085));
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${v}%` }}
        transition={{ duration: 0.9, ease: EASE }}
        className={cn(
          "h-full rounded-full",
          v >= 100 ? "bg-success" : v >= 60 ? "bg-primary" : v >= 30 ? "bg-warning" : "bg-destructive",
        )}
      />
    </div>
  );
}

export function ProgressRing({
  value,
  size = 96,
  stroke,
  tone = "auto",
  duration = 1,
  className,
  showPercentSign = true,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: ProgressTone;
  duration?: number;
  className?: string;
  showPercentSign?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const reduceMotion = useReducedMotion();
  const v = Math.max(0, Math.min(100, value));
  const strokeWidth = stroke ?? defaultStroke(size);
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const toneKey = resolveToneKey(v, tone);
  const accent = TONE_VARS[toneKey];
  const inner = size - strokeWidth * 2;
  const fontSize = Math.max(9, Math.min(18, Math.round(inner * 0.3)));
  const inset = Math.max(3, Math.round(size * 0.06));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: EASE }}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size, color: accent }}
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${v} percent`}
    >
      {/* Liquid glass lens */}
      <div
        className="pointer-events-none absolute rounded-full border border-foreground/[0.06] bg-card/50 shadow-[inset_0_1px_1px_rgb(255_255_255/0.45),0_2px_10px_rgb(15_23_42/0.06)] backdrop-blur-md dark:border-white/10 dark:bg-card/30 dark:shadow-[inset_0_1px_1px_rgb(255_255_255/0.12),0_2px_12px_rgb(0_0_0/0.35)]"
        style={{ inset }}
        aria-hidden
      />

      {/* Soft ambient glow */}
      <motion.div
        className="pointer-events-none absolute rounded-full opacity-50 blur-md dark:opacity-40"
        style={{
          inset: inset - 1,
          background: `radial-gradient(circle at 50% 38%, color-mix(in srgb, ${accent} 28%, transparent), transparent 68%)`,
        }}
        animate={reduceMotion ? undefined : { opacity: [0.35, 0.55, 0.35] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />

      {/* Slow glass sheen */}
      {!reduceMotion ? (
        <motion.div
          className="pointer-events-none absolute overflow-hidden rounded-full"
          style={{ inset }}
          aria-hidden
        >
          <motion.div
            className="absolute -inset-full opacity-[0.22] dark:opacity-[0.14]"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg, rgb(255 255 255 / 0.55) 32deg, transparent 64deg)",
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          />
        </motion.div>
      ) : null}

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="relative -rotate-90"
        aria-hidden
      >
        <defs>
          <linearGradient id={`${id}-track`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--muted-foreground)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--muted-foreground)" stopOpacity="0.22" />
          </linearGradient>
          <linearGradient id={`${id}-arc`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.72" />
            <stop offset="45%" stopColor={accent} stopOpacity="1" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.82" />
          </linearGradient>
          <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={strokeWidth}
          stroke={`url(#${id}-track)`}
          className="fill-none"
        />

        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={strokeWidth + 3}
          stroke={`url(#${id}-arc)`}
          strokeLinecap="round"
          className="fill-none opacity-35"
          initial={{ strokeDasharray: c, strokeDashoffset: c }}
          animate={{ strokeDasharray: c, strokeDashoffset: c - (v / 100) * c }}
          transition={{ duration, ease: EASE }}
        />

        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={strokeWidth}
          stroke={`url(#${id}-arc)`}
          strokeLinecap="round"
          className="fill-none"
          filter={`url(#${id}-glow)`}
          initial={{ strokeDasharray: c, strokeDashoffset: c }}
          animate={{ strokeDasharray: c, strokeDashoffset: c - (v / 100) * c }}
          transition={{ duration, ease: EASE }}
        />
      </svg>

      <div className="absolute inset-0 flex items-center justify-center px-1">
        <span
          style={{ fontSize }}
          className={cn(
            "inline-flex items-baseline whitespace-nowrap leading-none tracking-tight",
            TONE_TEXT[toneKey],
          )}
        >
          <span className="font-semibold tabular-nums">
            <CountUp to={v} duration={duration} />
          </span>
          {showPercentSign ? (
            <span className="ml-px text-[0.58em] font-semibold opacity-75">%</span>
          ) : null}
        </span>
      </div>
    </motion.div>
  );
}
