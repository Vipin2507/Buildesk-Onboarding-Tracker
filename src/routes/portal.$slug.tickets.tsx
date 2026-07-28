import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { z } from "zod";

import {
  DesignTicketKpiGrid,
  DesignTicketPageHeader,
  PortalPageWrap,
  ticketSectionVariants,
} from "@/components/design-ticket/design-ticket-shared";
import {
  matchesPortalTicketFilter,
  PortalActiveTicketsTable,
  PortalTicketListSkeleton,
  PortalTicketTableCard,
  portalTicketFilterLabel,
  type PortalTicketFilter,
} from "@/components/design-ticket/portal-ticket-shared";
import { Button } from "@/components/ui/button";
import { isDesignTicketActive } from "@/stores/design-ticket-selectors";
import { useDesignTicketStats } from "@/stores/design-ticket-selectors";
import { useCompanyPortalStore } from "@/stores/useCompanyPortalStore";
import { useDesignTicketStore } from "@/stores/useDesignTicketStore";

const searchSchema = z.object({
  filter: z.enum(["all", "pending", "open", "in-progress"]).optional(),
});

export const Route = createFileRoute("/portal/$slug/tickets")({
  validateSearch: (search) => searchSchema.parse(search),
  component: PortalMyTickets,
});

function PortalMyTickets() {
  const { slug } = Route.useParams();
  const navigate = useNavigate({ from: "/portal/$slug/tickets" });
  const { filter: kpiFilter = "all" } = Route.useSearch();
  const access = useCompanyPortalStore((s) => s.getBySlug(slug));
  const tickets = useDesignTicketStore((s) => s.tickets);
  const stats = useDesignTicketStats(access?.companyId);
  const hydrated = useDesignTicketStore((s) =>
    s.tickets.some((t) => t.companyId === access?.companyId),
  );

  const setKpiFilter = (filter: PortalTicketFilter) => {
    void navigate({ search: { filter }, replace: true });
  };

  if (!access) return null;

  const allActive = tickets
    .filter((t) => t.companyId === access.companyId && isDesignTicketActive(t.status))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const rows = useMemo(
    () => allActive.filter((t) => matchesPortalTicketFilter(t.status, kpiFilter)),
    [allActive, kpiFilter],
  );

  const pendingCount = stats.open + stats.inProgress;

  const kpiCards = [
    {
      id: "all",
      label: "All active",
      value: allActive.length,
      onClick: () => setKpiFilter("all"),
      active: kpiFilter === "all",
    },
    {
      id: "pending",
      label: "Pending",
      value: pendingCount,
      tone: "text-primary",
      onClick: () => setKpiFilter("pending"),
      active: kpiFilter === "pending",
    },
    {
      id: "open",
      label: "Open",
      value: stats.open,
      tone: "text-info",
      onClick: () => setKpiFilter("open"),
      active: kpiFilter === "open",
    },
    {
      id: "in-progress",
      label: "In Progress",
      value: stats.inProgress,
      tone: "text-warning-foreground",
      onClick: () => setKpiFilter("in-progress"),
      active: kpiFilter === "in-progress",
    },
  ];

  const loading = !hydrated && allActive.length === 0;

  return (
    <PortalPageWrap>
      <DesignTicketPageHeader
        title="My Tickets"
        subtitle="Open and in-progress requests — click a row to view the conversation."
        actions={
          <Button size="sm" className="gap-1.5" asChild>
            <Link to="/portal/$slug/create-ticket" params={{ slug }}>
              <Plus className="h-4 w-4" />
              New ticket
            </Link>
          </Button>
        }
      />

      <motion.div
        variants={ticketSectionVariants}
        initial="hidden"
        animate="show"
        className="mb-4"
      >
        <DesignTicketKpiGrid items={kpiCards} columns={4} size="compact" />
      </motion.div>

      <PortalTicketTableCard title={portalTicketFilterLabel(kpiFilter)} delay={0.06}>
        {loading ? (
          <PortalTicketListSkeleton />
        ) : (
          <PortalActiveTicketsTable
            rows={rows}
            slug={slug}
            pageSize={15}
            onRowClick={(row) =>
              void navigate({
                to: "/portal/$slug/tickets/$ticketId",
                params: { slug, ticketId: row.id },
              })
            }
          />
        )}
      </PortalTicketTableCard>
    </PortalPageWrap>
  );
}
