import { motion } from "framer-motion";
import {
  CalendarClock,
  FolderKanban,
  History,
  Tag,
  UserRound,
  UserRoundPen,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  daysOpenForTicket,
  formatDaysOpen,
  isTicketAging,
  personInitials,
  ticketCategoryStyle,
  TICKET_AGING_DAYS,
} from "@/components/crm/tickets/crm-tickets-format";
import { TICKET_EASE } from "@/components/design-ticket/design-ticket-shared";
import { cn, formatDate } from "@/lib/utils";
import type { DesignTicket } from "@/types/design-ticket";

export function CrmTicketDetailMeta({
  ticket,
  assigneeName,
}: {
  ticket: DesignTicket;
  assigneeName: string;
}) {
  const daysOpen = daysOpenForTicket(ticket);
  const aging = isTicketAging(ticket, daysOpen);
  const categoryStyle = ticketCategoryStyle(ticket.category);
  const activity = ticket.messages
    .filter((m) => m.kind === "system")
    .slice()
    .reverse();

  return (
    <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: TICKET_EASE }}
        className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm"
      >
        <div className="border-b border-border/70 bg-gradient-to-r from-primary/[0.06] to-transparent px-3.5 py-2.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Details
          </h2>
        </div>
        <dl className="divide-y divide-border/60">
          <MetaRow
            icon={UserRoundPen}
            label="Created by"
            value={ticket.createdBy.name}
            hint={ticket.createdBy.type === "client" ? "Client" : "Team"}
          />
          <MetaRow icon={CalendarClock} label="Created" value={formatDate(ticket.createdAt)} />
          <MetaRow
            icon={Tag}
            label="Category"
            value={
              <span
                className={cn(
                  "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  categoryStyle.bg,
                )}
              >
                {ticket.category?.trim() || "Uncategorized"}
              </span>
            }
          />
          <MetaRow
            icon={UserRound}
            label="Assignee"
            value={
              <span className="inline-flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[9px] font-semibold text-primary">
                  {personInitials(assigneeName === "Unassigned" ? "?" : assigneeName)}
                </span>
                <span className="truncate">{assigneeName}</span>
              </span>
            }
          />
          <MetaRow
            icon={FolderKanban}
            label="Days open"
            value={
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  aging ? "text-rose-600 dark:text-rose-400" : undefined,
                )}
              >
                {formatDaysOpen(daysOpen)}
              </span>
            }
            hint={aging ? `Aging ≥ ${TICKET_AGING_DAYS}d` : `Target < ${TICKET_AGING_DAYS}d`}
          />
          <MetaRow icon={CalendarClock} label="Updated" value={formatDate(ticket.updatedAt)} />
        </dl>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.06, ease: TICKET_EASE }}
        className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm"
      >
        <div className="flex items-center gap-1.5 border-b border-border/70 bg-gradient-to-r from-violet-500/[0.06] to-transparent px-3.5 py-2.5">
          <History className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Status history
          </h2>
        </div>
        <div className="px-3.5 py-3">
          {activity.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No status changes yet.</p>
          ) : (
            <ol className="relative max-h-64 space-y-0 overflow-y-auto border-l border-border/80 pl-3">
              {activity.map((m, index) => (
                <li key={m.id} className="relative pb-3 last:pb-0">
                  <span
                    className={cn(
                      "absolute -left-[0.97rem] top-1.5 h-2 w-2 rounded-full ring-2 ring-card",
                      index === 0 ? "bg-primary" : "bg-muted-foreground/40",
                    )}
                  />
                  <div className="rounded-lg border border-border/70 bg-muted/20 px-2.5 py-1.5 text-[11px] transition-colors hover:bg-muted/35">
                    <div className="font-medium leading-snug text-foreground">{m.message}</div>
                    <div className="mt-0.5 text-muted-foreground">{formatDate(m.createdAt)}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </motion.section>
    </aside>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-3.5 py-2.5">
      <dt className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
        <span>{label}</span>
      </dt>
      <dd className="min-w-0 text-right text-xs font-medium text-foreground">
        <div className="break-words">{value}</div>
        {hint ? (
          <span className="mt-0.5 block text-[10px] font-normal capitalize text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </dd>
    </div>
  );
}
