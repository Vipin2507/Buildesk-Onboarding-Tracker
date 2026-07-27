import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";

import {
  DesignTicketPageHeader,
  PortalPageWrap,
  ticketSectionVariants,
} from "@/components/design-ticket/design-ticket-shared";
import {
  PortalSolvedTicketsTable,
  PortalTicketTableCard,
} from "@/components/design-ticket/portal-ticket-shared";
import { Button } from "@/components/ui/button";
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
    <PortalPageWrap>
      <DesignTicketPageHeader
        title="Solved Tickets"
        subtitle="Resolved and closed requests from your company."
        actions={
          <Button size="sm" variant="outline" className="gap-1.5" asChild>
            <Link to="/portal/$slug/tickets" params={{ slug }}>
              View active tickets
            </Link>
          </Button>
        }
      />

      <motion.div variants={ticketSectionVariants} initial="hidden" animate="show">
        <PortalTicketTableCard>
          <PortalSolvedTicketsTable
            rows={rows}
            slug={slug}
            onRowClick={(row) =>
              void navigate({
                to: "/portal/$slug/tickets/$ticketId",
                params: { slug, ticketId: row.id },
              })
            }
          />
        </PortalTicketTableCard>
      </motion.div>
    </PortalPageWrap>
  );
}
