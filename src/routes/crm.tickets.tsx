import { createFileRoute, Link, Outlet, useChildMatches, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Link2 } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { CrmTicketsNav } from "@/components/crm/crm-tickets-nav";
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
  DesignTicketFilterBar,
  DesignTicketKpiGrid,
  DesignTicketPageHeader,
  DesignTicketSection,
} from "@/components/design-ticket/design-ticket-shared";
import { PageWrap } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { filterCrmDesignTickets } from "@/lib/crm-tickets";
import { formatDate } from "@/lib/utils";
import { isDesignTicketActive } from "@/stores/design-ticket-selectors";
import { useCrmAccountStore, useCurrentUser } from "@/stores";
import { useDesignTicketStore } from "@/stores/useDesignTicketStore";
import type { DesignTicketPriority, DesignTicketStatus } from "@/types/design-ticket";
import {
  DESIGN_TICKET_PRIORITY_LABEL,
  DESIGN_TICKET_STATUS_LABEL,
} from "@/types/design-ticket";

export const Route = createFileRoute("/crm/tickets")({
  component: CrmTicketsLayout,
});

function CrmTicketsLayout() {
  const childMatches = useChildMatches();
  if (childMatches.length > 0) return <Outlet />;
  return <CrmTicketTrackingPage />;
}

function CrmTicketTrackingPage() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const tickets = useDesignTicketStore((s) => s.tickets);
  const updateStatus = useDesignTicketStore((s) => s.updateStatus);
  const updatePriority = useDesignTicketStore((s) => s.updatePriority);
  const accounts = useCrmAccountStore((s) => s.accounts);
  const crmTickets = useMemo(() => filterCrmDesignTickets(tickets), [tickets, accounts]);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const accountName = useMemo(() => {
    const map = new Map(accounts.map((a) => [a.id, a.name]));
    return (id: string) => map.get(id) ?? "Account";
  }, [accounts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return crmTickets.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (accountFilter !== "all" && t.companyId !== accountFilter) return false;
      if (!q) return true;
      return (
        t.subject.toLowerCase().includes(q) ||
        t.ticketNumber.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        accountName(t.companyId).toLowerCase().includes(q)
      );
    });
  }, [crmTickets, statusFilter, priorityFilter, accountFilter, query, accountName]);

  const openCount = crmTickets.filter((t) => isDesignTicketActive(t.status)).length;
  const inProgressCount = crmTickets.filter((t) => t.status === "in-progress").length;
  const highCount = crmTickets.filter(
    (t) => t.priority === "high" && isDesignTicketActive(t.status),
  ).length;

  const actorName = currentUser?.name ?? "Team";

  return (
    <PageWrap compact>
      <DesignTicketPageHeader
        compact
        title="Ticket Tracking"
        subtitle="Client portal tickets across CRM accounts"
        actions={
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs" asChild>
            <Link to="/crm/tickets/links">
              <Link2 className="h-3.5 w-3.5" />
              Portal Links
            </Link>
          </Button>
        }
      />

      <CrmTicketsNav compact />

      <DesignTicketKpiGrid
        size="compact"
        items={[
          { id: "open", label: "Open / active", value: openCount },
          { id: "progress", label: "In progress", value: inProgressCount },
          { id: "high", label: "High priority", value: highCount },
          { id: "total", label: "Total", value: crmTickets.length },
        ]}
      />

      <DesignTicketFilterBar>
        <DesignTicketFilterField label="Search">
          <input
            className="h-8 w-full rounded-md border bg-background px-2 text-xs"
            placeholder="Subject, id, account…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </DesignTicketFilterField>
        <DesignTicketFilterField label="Status">
          <DesignTicketSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: "All statuses" },
              ...DESIGN_TICKET_STATUSES.map((s) => ({
                value: s,
                label: DESIGN_TICKET_STATUS_LABEL[s],
              })),
            ]}
          />
        </DesignTicketFilterField>
        <DesignTicketFilterField label="Priority">
          <DesignTicketSelect
            value={priorityFilter}
            onChange={setPriorityFilter}
            options={[
              { value: "all", label: "All priorities" },
              ...DESIGN_TICKET_PRIORITIES.map((p) => ({
                value: p,
                label: DESIGN_TICKET_PRIORITY_LABEL[p],
              })),
            ]}
          />
        </DesignTicketFilterField>
        <DesignTicketFilterField label="Account">
          <DesignTicketSelect
            value={accountFilter}
            onChange={setAccountFilter}
            options={[
              { value: "all", label: "All accounts" },
              ...accounts.map((a) => ({ value: a.id, label: a.name })),
            ]}
          />
        </DesignTicketFilterField>
      </DesignTicketFilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          title="No matching tickets"
          description="Portal tickets created by clients appear here. Share links from Portal Links."
          actionLabel="Portal Links"
          href="/crm/tickets/links"
        />
      ) : (
        <DesignTicketSection
          compact
          title="Portal tickets"
          action={
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {filtered.length} shown ·{" "}
              <Link to="/crm/tickets/links" className="text-primary hover:underline">
                manage links
              </Link>
            </span>
          }
        >
          <DataTable
            data={filtered}
            getRowId={(t) => t.id}
            hideSearch
            onRowClick={(t) =>
              void navigate({ to: "/crm/tickets/$ticketId", params: { ticketId: t.id } })
            }
            columns={[
              {
                key: "subject",
                header: "Ticket",
                render: (t) => (
                  <div>
                    <div className="font-medium">{t.subject}</div>
                    <div className="text-[10px] text-muted-foreground">{t.ticketNumber}</div>
                  </div>
                ),
              },
              {
                key: "account",
                header: "Account",
                render: (t) => (
                  <Link
                    to="/crm/accounts/$accountId"
                    params={{ accountId: t.companyId }}
                    className="text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {accountName(t.companyId)}
                  </Link>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (t) => (
                  <select
                    className="h-7 rounded border bg-background px-1.5 text-[11px]"
                    value={t.status}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      updateStatus(t.id, e.target.value as DesignTicketStatus, actorName);
                      toast.success(
                        `Status → ${DESIGN_TICKET_STATUS_LABEL[e.target.value as DesignTicketStatus]}`,
                      );
                    }}
                  >
                    {DESIGN_TICKET_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {DESIGN_TICKET_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                ),
              },
              {
                key: "priority",
                header: "Priority",
                render: (t) => (
                  <select
                    className="h-7 rounded border bg-background px-1.5 text-[11px]"
                    value={t.priority}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      updatePriority(t.id, e.target.value as DesignTicketPriority, actorName)
                    }
                  >
                    {DESIGN_TICKET_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {DESIGN_TICKET_PRIORITY_LABEL[p]}
                      </option>
                    ))}
                  </select>
                ),
              },
              {
                key: "createdBy",
                header: "Raised by",
                render: (t) => (
                  <span className="text-xs text-muted-foreground">
                    {t.createdBy.name}
                    {t.createdBy.type === "client" ? " · Client" : ""}
                  </span>
                ),
              },
              {
                key: "chips",
                header: "",
                render: (t) => (
                  <div className="flex items-center gap-1">
                    <DesignTicketStatusPill status={t.status} />
                    <DesignTicketPriorityChip priority={t.priority} />
                  </div>
                ),
              },
              {
                key: "createdAt",
                header: "Raised",
                render: (t) => formatDate(t.createdAt),
              },
            ]}
          />
        </DesignTicketSection>
      )}
    </PageWrap>
  );
}
