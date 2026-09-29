import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Building2, History } from "lucide-react";
import { toast } from "sonner";

import { CrmTicketsNav } from "@/components/crm/crm-tickets-nav";
import { DesignTicketThread } from "@/components/design-ticket/design-ticket-thread";
import {
  DesignTicketPriorityChip,
  DesignTicketStatusPill,
  DESIGN_TICKET_PRIORITIES,
  DESIGN_TICKET_STATUSES,
} from "@/components/design-ticket/design-ticket-chips";
import {
  DesignTicketFilterField,
  DesignTicketSelect,
} from "@/components/design-ticket/design-ticket-fields";
import {
  DesignTicketDetailSkeleton,
  ticketPageVariants,
  ticketSectionVariants,
} from "@/components/design-ticket/design-ticket-shared";
import { EntityNotFound } from "@/components/empty-state";
import { PageWrap } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getDesignTicket } from "@/lib/api";
import { crmAccountName, isCrmDesignTicket } from "@/lib/crm-tickets";
import { cn, formatDate } from "@/lib/utils";
import {
  useCrmAccountStore,
  useCurrentUser,
  useEmployeeStore,
  useUserStore,
} from "@/stores";
import { useDesignTicketStore } from "@/stores/useDesignTicketStore";
import type { DesignTicketPriority, DesignTicketStatus } from "@/types/design-ticket";
import {
  DESIGN_TICKET_PRIORITY_LABEL,
  DESIGN_TICKET_STATUS_LABEL,
} from "@/types/design-ticket";

const UNASSIGNED = "__unassigned__";

export const Route = createFileRoute("/crm/tickets/$ticketId")({
  component: CrmPortalTicketDetail,
});

