import { cn } from "@/lib/utils";
import { STATUS_LABEL, type StatusKey } from "@/types/common";

const styles: Record<StatusKey, string> = {
  not_started: "bg-muted text-muted-foreground border-border",
  in_progress: "bg-warning/15 text-warning-foreground border-warning/30",
  review: "bg-primary/15 text-primary border-primary/30",
  completed: "bg-success/15 text-success border-success/30",
  on_hold: "bg-destructive/15 text-destructive border-destructive/30",
};

export function StatusPill({ status, className }: { status: StatusKey; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles[status],
        className,
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", {
          "bg-muted-foreground": status === "not_started",
          "bg-warning": status === "in_progress",
          "bg-primary": status === "review",
          "bg-success": status === "completed",
          "bg-destructive": status === "on_hold",
        })}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Pill({
  children,
  tone = "muted",
  className,
}: {
  children: React.ReactNode;
  tone?: "muted" | "accent" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  const tones: Record<string, string> = {
    muted: "bg-muted text-muted-foreground border-border",
    accent: "bg-primary/15 text-primary border-primary/30",
    success: "bg-success/15 text-success border-success/30",
    warning: "bg-warning/15 text-warning-foreground border-warning/30",
    danger: "bg-destructive/15 text-destructive border-destructive/30",
    info: "bg-primary/15 text-primary border-primary/30",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}
