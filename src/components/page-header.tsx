import { motion } from "framer-motion";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const PAGE_EASE = [0.22, 1, 0.36, 1] as const;

export const pageSectionVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: PAGE_EASE },
  },
};

export function PageHeader({
  title,
  subtitle,
  actions,
  compact = true,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Dense header for list/admin pages (default). */
  compact?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: PAGE_EASE }}
      className={cn(
        "flex max-w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between md:items-center",
        compact ? "mb-3" : "mb-5 gap-3 md:mb-6 md:items-end",
      )}
    >
      <div className="min-w-0 flex-1">
        <h1
          className={cn(
            "font-semibold tracking-tight break-words text-foreground",
            compact ? "text-base sm:text-lg" : "text-xl md:text-2xl",
          )}
        >
          {title}
        </h1>
        {subtitle ? (
          <p
            className={cn(
              "text-muted-foreground",
              compact ? "mt-0.5 line-clamp-2 text-xs sm:line-clamp-1" : "mt-1 text-sm",
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div
          className={cn(
            "flex w-full min-w-0 flex-wrap items-center sm:w-auto sm:justify-end",
            compact ? "gap-1.5" : "gap-2",
          )}
        >
          {actions}
        </div>
      ) : null}
    </motion.div>
  );
}

export function PageWrap({
  children,
  compact = true,
}: {
  children: ReactNode;
  /** Dense page padding (default). */
  compact?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: PAGE_EASE }}
      className={cn(
        "min-w-0 max-w-full overflow-x-hidden",
        compact
          ? "p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 lg:p-5"
          : "p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-6 lg:p-8",
      )}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedSection({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: PAGE_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