function CrmPortalTicketDetail() {
  const { ticketId } = Route.useParams();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const ticket = useDesignTicketStore((s) => s.getById(ticketId));
  const mergeTicket = useDesignTicketStore((s) => s.mergeTicket);
  const addMessage = useDesignTicketStore((s) => s.addMessage);
  const updateStatus = useDesignTicketStore((s) => s.updateStatus);
  const updatePriority = useDesignTicketStore((s) => s.updatePriority);
  const assignTicket = useDesignTicketStore((s) => s.assignTicket);
  const accounts = useCrmAccountStore((s) => s.accounts);
  const employees = useEmployeeStore((s) => s.employees);
  const users = useUserStore((s) => s.users);
  const [loading, setLoading] = useState(!ticket);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    void getDesignTicket({ data: { id: ticketId } })
      .then((row) => {
        if (cancelled) return;
        if (!isCrmDesignTicket(row)) {
          setNotFound(true);
          return;
        }
        mergeTicket(row);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticketId, mergeTicket]);

  const actorName = currentUser?.name ?? "Team";

  const assigneeOptions = useMemo(
    () => [
      ...users.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name })),
      ...employees.map((e) => ({ id: e.id, name: e.name })),
    ],
    [users, employees],
  );

  if (loading && !ticket) {
    return (
      <PageWrap>
        <CrmTicketsNav />
        <DesignTicketDetailSkeleton />
      </PageWrap>
    );
  }

  if (notFound || !ticket || !isCrmDesignTicket(ticket)) {
    return (
      <EntityNotFound entity="Ticket" listPath="/crm/tickets" listLabel="CRM Ticket Tracking" />
    );
  }

  const account = accounts.find((a) => a.id === ticket.companyId);
  const accountLabel = account?.name ?? crmAccountName(ticket.companyId);
  const statusHistory = ticket.messages.filter((m) => m.kind === "system");
  const assigneeName =
    assigneeOptions.find((o) => o.id === ticket.assigneeId)?.name ?? "Unassigned";

  const statusOptions = DESIGN_TICKET_STATUSES.map((s) => ({
    value: s,
    label: DESIGN_TICKET_STATUS_LABEL[s],
  }));

  const priorityOptions = DESIGN_TICKET_PRIORITIES.map((p) => ({
    value: p,
    label: DESIGN_TICKET_PRIORITY_LABEL[p],
  }));

  const assigneeSelectOptions = [
    { value: UNASSIGNED, label: "Unassigned" },
    ...assigneeOptions.map((o) => ({ value: o.id, label: o.name })),
  ];

  return (
    <PageWrap>
      <CrmTicketsNav />

      <motion.div variants={ticketPageVariants} initial="hidden" animate="show" className="space-y-3">
        <motion.div variants={ticketSectionVariants}>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-7 gap-1.5 px-2 text-xs text-muted-foreground"
            onClick={() => void navigate({ to: "/crm/tickets" })}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Tickets
          </Button>
        </motion.div>

        {/* Title + account + inline controls */}
        <motion.section
          variants={ticketSectionVariants}
          className="card-soft space-y-3 p-3 sm:p-4"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-primary">
                  {ticket.ticketNumber}
                </span>
                <DesignTicketStatusPill status={ticket.status} />
                <DesignTicketPriorityChip priority={ticket.priority} />
              </div>
              <h1 className="text-base font-semibold leading-snug tracking-tight text-foreground sm:text-lg">
                {ticket.subject}
              </h1>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate font-medium text-foreground/80">{accountLabel}</span>
                </span>
                <span className="text-border">·</span>
                <Link
                  to="/crm/accounts/$accountId"
                  params={{ accountId: ticket.companyId }}
                  className="text-primary hover:underline"
                >
                  View account
                </Link>
                <span className="text-border">·</span>
                <span>Updated {formatDate(ticket.updatedAt)}</span>
              </div>
            </div>

            <div className="grid w-full gap-2 sm:grid-cols-3 lg:w-auto lg:min-w-[22rem] lg:shrink-0">
              <DesignTicketFilterField label="Status" compact>
                <DesignTicketSelect
                  compact
                  value={ticket.status}
                  onChange={(value) => {
                    updateStatus(ticketId, value as DesignTicketStatus, actorName);
                    toast.success("Status updated");
                  }}
                  options={statusOptions}
                />
              </DesignTicketFilterField>
              <DesignTicketFilterField label="Priority" compact>
                <DesignTicketSelect
                  compact
                  value={ticket.priority}
                  onChange={(value) => {
                    updatePriority(ticketId, value as DesignTicketPriority, actorName);
                    toast.success("Priority updated");
                  }}
                  options={priorityOptions}
                />
              </DesignTicketFilterField>
              <DesignTicketFilterField label="Assignee" compact>
                <DesignTicketSelect
                  compact
                  value={ticket.assigneeId ?? UNASSIGNED}
                  onChange={(value) => {
                    const id = value === UNASSIGNED ? undefined : value;
                    const name = assigneeOptions.find((o) => o.id === id)?.name ?? "Unassigned";
                    assignTicket(ticketId, id, name, actorName);
                    toast.success("Assignee updated");
                  }}
                  options={assigneeSelectOptions}
                />
              </DesignTicketFilterField>
            </div>
          </div>
        </motion.section>

        {/* Conversation + meta */}
        <motion.div
          variants={ticketSectionVariants}
          className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]"
        >
          <div className="card-soft flex min-h-0 min-w-0 flex-col p-3">
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-border/70 pb-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Conversation
              </h2>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {ticket.messages.filter((m) => m.kind !== "system").length} messages
              </span>
            </div>
            <DesignTicketThread
              ticket={ticket}
              mode="internal"
              reply={{
                placeholder: "Reply to client…",
                onSend: (message, attachments) => {
                  addMessage(ticketId, {
                    authorType: "team",
                    authorName: actorName,
                    message,
                    attachments,
                  });
                  toast.success("Reply sent");
                },
              }}
            />
          </div>

          <aside className="card-soft space-y-0 overflow-hidden p-0 text-sm lg:sticky lg:top-20 lg:self-start">
            <div className="border-b border-border/70 px-3 py-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Details
              </h2>
            </div>
            <dl className="divide-y divide-border/60">
              <MetaRow label="Created by" value={`${ticket.createdBy.name}`} hint={ticket.createdBy.type} />
              <MetaRow label="Created" value={formatDate(ticket.createdAt)} />
              <MetaRow label="Category" value={ticket.category ?? "—"} />
              <MetaRow label="Assignee" value={assigneeName} />
              <MetaRow label="Updated" value={formatDate(ticket.updatedAt)} />
            </dl>

            <div className="border-t border-border/70 px-3 py-2.5">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <History className="h-3.5 w-3.5" />
                Status history
              </div>
              {statusHistory.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">No status changes yet.</p>
              ) : (
                <ol className="max-h-44 space-y-1.5 overflow-y-auto">
                  {statusHistory
                    .slice()
                    .reverse()
                    .map((m) => (
                      <li
                        key={m.id}
                        className="rounded-md border border-border/70 bg-muted/25 px-2 py-1.5 text-[11px]"
                      >
                        <div className="font-medium leading-snug text-foreground">{m.message}</div>
                        <div className="mt-0.5 text-muted-foreground">{formatDate(m.createdAt)}</div>
                      </li>
                    ))}
                </ol>
              )}
            </div>
          </aside>
        </motion.div>
      </motion.div>
    </PageWrap>
  );
}

function MetaRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2">
      <dt className="shrink-0 text-[11px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-xs font-medium text-foreground">
        <span className={cn("break-words")}>{value}</span>
        {hint ? (
          <span className="mt-0.5 block text-[10px] font-normal capitalize text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </dd>
    </div>
  );
}
