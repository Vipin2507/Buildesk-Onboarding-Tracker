import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import {
  DesignTicketPriorityChip,
  DesignTicketStatusPill,
} from "@/components/design-ticket/design-ticket-chips";
import { DesignTicketPageHeader, PortalPageWrap } from "@/components/design-ticket/design-ticket-shared";
import { formatDate } from "@/lib/utils";
import { isDesignTicketActive } from "@/stores/design-ticket-selectors";
import { useCompanyPortalStore } from "@/stores/useCompanyPortalStore";
import { useDesignTicketStore } from "@/stores/useDesignTicketStore";

export const Route = createFileRoute("/portal/$slug/tickets")({
  component: PortalMyTickets,
});

function PortalMyTickets() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const access = useCompanyPortalStore((s) => s.getBySlug(slug));
  const tickets = useDesignTicketStore((s) => s.tickets);

  if (!access) return null;

  const rows = tickets
    .filter((t) => t.companyId === access.companyId && isDesignTicketActive(t.status))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <PortalPageWrap>
      <DesignTicketPageHeader
        title="My Tickets"
        subtitle="Open and in-progress requests for your company."
      />

      {rows.length === 0 ? (
        <EmptyState title="No open tickets" description="Create a ticket to start a conversation with our team." />
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
            { key: "status", header: "Status", render: (r) => <DesignTicketStatusPill status={r.status} /> },
            { key: "priority", header: "Priority", render: (r) => <DesignTicketPriorityChip priority={r.priority} /> },
            { key: "createdAt", header: "Created", render: (r) => formatDate(r.createdAt) },
          ]}
        />
      )}
    </PortalPageWrap>
  );
}
