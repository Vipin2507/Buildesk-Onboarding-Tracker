import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import {
  DesignTicketPriorityChip,
  DesignTicketStatusPill,
} from "@/components/design-ticket/design-ticket-chips";
import {
  DesignTicketInfoBanner,
  DesignTicketKpiGrid,
  DesignTicketPageHeader,
  DesignTicketSection,
  PortalPageWrap,
} from "@/components/design-ticket/design-ticket-shared";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { isDesignTicketActive, isDesignTicketSolved, useDesignTicketStats } from "@/stores/design-ticket-selectors";
import { useCompanyPortalStore } from "@/stores/useCompanyPortalStore";
import { useDesignTicketStore } from "@/stores/useDesignTicketStore";

export const Route = createFileRoute("/portal/$slug/dashboard")({
  component: PortalDashboard,
});

function PortalDashboard() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const access = useCompanyPortalStore((s) => s.getBySlug(slug));
  const tickets = useDesignTicketStore((s) => s.tickets);
  const stats = useDesignTicketStats(access?.companyId);

  if (!access) return null;

  const companyTickets = tickets
    .filter((t) => t.companyId === access.companyId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const current = companyTickets.filter((t) => isDesignTicketActive(t.status));
  const solved = companyTickets.filter((t) => isDesignTicketSolved(t.status));

  const kpis = [
    { label: "Open", value: stats.open, tone: "text-info" },
    { label: "In Progress", value: stats.inProgress, tone: "text-warning-foreground" },
    { label: "Solved", value: stats.resolved, tone: "text-success" },
    { label: "Closed", value: stats.closed, tone: "text-muted-foreground" },
  ];

  return (
    <PortalPageWrap>
      <DesignTicketPageHeader
        title="Dashboard"
        subtitle={`Track design and support requests for ${access.companyName}.`}
        actions={
          <Button size="sm" className="gap-1.5" asChild>
            <Link to="/portal/$slug/create-ticket" params={{ slug }}>
              <Plus className="h-4 w-4" />
              Create ticket
            </Link>
          </Button>
        }
      />

      <div className="mb-6">
        <DesignTicketKpiGrid items={kpis} columns={4} />
      </div>

      <DesignTicketSection title="My Current Tickets" delay={0.08}>
        {current.length === 0 ? (
          <EmptyState
            title="No tickets yet — create your first ticket"
            description="Submit a design or support request and track replies here in real time."
            actionLabel="Create New Ticket"
            href={`/portal/${slug}/create-ticket`}
          />
        ) : (
          <DataTable
            data={current}
            getRowId={(r) => r.id}
            hideSearch
            pageSize={6}
            onRowClick={(row) =>
              void navigate({
                to: "/portal/$slug/tickets/$ticketId",
                params: { slug, ticketId: row.id },
              })
            }
            columns={[
              { key: "ticketNumber", header: "Ticket ID", render: (r) => r.ticketNumber },
              { key: "subject", header: "Subject", render: (r) => r.subject },
              { key: "status", header: "Status", render: (r) => <DesignTicketStatusPill status={r.status} /> },
              { key: "priority", header: "Priority", render: (r) => <DesignTicketPriorityChip priority={r.priority} /> },
              { key: "createdAt", header: "Created", render: (r) => formatDate(r.createdAt) },
            ]}
          />
        )}
      </DesignTicketSection>

      <DesignTicketSection
        title="Solved Tickets"
        delay={0.14}
        action={
          <Link
            to="/portal/$slug/solved"
            params={{ slug }}
            className="text-xs font-medium text-primary hover:underline"
          >
            View all
          </Link>
        }
        className="mt-8"
      >
        {solved.length === 0 ? (
          <p className="text-sm text-muted-foreground">No solved tickets yet.</p>
        ) : (
          <DataTable
            data={solved.slice(0, 5)}
            getRowId={(r) => r.id}
            hideSearch
            pageSize={5}
            onRowClick={(row) =>
              void navigate({
                to: "/portal/$slug/tickets/$ticketId",
                params: { slug, ticketId: row.id },
              })
            }
            columns={[
              { key: "ticketNumber", header: "Ticket ID", render: (r) => r.ticketNumber },
              { key: "subject", header: "Subject", render: (r) => r.subject },
              { key: "resolvedAt", header: "Resolved", render: (r) => formatDate(r.resolvedAt ?? r.updatedAt) },
              { key: "status", header: "Status", render: (r) => <DesignTicketStatusPill status={r.status} /> },
            ]}
          />
        )}
      </DesignTicketSection>

      <div className="mt-8">
        <DesignTicketInfoBanner>
          You can view the status, timeline and all replies from our team in real time.
        </DesignTicketInfoBanner>
      </div>
    </PortalPageWrap>
  );
}
