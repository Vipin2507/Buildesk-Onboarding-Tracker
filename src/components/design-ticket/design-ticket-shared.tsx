import { Link, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { ChevronDown, ListFilter, RotateCcw, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { CountUp } from "@/components/count-up";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const TICKET_EASE = [0.22, 1, 0.36, 1] as const;

/** Staggered page entrance — use on ticket list/detail roots */
export const ticketPageVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.02 },
  },
};

export const ticketSectionVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: TICKET_EASE },
  },
};

export { ticketFieldControl } from "@/components/design-ticket/design-ticket-fields";

export const ticketFieldClass =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-primary/25 dark:bg-muted/40";

export const ticketSelectClass =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-primary/25 dark:bg-muted/40 appearance-none";

export const ticketTextareaClass =
  "w-full resize-none rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-primary/25";

export type TicketKpiItem = {
  id: string;
  label: string;
  value: number;
  tone?: string;
  icon?: LucideIcon;
  onClick?: () => void;
  active?: boolean;
};

export function DesignTicketKpiGrid({
  items,
  columns = 4,
  size = "default",
}: {
  items: TicketKpiItem[];
  columns?: 2 | 3 | 4 | 5 | 6;
  /** Compact horizontal stat chips for dense admin lists */
  size?: "default" | "compact";
}) {
  const colClass =
    columns === 6
      ? size === "compact"
        ? "sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-6"
        : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      : columns === 5
        ? size === "compact"
          ? "sm:grid-cols-3 lg:grid-cols-5"
          : "sm:grid-cols-2 lg:grid-cols-5"
        : columns === 3
          ? "sm:grid-cols-3"
          : columns === 2
            ? "sm:grid-cols-2"
            : size === "compact"
              ? "sm:grid-cols-2 md:grid-cols-4"
              : "sm:grid-cols-2 lg:grid-cols-4";

  const gapClass = size === "compact" ? "gap-1.5" : "gap-2.5 sm:gap-3";

  return (
    <div className={cn("grid min-w-0 grid-cols-2", gapClass, colClass)}>
      {items.map((k, i) => {
        const Icon = k.icon;
        const clickable = Boolean(k.onClick);
        const Wrapper = clickable ? "button" : "div";
        return (
          <motion.div
            key={k.id}
            initial={{ opacity: 0, y: size === "compact" ? 6 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.2), ease: TICKET_EASE }}
            whileHover={clickable ? { y: -1, transition: { duration: 0.15 } } : undefined}
            className="min-w-0 h-full"
          >
            <Wrapper
              type={clickable ? "button" : undefined}
              onClick={k.onClick}
              className={cn(
                size === "compact"
                  ? "flex h-full w-full min-w-0 flex-col gap-1 rounded-lg border border-border/80 bg-card px-2.5 py-2 text-left shadow-sm transition-all sm:flex-row sm:items-center sm:justify-between sm:gap-2"
                  : "card-soft group h-full w-full p-3.5 text-left transition-all sm:p-4",
                clickable &&
                  "cursor-pointer hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                k.active && "border-primary/40 bg-primary/5 ring-1 ring-primary/20",
              )}
            >
              {size === "compact" ? (
                <>
                  <div className="flex min-w-0 items-center gap-1.5">
                    {Icon ? (
                      <Icon
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 text-muted-foreground/70",
                          k.active && "text-primary",
                        )}
                      />
                    ) : null}
                    <span className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {k.label}
                    </span>
                  </div>
                  <span className={cn("shrink-0 text-base font-semibold tabular-nums leading-none", k.tone)}>
                    <CountUp to={k.value} />
                  </span>
                </>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
                      {k.label}
                    </div>
                    {Icon ? (
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-primary",
                          k.active && "text-primary",
                        )}
                      />
                    ) : null}
                  </div>
                  <div className={cn("mt-1.5 text-xl font-semibold tabular-nums sm:text-2xl", k.tone)}>
                    <CountUp to={k.value} />
                  </div>
                  {clickable ? (
                    <div className="mt-1 text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                      Click to filter
                    </div>
                  ) : null}
                </>
              )}
            </Wrapper>
          </motion.div>
        );
      })}
    </div>
  );
}

export function DesignTicketPageHeader({
  title,
  subtitle: _subtitle,
  actions,
  compact = true,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  compact?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: TICKET_EASE }}
      className={cn(
        "flex max-w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between md:items-center",
        compact ? "mb-3" : "mb-5 sm:mb-6 md:items-end",
      )}
    >
      <div className="min-w-0 flex-1">
        <h1
          className={cn(
            "font-semibold tracking-tight break-words",
            compact ? "text-base sm:text-lg" : "text-xl sm:text-2xl",
          )}
        >
          {title}
        </h1>
      </div>
      {actions ? (
        <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end">
          {actions}
        </div>
      ) : null}
    </motion.div>
  );
}

export function DesignTicketSection({
  title,
  action,
  children,
  className,
  delay = 0,
  compact,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  delay?: number;
  compact?: boolean;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: TICKET_EASE }}
      className={cn(compact ? "space-y-2" : "space-y-3", className)}
    >
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {title ? (
            <h2 className={cn("font-semibold", compact ? "text-xs text-muted-foreground" : "text-sm")}>
              {title}
            </h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
      {children}
    </motion.section>
  );
}

export function DesignTicketInfoBanner({
  children,
  compact,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, delay: 0.15, ease: TICKET_EASE }}
      className={cn(
        "rounded-lg border border-info/30 bg-info/5 text-center text-muted-foreground",
        compact ? "px-3 py-2 text-[11px]" : "rounded-xl px-4 py-3 text-xs sm:text-sm",
      )}
    >
      {children}
    </motion.div>
  );
}

