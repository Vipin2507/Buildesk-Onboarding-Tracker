import { AnimatePresence, motion } from "framer-motion";

import { useCrmDashboardSyncStore } from "@/stores/useCrmDashboardSyncStore";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

type Props = {
  children: React.ReactNode;
  className?: string;
};

/** Subtle shimmer overlay while background dashboard data refreshes. */
export function CrmDashboardRefreshShimmer({ children, className }: Props) {
  const refreshing = useCrmDashboardSyncStore((s) => s.phase === "refreshing");

  return (
    <div className={cn("relative", className)}>
      {children}
      <AnimatePresence>
        {refreshing ? (
          <motion.div
            key="refresh-shimmer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
            aria-hidden
          >
            <motion.div
              className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-primary/[0.06] to-transparent"
              animate={{ x: ["0%", "200%"] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
