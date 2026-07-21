import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { DesignTicketThread } from "@/components/design-ticket/design-ticket-thread";
import {
  DesignTicketPriorityChip,
  DesignTicketStatusPill,
  DESIGN_TICKET_PRIORITIES,
  DESIGN_TICKET_STATUSES,
} from "@/components/design-ticket/design-ticket-chips";
import { PageHeader, PageWrap } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EntityNotFound } from "@/components/empty-state";
import { formatDate } from "@/lib/utils";
import {
  useCompanyStore,
  useCurrentUser,
  useEmployeeStore,
  useUserStore,
} from "@/stores";
import { useDesignTicketStore } from "@/stores/useDesignTicketStore";
import type { DesignTicketPriority, DesignTicketStatus } from "@/types/design-ticket";

export const Route = createFileRoute("/tickets/$ticketId")({
  component: InternalTicketDetail,
});

function InternalTicketDetail() {
  const { ticketId } = Route.useParams();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const ticket = useDesignTicketStore((s) => s.getById(ticketId));
  const addMessage = useDesignTicketStore((s) => s.addMessage);
  const updateStatus = useDesignTicketStore((s) => s.updateStatus);
  const updatePriority = useDesignTicketStore((s) => s.updatePriority);
  const assignTicket = useDesignTicketStore((s) => s.assignTicket);
  const companies = useCompanyStore((s) => s.companies);
  const employees = useEmployeeStore((s) => s.employees);
  const users = useUserStore((s) => s.users);

  const actorName = currentUser?.name ?? "Team";

  if (!ticket) {
    return <EntityNotFound entity="Ticket" listPath="/tickets" listLabel="Ticket Tracking" />;
  }

  const company = companies.find((c) => c.id === ticket.companyId);
  const assigneeOptions = [
    ...users.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name })),
    ...employees.map((e) => ({ id: e.id, name: e.name })),
  ];

  const statusHistory = ticket.messages.filter((m) => m.kind === "system");

  return (
    <PageWrap>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 mb-3 gap-1.5 text-muted-foreground"
        onClick={() => void navigate({ to: "/tickets" })}
      >
        <ArrowLeft className="h-4 w-4" />
        Ticket Tracking
      </Button>

      <PageHeader
        title={`${ticket.ticketNumber} — ${ticket.subject}`}
        subtitle={company?.name ?? "Unknown company"}
      />
      {company ? (
        <p className="-mt-4 mb-4 text-sm">
          <Link
            to="/companies/$companyId"
            params={{ companyId: company.id }}
            className="text-primary hover:underline"
          >
            View company profile
          </Link>
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-sm">
          Status
          <select
            value={ticket.status}
            onChange={(e) => {
              updateStatus(ticketId, e.target.value as DesignTicketStatus, actorName);
              toast.success("Status updated");
            }}
            className="h-9 rounded-md border bg-card px-2 text-sm"
          >
            {DESIGN_TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          Priority
          <select
            value={ticket.priority}
            onChange={(e) => {
              updatePriority(ticketId, e.target.value as DesignTicketPriority, actorName);
              toast.success("Priority updated");
            }}
            className="h-9 rounded-md border bg-card px-2 text-sm"
          >
            {DESIGN_TICKET_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          Assignee
          <select
            value={ticket.assigneeId ?? ""}
            onChange={(e) => {
              const id = e.target.value || undefined;
              const name = assigneeOptions.find((o) => o.id === id)?.name ?? "Unassigned";
              assignTicket(ticketId, id, name, actorName);
              toast.success("Assignee updated");
            }}
            className="h-9 min-w-[160px] rounded-md border bg-card px-2 text-sm"
          >
            <option value="">Unassigned</option>
            {assigneeOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <DesignTicketStatusPill status={ticket.status} />
        <DesignTicketPriorityChip priority={ticket.priority} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="card-soft p-4">
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

        <aside className="card-soft space-y-4 p-4 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Created by</div>
            <div className="font-medium">
              {ticket.createdBy.name} ({ticket.createdBy.type})
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Created on</div>
            <div>{formatDate(ticket.createdAt)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Category</div>
            <div>{ticket.category ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Last updated</div>
            <div>{formatDate(ticket.updatedAt)}</div>
          </div>
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Status history
            </div>
            {statusHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground">No status changes yet.</p>
            ) : (
              <ol className="space-y-2 text-xs">
                {statusHistory
                  .slice()
                  .reverse()
                  .map((m) => (
                    <li key={m.id} className="rounded border px-2 py-1.5">
                      {m.message}
                      <div className="text-muted-foreground">{formatDate(m.createdAt)}</div>
                    </li>
                  ))}
              </ol>
            )}
          </div>
        </aside>
      </div>
    </PageWrap>
  );
}