/** Shared pill-style tab row for Support Desk / Ticket Tracking */
export function DesignTicketTabNav({
  tabs,
  activeId,
  onChange,
  compact,
}: {
  tabs: { id: string; label: string; icon?: LucideIcon }[];
  activeId: string;
  onChange: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <motion.nav
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: TICKET_EASE }}
      className={cn(
        "flex w-full max-w-full gap-0.5 overflow-x-auto overscroll-x-contain rounded-lg border bg-muted/30 p-0.5 touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        compact ? "mb-3" : "mb-5",
      )}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeId === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex shrink-0 snap-start items-center gap-1 rounded-md font-medium transition-all duration-200",
              compact ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
            )}
          >
            {Icon ? <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} /> : null}
            <span className="whitespace-nowrap">{tab.label}</span>
          </button>
        );
      })}
    </motion.nav>
  );
}

/** Filter toolbar with collapsible panel — matches Companies list toolbar behavior */
export function DesignTicketFilterBar({
  children,
  className,
  compact,
  activeFilterCount = 0,
  onClear,
  onApply,
  applyLabel = "Apply Filters",
  resultCount,
  resultLabel = "tickets",
  defaultFiltersOpen = false,
}: {
  children: ReactNode;
  className?: string;
  compact?: boolean;
  activeFilterCount?: number;
  onClear?: () => void;
  onApply?: () => void;
  applyLabel?: string;
  resultCount?: number;
  resultLabel?: string;
  defaultFiltersOpen?: boolean;
}) {
  const [filtersOpen, setFiltersOpen] = useState(defaultFiltersOpen);

  return (
    <motion.div
      variants={ticketSectionVariants}
      initial="hidden"
      animate="show"
      className={cn("card-soft mb-3", compact ? "p-2.5" : "p-3 sm:p-4")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "gap-1.5 border-input bg-card dark:bg-muted/40 dark:hover:bg-muted/55",
            compact ? "h-8 text-xs" : "h-9",
            filtersOpen && "border-primary/40 bg-primary/10 text-primary dark:bg-primary/15",
          )}
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <ListFilter className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          Filters
          {activeFilterCount > 0 ? (
            <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {activeFilterCount}
            </span>
          ) : null}
          <ChevronDown
            className={cn(
              "opacity-70 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              compact ? "h-3 w-3" : "h-3.5 w-3.5",
              filtersOpen && "rotate-180",
            )}
          />
        </Button>

        <div className="flex flex-wrap items-center gap-1.5">
          <AnimatePresence>
            {activeFilterCount > 0 && onClear ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.2, ease: TICKET_EASE }}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "gap-1.5 text-muted-foreground hover:text-foreground",
                    compact ? "h-8 text-xs" : "h-9",
                  )}
                  onClick={onClear}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Clear
                </Button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity,margin] duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
          filtersOpen
            ? "mt-2.5 grid-rows-[1fr] opacity-100"
            : "pointer-events-none mt-0 grid-rows-[0fr] opacity-0",
        )}
        aria-hidden={!filtersOpen}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={cn(
              "border-t border-border/70 pt-2.5 transition-[transform,opacity] duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
              filtersOpen ? "translate-y-0 opacity-100" : "-translate-y-1.5 opacity-0",
            )}
          >
            <div
              className={cn(
                "grid gap-2 sm:grid-cols-2 lg:grid-cols-3",
                className,
              )}
            >
              {children}
            </div>
            {onApply ? (
              <div className="mt-2.5 flex justify-stretch sm:justify-end">
                <Button
                  type="button"
                  size="sm"
                  className={cn("w-full sm:w-auto", compact && "h-8 text-xs")}
                  onClick={onApply}
                >
                  {applyLabel}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {typeof resultCount === "number" ? (
        <div className="mt-2.5 flex items-center border-t border-border/70 pt-2 text-[11px] text-muted-foreground">
          <motion.span
            key={resultCount}
            initial={{ opacity: 0.4, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: TICKET_EASE }}
            className="tabular-nums"
          >
            {resultCount} {resultLabel}
          </motion.span>
        </div>
      ) : null}
    </motion.div>
  );
}

const INTERNAL_TABS = [
  { to: "/tickets", label: "All Tickets", exact: true },
  { to: "/tickets/links", label: "Portal Links", exact: false },
] as const;

export function InternalTicketsNav({ compact }: { compact?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <motion.nav
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: TICKET_EASE }}
      className={cn(
        "flex gap-0.5 overflow-x-auto rounded-lg border bg-muted/30 p-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        compact ? "mb-3" : "mb-5",
      )}
    >
      {INTERNAL_TABS.map((tab) => {
        const active = tab.exact ? pathname === tab.to : pathname.startsWith(tab.to);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              "shrink-0 rounded-md font-medium transition-all duration-200",
              compact ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </motion.nav>
  );
}

/** Extra bottom padding on mobile for portal bottom nav. */
export function PortalPageWrap({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: TICKET_EASE }}
      className="p-3 pb-24 md:p-4 md:pb-8 lg:p-5"
    >
      {children}
    </motion.div>
  );
}

export function DesignTicketFormCard({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: TICKET_EASE }}
      className="card-soft mx-auto w-full max-w-2xl space-y-4 p-4 sm:p-6"
    >
      {children}
    </motion.div>
  );
}

export function DesignTicketFormField({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="block space-y-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {hint ? <p className="text-[10px] leading-snug text-muted-foreground">{hint}</p> : null}
      {children}
      {error ? <p className="text-[10px] text-destructive">{error}</p> : null}
    </div>
  );
}

export function DesignTicketDetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Skeleton className="h-[420px] rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
