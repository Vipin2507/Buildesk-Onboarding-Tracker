import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Building2, Copy } from "lucide-react";
import { toast } from "sonner";

import { CrmTicketsNav } from "@/components/crm/crm-tickets-nav";
import { CrmTicketDetailMeta } from "@/components/crm/tickets/crm-ticket-detail-meta";
import {
  daysOpenForTicket,
  formatDaysOpen,
  isTicketAging,
  TICKET_AGING_DAYS,
} from "@/components/crm/tickets/crm-tickets-format";
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
  TICKET_EASE,
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

  const assigneeOptions = useMemo(() => {
    const fromUsers = users.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name }));
    const seen = new Set(fromUsers.map((u) => u.id));
    const fromEmployees = employees
      .filter((e) => !seen.has(e.id))
      .map((e) => ({ id: e.id, name: e.name }));
    return [...fromUsers, ...fromEmployees].sort((a, b) => a.name.localeCompare(b.name));
  }, [users, employees]);

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

  const current = ticket;
  const account = accounts.find((a) => a.id === current.companyId);
  const accountLabel = account?.name ?? crmAccountName(current.companyId);
  const assigneeName =
    assigneeOptions.find((o) => o.id === current.assigneeId)?.name ?? "Unassigned";
  const daysOpen = daysOpenForTicket(current);
  const aging = isTicketAging(current, daysOpen);

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

  function copyTicketId() {
    void navigator.clipboard.writeText(current.ticketNumber);
    toast.success("Ticket ID copied");
  }

  return (
    <PageWrap>
      <CrmTicketsNav />

      <motion.div variants={ticketPageVariants} initial="hidden" animate="show" className="space-y-3 pb-4">
        <motion.div variants={ticketSectionVariants}>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-8 gap-1.5 px-2 text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary"
            onClick={() => void navigate({ to: "/crm/tickets" })}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to All Tickets
          </Button>
        </motion.div>

        <motion.section
          variants={ticketSectionVariants}
          className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm"
        >
          <div className="bg-gradient-to-br from-primary/[0.07] via-sky-500/[0.04] to-transparent p-3.5 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={copyTicketId}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-primary transition hover:bg-primary/15"
                    title="Copy ticket ID"
                  >
                    {current.ticketNumber}
                    <Copy className="h-3 w-3 opacity-70" />
                  </button>
                  <DesignTicketStatusPill status={current.status} />
                  <DesignTicketPriorityChip priority={current.priority} />
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-[10px] font-semibold",
                      aging
                        ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                    )}
                  >
                    {aging
                      ? `Aging · ${formatDaysOpen(daysOpen)}`
                      : `On track · ${formatDaysOpen(daysOpen)}`}
                  </span>
                </div>

                <h1 className="text-lg font-semibold leading-snug tracking-tight text-foreground sm:text-xl">
                  {current.subject}
                </h1>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    <Link
                      to="/crm/accounts/$accountId"
                      params={{ accountId: current.companyId }}
                      className="truncate font-medium text-primary hover:underline"
                    >
                      {accountLabel}
                    </Link>
                  </span>
                  <span className="text-border">·</span>
                  <span>Updated {formatDate(current.updatedAt)}</span>
                  {aging ? (
                    <>
                      <span className="text-border">·</span>
                      <span className="text-rose-600 dark:text-rose-400">
                        Open ≥ {TICKET_AGING_DAYS} days
                      </span>
                    </>
                  ) : null}
                </div>

                {current.description?.trim() ? (
                  <motion.p
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, ease: TICKET_EASE }}
                    className="max-w-3xl whitespace-pre-wrap rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-xs leading-relaxed text-foreground/85"
                  >
                    {current.description.trim()}
                  </motion.p>
                ) : null}
              </div>

              <div className="grid w-full gap-2 rounded-xl border border-border/70 bg-background/80 p-2.5 shadow-sm backdrop-blur-sm sm:grid-cols-3 lg:w-auto lg:min-w-[24rem] lg:shrink-0">
                <DesignTicketFilterField label="Status" compact>
                  <DesignTicketSelect
                    compact
                    value={current.status}
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
                    value={current.priority}
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
                    value={current.assigneeId ?? UNASSIGNED}
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
          </div>
        </motion.section>

        <motion.div
          variants={ticketSectionVariants}
          className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,300px)]"
        >
          <div className="flex min-h-0 min-w-0 flex-col">
            <DesignTicketThread
              ticket={current}
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

          <CrmTicketDetailMeta ticket={current} assigneeName={assigneeName} />
        </motion.div>
      </motion.div>
    </PageWrap>
  );
}
