import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

export type AppLoadingScreenProps = {
  /** Primary status line */
  message?: string;
  /** Rotating status lines (overrides `message` when set) */
  messages?: string[];
  /** Full viewport block vs floating overlay */
  variant?: "fullscreen" | "overlay";
  className?: string;
};

function BuildeskMark({ compact }: { compact?: boolean }) {
  const size = compact ? 40 : 52;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size * 1.6, height: size * 1.6 }}>
      <motion.span
        className="absolute inset-0 rounded-2xl border border-primary/20"
        animate={{ scale: [1, 1.12, 1], opacity: [0.45, 0.12, 0.45] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.span
        className="absolute inset-1 rounded-xl border border-primary/30"
        animate={{ scale: [1, 1.08, 1], opacity: [0.35, 0.08, 0.35] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.25 }}
      />
      <motion.div
        className={cn(
          "relative flex items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/25",
          compact ? "h-10 w-10" : "h-[52px] w-[52px]",
        )}
        animate={{ y: [0, -2, 0] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg
          viewBox="0 0 64 64"
          aria-hidden
          className={cn("text-primary-foreground", compact ? "h-6 w-6" : "h-7 w-7")}
        >
          <path
            fill="currentColor"
            d="M18 46V18h12.4c6.5 0 10.6 3.4 10.6 8.6 0 3.3-1.8 5.9-4.7 7.2 3.6 1.2 5.9 4.2 5.9 8.1 0 5.6-4.4 9.1-11.3 9.1H18zm6.4-16.1h5.5c3.1 0 4.9-1.5 4.9-3.9s-1.8-3.8-4.9-3.8h-5.5v7.7zm0 5.2v8.1h6.4c3.4 0 5.4-1.6 5.4-4.2s-2-3.9-5.5-3.9h-6.3z"
          />
        </svg>
      </motion.div>
    </div>
  );
}

function ProgressShimmer({ compact }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-full bg-muted",
        compact ? "mt-3 h-1 w-36" : "mt-5 h-1.5 w-48",
      )}
    >
      <motion.div
        className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-primary"
        animate={{ x: ["-100%", "320%"] }}
        transition={{ duration: 1.35, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

export function AppLoadingScreen({
  message = "Loading…",
  messages,
  variant = "fullscreen",
  className,
}: AppLoadingScreenProps) {
  const compact = variant === "overlay";
  const lines = messages?.length ? messages : [message];
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    if (lines.length <= 1) return;
    const timer = window.setInterval(() => {
      setLineIndex((i) => (i + 1) % lines.length);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [lines]);

  const content = (
    <motion.div
      initial={{ opacity: 0, y: compact ? 4 : 10, scale: compact ? 0.98 : 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: compact ? -4 : -8, scale: 0.98 }}
      transition={{ duration: 0.32, ease: EASE }}
      className={cn(
        "flex flex-col items-center text-center",
        compact ? "rounded-2xl border bg-card/95 px-6 py-5 shadow-xl backdrop-blur-md" : "px-6",
        className,
      )}
    >
      <BuildeskMark compact={compact} />
      <div className={cn("font-semibold tracking-tight text-foreground", compact ? "mt-3 text-sm" : "mt-4 text-base")}>
        Buildesk
      </div>
      <div className={cn("relative min-h-[1.25rem] text-muted-foreground", compact ? "mt-1 w-44 text-xs" : "mt-1.5 w-56 text-sm")}>
        <AnimatePresence mode="wait">
          <motion.p
            key={lines[lineIndex]}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="absolute inset-x-0 truncate"
          >
            {lines[lineIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
      <ProgressShimmer compact={compact} />
    </motion.div>
  );

  if (variant === "overlay") {
    return content;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      <motion.div
        className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
        animate={{ x: [0, 24, 0], y: [0, -16, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute -right-16 bottom-1/4 h-64 w-64 rounded-full bg-info/10 blur-3xl"
        animate={{ x: [0, -20, 0], y: [0, 12, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      />
      {content}
    </div>
  );
}
