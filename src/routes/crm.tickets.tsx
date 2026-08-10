import { createFileRoute, Link, Outlet, useChildMatches, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Link2 } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { CrmTicketsNav } from "@/components/crm/crm-tickets-nav";
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
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { TICKET_KANBAN_COLUMNS } from "@/data/constants";
import { filterCrmTickets } from "@/lib/crm-tickets";
import { isTicketOpen } from "@/lib/tickets";
import { SUPPORT_PRIORITIES } from "@/lib/support-tracking";
import { formatDate } from "@/lib/utils";
import { useCrmAccountStore, useTicketStore } from "@/stores";
import type { TicketPriority, TicketStatus } from "@/types";

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
  const tickets = useTicketStore((s) => s.tickets);
  const updateTicket = useTicketStore((s) => s.updateTicket);
  const accounts = useCrmAccountStore((s) => s.accounts);
  const crmTickets = useMemo(() => filterCrmTickets(tickets), [tickets]);

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
        t.title.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        accountName(t.companyId).toLowerCase().includes(q)
      );
    });
  }, [crmTickets, statusFilter, priorityFilter, accountFilter, query, accountName]);

  const openCount = crmTickets.filter((t) => isTicketOpen(t)).length;
  const pendingCount = crmTickets.filter((t) => t.status === "Pending").length;
  const criticalCount = crmTickets.filter((t) => t.priority === "Critical" && isTicketOpen(t)).length;

  return (
    <PageWrap compact>
      <DesignTicketPageHeader
        compact
        title="Ticket Tracking"
        subtitle="Filter and track CRM support tickets across accounts"
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
          { id: "open", label: "Open", value: openCount },
          { id: "pending", label: "Pending", value: pendingCount },
          { id: "critical", label: "Critical open", value: criticalCount },
          { id: "total", label: "Total", value: crmTickets.length },
        ]}
      />

      <DesignTicketFilterBar>
        <DesignTicketFilterField label="Search">
          <input
            className="h-8 w-full rounded-md border bg-background px-2 text-xs"
            placeholder="Title, id, account…"
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
              ...TICKET_KANBAN_COLUMNS.map((s) => ({ value: s, label: s })),
            ]}
          />
        </DesignTicketFilterField>
        <DesignTicketFilterField label="Priority">
          <DesignTicketSelect
            value={priorityFilter}
            onChange={setPriorityFilter}
            options={[
              { value: "all", label: "All priorities" },
              ...SUPPORT_PRIORITIES.map((p) => ({ value: p, label: p })),
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
          description="Adjust filters or create a ticket from Support Desk. Share portal links from Portal Links."
          actionLabel="Portal Links"
          href="/crm/tickets/links"
        />
      ) : (
        <DesignTicketSection
          compact
          title="Tracked tickets"
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
                key: "title",
                header: "Ticket",
                render: (t) => (
                  <div>
                    <div className="font-medium">{t.title}</div>
                    <div className="text-[10px] text-muted-foreground">{t.id}</div>
                  </div>
                ),
              },
              {
                key: "account",
                header: "Account",
                render: (t) => accountName(t.companyId),
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
                      updateTicket(t.id, { status: e.target.value as TicketStatus });
                      toast.success(`Status → ${e.target.value}`);
                    }}
                  >
                    {TICKET_KANBAN_COLUMNS.map((s) => (
                      <option key={s} value={s}>
                        {s}
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
                      updateTicket(t.id, { priority: e.target.value as TicketPriority })
                    }
                  >
                    {SUPPORT_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                ),
              },
              {
                key: "type",
                header: "Type",
                render: (t) => <Pill tone="muted">{t.type}</Pill>,
              },
              {
                key: "raised",
                header: "Raised",
                render: (t) => formatDate(t.raisedOn),
              },
            ]}
          />
        </DesignTicketSection>
      )}
    </PageWrap>
  );
}
