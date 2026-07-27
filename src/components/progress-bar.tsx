import { motion } from "framer-motion";
import { CountUp } from "@/components/count-up";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

type ProgressTone = "auto" | "primary" | "success" | "warning" | "danger";

function resolveTone(value: number, tone: ProgressTone) {
  if (tone !== "auto") {
    const map = {
      primary: { stroke: "stroke-primary", text: "text-primary" },
      success: { stroke: "stroke-success", text: "text-success" },
      warning: { stroke: "stroke-warning", text: "text-warning-foreground" },
      danger: { stroke: "stroke-destructive", text: "text-destructive" },
    } as const;
    return map[tone];
  }
  if (value >= 100) return { stroke: "stroke-success", text: "text-success" };
  if (value >= 60) return { stroke: "stroke-primary", text: "text-primary" };
  if (value >= 30) return { stroke: "stroke-warning", text: "text-warning-foreground" };
  return { stroke: "stroke-destructive", text: "text-destructive" };
}

function defaultStroke(size: number) {
  return Math.max(4, Math.round(size * 0.075));
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
  const v = Math.max(0, Math.min(100, value));
  const strokeWidth = stroke ?? defaultStroke(size);
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const colors = resolveTone(v, tone);
  const inner = size - strokeWidth * 2;
  const digits = v >= 100 ? 3 : v >= 10 ? 2 : 1;
  const charSlots = digits + (showPercentSign ? 1 : 0);
  const fontSize = Math.min(20, Math.max(9, Math.round(inner / (charSlots * 0.58))));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: EASE }}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${v} percent`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={strokeWidth}
          className="fill-none stroke-muted/70"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={cn("fill-none", colors.stroke)}
          initial={{ strokeDasharray: c, strokeDashoffset: c }}
          animate={{ strokeDasharray: c, strokeDashoffset: c - (v / 100) * c }}
          transition={{ duration, ease: EASE }}
        />
      </svg>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, delay: 0.12, ease: EASE }}
        className="absolute inset-0 flex items-center justify-center px-1"
      >
        <span
          style={{ fontSize }}
          className="inline-flex items-baseline leading-none whitespace-nowrap"
        >
          <span className={cn("font-semibold tabular-nums tracking-tight", colors.text)}>
            <CountUp to={v} duration={duration} />
          </span>
          {showPercentSign ? (
            <span className={cn("ml-px text-[0.58em] font-semibold opacity-75", colors.text)}>%</span>
          ) : null}
        </span>
      </motion.div>
    </motion.div>
  );
}
