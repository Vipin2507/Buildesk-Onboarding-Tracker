import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { CountUp } from "@/components/count-up";
import { cn } from "@/lib/utils";

export const TICKET_EASE = [0.22, 1, 0.36, 1] as const;

export const ticketFieldClass =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-primary/25";

export const ticketSelectClass =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-primary/25";

export const ticketTextareaClass =
  "w-full resize-none rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-primary/25";

type KpiItem = {
  label: string;
  value: number;
  tone?: string;
  icon?: LucideIcon;
};

export function DesignTicketKpiGrid({ items, columns = 4 }: { items: KpiItem[]; columns?: 2 | 3 | 4 | 5 }) {
  const colClass =
    columns === 5
      ? "sm:grid-cols-2 lg:grid-cols-5"
      : columns === 3
        ? "sm:grid-cols-3"
        : columns === 2
          ? "sm:grid-cols-2"
          : "sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div className={cn("grid grid-cols-2 gap-2.5 sm:gap-3", colClass)}>
      {items.map((k, i) => {
        const Icon = k.icon;
        return (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: Math.min(i * 0.05, 0.25), ease: TICKET_EASE }}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            className="card-soft group p-3.5 sm:p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
                {k.label}
              </div>
              {Icon ? (
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-primary" />
              ) : null}
            </div>
            <div className={cn("mt-1.5 text-xl font-semibold tabular-nums sm:text-2xl", k.tone)}>
              <CountUp to={k.value} />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export function DesignTicketPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: TICKET_EASE }}
      className="mb-5 flex flex-col gap-3 sm:mb-6 md:flex-row md:flex-wrap md:items-end md:justify-between"
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </motion.div>
  );
}

export function DesignTicketSection({
  title,
  action,
  children,
  className,
  delay = 0,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: TICKET_EASE }}
      className={cn("space-y-3", className)}
    >
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {title ? <h2 className="text-sm font-semibold">{title}</h2> : <span />}
          {action}
        </div>
      )}
      {children}
    </motion.section>
  );
}

export function DesignTicketInfoBanner({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, delay: 0.15, ease: TICKET_EASE }}
      className="rounded-xl border border-info/30 bg-info/5 px-4 py-3 text-center text-xs text-muted-foreground sm:text-sm"
    >
      {children}
    </motion.div>
  );
}

const INTERNAL_TABS = [
  { to: "/tickets", label: "All Tickets", exact: true },
  { to: "/tickets/links", label: "Portal Links", exact: false },
] as const;

export function InternalTicketsNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <motion.nav
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: TICKET_EASE }}
      className="mb-5 flex gap-1 overflow-x-auto rounded-xl border bg-muted/30 p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {INTERNAL_TABS.map((tab) => {
        const active = tab.exact ? pathname === tab.to : pathname.startsWith(tab.to);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              "shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-300",
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
      className="p-4 pb-24 md:p-6 md:pb-8 lg:p-8"
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
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}
