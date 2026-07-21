import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { CountUp } from "@/components/count-up";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import {
  DesignTicketPriorityChip,
  DesignTicketStatusPill,
} from "@/components/design-ticket/design-ticket-chips";
import { PageWrap } from "@/components/page-header";
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
    { label: "Open Tickets", value: stats.open },
    { label: "In Progress", value: stats.inProgress },
    { label: "Solved", value: stats.resolved },
    { label: "Closed", value: stats.closed },
  ];

  return (
    <PageWrap>
      <h1 className="mb-1 text-xl font-semibold">Dashboard</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Track design and support requests for {access.companyName}.
      </p>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card-soft p-4">
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className="mt-1 text-2xl font-semibold">
              <CountUp to={k.value} />
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">My Current Tickets</h2>
        <Button size="sm" asChild>
          <Link to="/portal/$slug/create-ticket" params={{ slug }}>
            Create ticket
          </Link>
        </Button>
      </div>

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

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Solved Tickets</h2>
          <Link
            to="/portal/$slug/solved"
            params={{ slug }}
            className="text-xs text-primary hover:underline"
          >
            View all
          </Link>
        </div>
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
      </div>

      <div className="mt-8 rounded-lg border border-info/30 bg-info/5 px-4 py-3 text-center text-sm text-muted-foreground">
        You can view the status, timeline and all replies from our team in real time.
      </div>
    </PageWrap>
  );
}
