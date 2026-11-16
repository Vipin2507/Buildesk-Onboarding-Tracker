import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Headset,
  Loader2,
  type LucideIcon,
} from "lucide-react";

import { CountUp } from "@/components/count-up";
import {
  TICKET_AGING_DAYS,
  type TicketKpiFilter,
} from "@/components/crm/tickets/crm-tickets-format";
import { TICKET_EASE } from "@/components/design-ticket/design-ticket-shared";
import { cn } from "@/lib/utils";

export type TicketKpiCounts = Record<TicketKpiFilter, number>;

const CARDS: {
  id: TicketKpiFilter;
  label: string;
  hint: string;
  icon: LucideIcon;
  iconWrap: string;
  valueTone: string;
  activeRing: string;
}[] = [
  {
    id: "all",
    label: "Total Tickets",
    hint: "All portal tickets",
    icon: Headset,
    iconWrap: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    valueTone: "text-sky-700 dark:text-sky-300",
    activeRing: "border-sky-500/40 ring-sky-500/20",
  },
  {
    id: "open",
    label: "Open",
    hint: "Awaiting pickup",
    icon: CircleDot,
    iconWrap: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    valueTone: "text-rose-700 dark:text-rose-300",
    activeRing: "border-rose-500/40 ring-rose-500/20",
  },
  {
    id: "in-progress",
    label: "In Progress",
    hint: "Being worked",
    icon: Loader2,
    iconWrap: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    valueTone: "text-amber-700 dark:text-amber-300",
    activeRing: "border-amber-500/40 ring-amber-500/20",
  },
  {
    id: "resolved",
    label: "Resolved",
    hint: "Resolved + closed",
    icon: CheckCircle2,
    iconWrap: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    valueTone: "text-emerald-700 dark:text-emerald-300",
    activeRing: "border-emerald-500/40 ring-emerald-500/20",
  },
  {
    id: "aging",
    label: "Aging",
    hint: `Active ≥ ${TICKET_AGING_DAYS} days`,
    icon: AlertTriangle,
    iconWrap: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    valueTone: "text-violet-700 dark:text-violet-300",
    activeRing: "border-violet-500/40 ring-violet-500/20",
  },
];

export function CrmTicketsKpiCards({
  counts,
  active,
  onSelect,
}: {
  counts: TicketKpiCounts;
  active: TicketKpiFilter;
  onSelect: (id: TicketKpiFilter) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Ticket KPI filters"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5"
    >
      {CARDS.map((card, index) => {
        const Icon = card.icon;
        const selected = active === card.id;
        return (
          <motion.button
            key={card.id}
            type="button"
            role="tab"
            aria-selected={selected}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: index * 0.05, ease: TICKET_EASE }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(card.id)}
            className={cn(
              "group relative flex min-h-[4.5rem] items-center gap-3 overflow-hidden rounded-xl border bg-card px-3 py-2.5 text-left shadow-sm transition-shadow",
              "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              selected
                ? cn("ring-1 shadow-md", card.activeRing)
                : "border-border/80 hover:border-primary/25",
            )}
          >
            <span
              className={cn(
                "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100",
                "bg-gradient-to-br from-transparent via-transparent to-primary/[0.04]",
              )}
            />
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-105",
                card.iconWrap,
              )}
            >
              <Icon className={cn("h-4 w-4", card.id === "in-progress" && selected && "animate-spin")} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {card.label}
              </div>
              <div className={cn("mt-0.5 text-xl font-semibold tabular-nums leading-none", card.valueTone)}>
                <CountUp to={counts[card.id]} duration={0.85} />
              </div>
              <div className="mt-1 truncate text-[10px] text-muted-foreground">{card.hint}</div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
