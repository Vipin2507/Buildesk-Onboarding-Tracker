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
  return Math.max(4, Math.round(size * 0.09));
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
  const numberSize = Math.max(10, Math.min(22, Math.round(inner * 0.36)));
  const percentSize = Math.max(7, Math.min(11, Math.round(numberSize * 0.52)));
  const stacked = size <= 80;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: EASE }}
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
      <div className="absolute inset-0 flex items-center justify-center">
        {stacked ? (
          <div className="flex flex-col items-center leading-none">
            <span
              style={{ fontSize: numberSize }}
              className={cn("font-semibold tabular-nums tracking-tight", colors.text)}
            >
              <CountUp to={v} duration={duration} />
            </span>
            {showPercentSign ? (
              <span
                style={{ fontSize: percentSize }}
                className="mt-px font-medium text-muted-foreground"
              >
                %
              </span>
            ) : null}
          </div>
        ) : (
          <span
            style={{ fontSize: numberSize }}
            className={cn("font-semibold tabular-nums leading-none", colors.text)}
          >
            <CountUp
              to={v}
              duration={duration}
              format={(n) => `${Math.round(n)}${showPercentSign ? "%" : ""}`}
            />
          </span>
        )}
      </div>
    </motion.div>
  );
}
