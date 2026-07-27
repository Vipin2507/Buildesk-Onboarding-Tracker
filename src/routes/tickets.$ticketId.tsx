import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Building2, History } from "lucide-react";
import { toast } from "sonner";

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
  InternalTicketsNav,
  ticketPageVariants,
  ticketSectionVariants,
} from "@/components/design-ticket/design-ticket-shared";
import { PageWrap } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EntityNotFound } from "@/components/empty-state";
import { getDesignTicket } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import {
  useCompanyStore,
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

export const Route = createFileRoute("/tickets/$ticketId")({
  component: InternalTicketDetail,
});

function InternalTicketDetail() {
  const { ticketId } = Route.useParams();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const ticket = useDesignTicketStore((s) => s.getById(ticketId));
  const mergeTicket = useDesignTicketStore((s) => s.mergeTicket);
  const addMessage = useDesignTicketStore((s) => s.addMessage);
  const updateStatus = useDesignTicketStore((s) => s.updateStatus);
  const updatePriority = useDesignTicketStore((s) => s.updatePriority);
  const assignTicket = useDesignTicketStore((s) => s.assignTicket);
  const companies = useCompanyStore((s) => s.companies);
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
        if (!cancelled) mergeTicket(row);
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
        <InternalTicketsNav />
        <DesignTicketDetailSkeleton />
      </PageWrap>
    );
  }

  if (notFound || !ticket) {
    return <EntityNotFound entity="Ticket" listPath="/tickets" listLabel="Ticket Tracking" />;
  }

  const company = companies.find((c) => c.id === ticket.companyId);
  const statusHistory = ticket.messages.filter((m) => m.kind === "system");

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
      <InternalTicketsNav />

      <motion.div variants={ticketPageVariants} initial="hidden" animate="show" className="space-y-4">
        <motion.div variants={ticketSectionVariants}>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 gap-1.5 text-muted-foreground"
            onClick={() => void navigate({ to: "/tickets" })}
          >
            <ArrowLeft className="h-4 w-4" />
            All Tickets
          </Button>
        </motion.div>

        <motion.header variants={ticketSectionVariants} className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
                <span className="text-primary">{ticket.ticketNumber}</span>
                <span className="text-muted-foreground"> — </span>
                {ticket.subject}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  {company?.name ?? "Unknown company"}
                </span>
                {company ? (
                  <Link
                    to="/companies/$companyId"
                    params={{ companyId: company.id }}
                    className="text-primary hover:underline"
                  >
                    View company
                  </Link>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <DesignTicketStatusPill status={ticket.status} />
              <DesignTicketPriorityChip priority={ticket.priority} />
            </div>
          </div>
        </motion.header>

        <motion.div
          variants={ticketSectionVariants}
          className="card-soft grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <DesignTicketFilterField label="Status">
            <DesignTicketSelect
              value={ticket.status}
              onChange={(value) => {
                updateStatus(ticketId, value as DesignTicketStatus, actorName);
                toast.success("Status updated");
              }}
              options={statusOptions}
            />
          </DesignTicketFilterField>
          <DesignTicketFilterField label="Priority">
            <DesignTicketSelect
              value={ticket.priority}
              onChange={(value) => {
                updatePriority(ticketId, value as DesignTicketPriority, actorName);
                toast.success("Priority updated");
              }}
              options={priorityOptions}
            />
          </DesignTicketFilterField>
          <DesignTicketFilterField label="Assignee" className="sm:col-span-2 lg:col-span-1">
            <DesignTicketSelect
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
        </motion.div>

        <motion.div variants={ticketSectionVariants} className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="card-soft min-h-0 p-3 sm:p-4">
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

          <aside className="card-soft space-y-4 p-4 text-sm lg:sticky lg:top-20 lg:self-start">
            <MetaRow label="Created by" value={`${ticket.createdBy.name} (${ticket.createdBy.type})`} />
            <MetaRow label="Created on" value={formatDate(ticket.createdAt)} />
            <MetaRow label="Category" value={ticket.category ?? "—"} />
            <MetaRow label="Last updated" value={formatDate(ticket.updatedAt)} />

            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <History className="h-3.5 w-3.5" />
                Status history
              </div>
              {statusHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground">No status changes yet.</p>
              ) : (
                <ol className="max-h-52 space-y-2 overflow-y-auto text-xs">
                  {statusHistory
                    .slice()
                    .reverse()
                    .map((m) => (
                      <li key={m.id} className="rounded-lg border border-border/80 bg-muted/20 px-2.5 py-2">
                        <div className="font-medium text-foreground">{m.message}</div>
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

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium text-foreground">{value}</div>
    </div>
  );
}
