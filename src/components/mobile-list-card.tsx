import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

export function MobileListCard({
  title,
  subtitle,
  badge,
  meta,
  href,
  onClick,
  index = 0,
  className,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  meta?: ReactNode;
  /** Prefer Link when navigating; pass a prebuilt path string */
  href?: string;
  onClick?: () => void;
  index?: number;
  className?: string;
}) {
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 truncate font-medium text-foreground">{title}</div>
          {badge}
        </div>
        {subtitle && <div className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</div>}
        {meta && <div className="mt-1.5 text-xs text-muted-foreground">{meta}</div>}
      </div>
      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" />
    </>
  );

  const classes = cn(
    "flex min-h-[3.25rem] w-full items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 text-left transition-colors active:bg-muted/60",
    className,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.03, 0.3), ease }}
    >
      {href ? (
        <Link to={href} className={classes}>
          {content}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={classes}>
          {content}
        </button>
      )}
    </motion.div>
  );
}
