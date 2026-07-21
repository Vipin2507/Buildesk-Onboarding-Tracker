import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { DesignTicketStatusPill } from "@/components/design-ticket/design-ticket-chips";
import { PageWrap } from "@/components/page-header";
import { formatDate } from "@/lib/utils";
import { isDesignTicketSolved } from "@/stores/design-ticket-selectors";
import { useCompanyPortalStore } from "@/stores/useCompanyPortalStore";
import { useDesignTicketStore } from "@/stores/useDesignTicketStore";

export const Route = createFileRoute("/portal/$slug/solved")({
  component: PortalSolvedTickets,
});

function PortalSolvedTickets() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const access = useCompanyPortalStore((s) => s.getBySlug(slug));
  const tickets = useDesignTicketStore((s) => s.tickets);

  if (!access) return null;

  const rows = tickets
    .filter((t) => t.companyId === access.companyId && isDesignTicketSolved(t.status))
    .sort((a, b) => (b.resolvedAt ?? b.updatedAt).localeCompare(a.resolvedAt ?? a.updatedAt));

  return (
    <PageWrap>
      <h1 className="mb-6 text-xl font-semibold">Solved Tickets</h1>
      {rows.length === 0 ? (
        <EmptyState title="No solved tickets yet" description="Resolved and closed tickets will appear here." />
      ) : (
        <DataTable
          data={rows}
          getRowId={(r) => r.id}
          hideSearch
          pageSize={10}
          onRowClick={(row) =>
            void navigate({
              to: "/portal/$slug/tickets/$ticketId",
              params: { slug, ticketId: row.id },
            })
          }
          columns={[
            { key: "ticketNumber", header: "Ticket ID", render: (r) => r.ticketNumber },
            { key: "subject", header: "Subject", render: (r) => r.subject },
            { key: "resolvedAt", header: "Resolved On", render: (r) => formatDate(r.resolvedAt ?? r.updatedAt) },
            { key: "status", header: "Status", render: (r) => <DesignTicketStatusPill status={r.status} /> },
          ]}
        />
      )}
    </PageWrap>
  );
}
