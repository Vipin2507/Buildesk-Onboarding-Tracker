import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";

import { TICKET_EASE } from "@/components/design-ticket/design-ticket-shared";
import { cn } from "@/lib/utils";

const CRM_TICKET_TABS = [
  { to: "/crm/tickets", label: "All Tickets", exact: true },
  { to: "/crm/tickets/links", label: "Portal Links", exact: false },
] as const;

export function CrmTicketsNav({
  compact,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <motion.nav
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: TICKET_EASE }}
      className={cn(
        "flex gap-0.5 overflow-x-auto rounded-lg border bg-muted/30 p-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        compact ? "mb-0 mt-2" : "mb-5",
        className,
      )}
    >
      {CRM_TICKET_TABS.map((tab) => {
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
