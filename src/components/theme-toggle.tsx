import { useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

const ease = [0.33, 0, 0.2, 1] as const;

/**
 * Light/dark control — segmented track with a quiet sliding indicator.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, setMode } = useTheme();
  const trackRef = useRef<HTMLDivElement>(null);
  const isDark = resolved === "dark";

  function pick(next: "light" | "dark", e: React.MouseEvent | React.KeyboardEvent) {
    if (next === resolved) return;
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    setMode(next, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }

  return (
    <div
      ref={trackRef}
      role="group"
      aria-label="Color theme"
      className={cn(
        "relative inline-flex h-10 items-stretch rounded-xl border border-border/80 bg-muted/60 p-1 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.06)]",
        "dark:bg-muted/40 dark:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.04)]",
        className,
      )}
    >
      <motion.span
        aria-hidden
        className={cn(
          "absolute top-1 bottom-1 w-[calc(50%-2px)] rounded-lg",
          "bg-card shadow-[0_1px_2px_rgb(15_23_42_/_0.08),0_4px_12px_rgb(15_23_42_/_0.06)]",
          "dark:bg-secondary dark:shadow-[0_1px_3px_rgb(0_0_0_/_0.35),0_0_0_1px_rgb(255_255_255_/_0.06)]",
          "ring-1 ring-border/60",
        )}
        initial={false}
        animate={{ left: isDark ? "calc(50% + 1px)" : "4px" }}
        transition={{ duration: 0.55, ease }}
      />

      <ToggleOption
        label="Light"
        active={!isDark}
        onSelect={(e) => pick("light", e)}
        icon={<Sun className="h-3.5 w-3.5" strokeWidth={2.25} />}
      />
      <ToggleOption
        label="Dark"
        active={isDark}
        onSelect={(e) => pick("dark", e)}
        icon={<Moon className="h-3.5 w-3.5" strokeWidth={2.25} />}
      />
    </div>
  );
}

/** Compact icon-only variant for tight toolbars. */
export function ThemeToggleCompact({ className }: { className?: string }) {
  const { resolved, toggleLightDark } = useTheme();
  const isDark = resolved === "dark";

  return (
    <button
      type="button"
      className={cn(
        "relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-border/80 bg-card",
        "text-muted-foreground transition-[color,background-color,box-shadow,border-color] duration-500",
        "hover:border-primary/30 hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light theme" : "Dark theme"}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        toggleLightDark({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? "moon" : "sun"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {isDark ? (
            <Moon className="h-4 w-4 text-primary" strokeWidth={2} />
          ) : (
            <Sun className="h-4 w-4 text-primary" strokeWidth={2} />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function ToggleOption({
  label,
  active,
  onSelect,
  icon,
}: {
  label: string;
  active: boolean;
  onSelect: (e: React.MouseEvent<HTMLButtonElement>) => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        "relative z-10 flex min-w-[4.25rem] items-center justify-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold tracking-wide uppercase",
        "transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground/80",
      )}
    >
      <span className={cn("transition-colors duration-300", active && "text-primary")}>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
