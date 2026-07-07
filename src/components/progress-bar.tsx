import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${v}%` }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "h-full rounded-full",
          v >= 100 ? "bg-success" : v >= 60 ? "bg-accent" : v >= 30 ? "bg-warning" : "bg-destructive",
        )}
      />
    </div>
  );
}

export function ProgressRing({ value, size = 96, stroke = 10 }: { value: number; size?: number; stroke?: number }) {
  const v = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-muted" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          className="fill-none stroke-accent"
          initial={{ strokeDasharray: `0 ${c}` }}
          animate={{ strokeDasharray: `${(v / 100) * c} ${c}` }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold text-foreground">{v}%</span>
      </div>
    </div>
  );
}
