import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/entity-form-modal";
import { EntityNotFound } from "@/components/empty-state";
import { DetailPageSkeleton } from "@/components/loading-skeleton";
import { PageWrap } from "@/components/page-header";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  DesignTicketPageHeader,
  DesignTicketSection,
} from "@/components/design-ticket/design-ticket-shared";
import { TICKET_KANBAN_COLUMNS } from "@/data/constants";
import { useDetailLoading } from "@/hooks/use-detail-loading";
import { CRM_TICKET_PROJECT_ID, isCrmTicket } from "@/lib/crm-tickets";
import { SUPPORT_PRIORITIES, SUPPORT_TYPES } from "@/lib/support-tracking";
import { formatDate } from "@/lib/utils";
import {
  useCrmAccountStore,
  useTicketStore,
  useUserStore,
} from "@/stores";
import type { TicketPriority, TicketStatus, TicketType } from "@/types";

export const Route = createFileRoute("/crm/support/$ticketId")({
  component: CrmSupportTicketDetail,
});

function CrmSupportTicketDetail() {
  const { ticketId } = Route.useParams();
  const navigate = useNavigate();
  const loading = useDetailLoading();
  const ticket = useTicketStore((s) => s.tickets.find((t) => t.id === ticketId));
  const updateTicket = useTicketStore((s) => s.updateTicket);
  const deleteTicket = useTicketStore((s) => s.deleteTicket);
  const account = useCrmAccountStore((s) =>
    ticket ? s.getById(ticket.companyId) : undefined,
  );
  const users = useUserStore((s) => s.users);
  const crmUsers = useMemo(
    () => users.filter((u) => u.active && (u.productScope === "crm" || u.role === "Admin")),
    [users],
  );
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (loading) return <DetailPageSkeleton />;
  if (!ticket || !isCrmTicket(ticket)) {
    return <EntityNotFound entity="Ticket" listPath="/crm/support" listLabel="Support Desk" />;
  }

  return (
    <PageWrap compact>
      <div className="mb-2">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 gap-1.5 text-muted-foreground"
          onClick={() => void navigate({ to: "/crm/support" })}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Support Desk
        </Button>
      </div>

      <DesignTicketPageHeader
        compact
        title={ticket.title}
        subtitle={`${ticket.id} · ${account?.name ?? "CRM account"}`}
        actions={
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        }
      />

      <div className="grid gap-2.5 lg:grid-cols-[1fr_280px]">
        <DesignTicketSection compact title="Details">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-[10px] uppercase text-muted-foreground">Description</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-sm">{ticket.description || "—"}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-muted-foreground">Type</dt>
              <dd className="mt-1">
                <select
                  className="h-8 w-full rounded border bg-background px-2 text-xs"
                  value={ticket.type}
                  onChange={(e) => updateTicket(ticket.id, { type: e.target.value as TicketType })}
                >
                  {SUPPORT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-muted-foreground">Priority</dt>
              <dd className="mt-1">
                <select
                  className="h-8 w-full rounded border bg-background px-2 text-xs"
                  value={ticket.priority}
                  onChange={(e) =>
                    updateTicket(ticket.id, { priority: e.target.value as TicketPriority })
                  }
                >
                  {SUPPORT_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-muted-foreground">Status</dt>
              <dd className="mt-1">
                <select
                  className="h-8 w-full rounded border bg-background px-2 text-xs"
                  value={ticket.status}
                  onChange={(e) =>
                    updateTicket(ticket.id, { status: e.target.value as TicketStatus })
                  }
                >
                  {TICKET_KANBAN_COLUMNS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-muted-foreground">Assignee</dt>
              <dd className="mt-1">
                <select
                  className="h-8 w-full rounded border bg-background px-2 text-xs"
                  value={ticket.assignedUserId ?? ""}
                  onChange={(e) =>
                    updateTicket(ticket.id, {
                      assignedUserId: e.target.value || undefined,
                    })
                  }
                >
                  <option value="">Unassigned</option>
                  {crmUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[10px] uppercase text-muted-foreground">Action taken</dt>
              <dd className="mt-1">
                <textarea
                  className="min-h-[72px] w-full rounded border bg-background px-2 py-1.5 text-xs"
                  defaultValue={ticket.actionTaken ?? ""}
                  onBlur={(e) => updateTicket(ticket.id, { actionTaken: e.target.value })}
                  placeholder="Notes on work done…"
                />
              </dd>
            </div>
          </dl>
        </DesignTicketSection>

        <DesignTicketSection compact title="Meta">
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-[10px] uppercase text-muted-foreground">Account</dt>
              <dd className="mt-0.5 font-medium">
                {account ? (
                  <Link
                    to="/crm/accounts/$accountId"
                    params={{ accountId: account.id }}
                    className="text-primary hover:underline"
                  >
                    {account.name}
                  </Link>
                ) : (
                  ticket.companyId
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-muted-foreground">Raised</dt>
              <dd>{formatDate(ticket.raisedOn)}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-muted-foreground">ETA</dt>
              <dd>{ticket.eta ? formatDate(ticket.eta) : "—"}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-muted-foreground">Project tag</dt>
              <dd>
                <Pill tone="muted">{ticket.projectId || CRM_TICKET_PROJECT_ID}</Pill>
              </dd>
            </div>
          </dl>
        </DesignTicketSection>
      </div>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete ticket?"
        description="This permanently removes the CRM support ticket."
        onConfirm={() => {
          deleteTicket(ticket.id);
          toast.success("Ticket deleted");
          void navigate({ to: "/crm/support" });
        }}
      />
    </PageWrap>
  );
}
