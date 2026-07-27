import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";

import {
  DesignTicketInfoBanner,
  DesignTicketKpiGrid,
  DesignTicketPageHeader,
  PortalPageWrap,
  ticketSectionVariants,
} from "@/components/design-ticket/design-ticket-shared";
import {
  PortalActiveTicketsTable,
  PortalSolvedTicketsTable,
  PortalTicketTableCard,
} from "@/components/design-ticket/portal-ticket-shared";
import { Button } from "@/components/ui/button";
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

  const pendingCount = stats.open + stats.inProgress;

  const kpiCards = useMemo(
    () => [
      {
        id: "pending",
        label: "Pending",
        value: pendingCount,
        tone: "text-primary",
        onClick: () =>
          void navigate({
            to: "/portal/$slug/tickets",
            params: { slug },
            search: { filter: "pending" },
          }),
      },
      {
        id: "open",
        label: "Open",
        value: stats.open,
        tone: "text-info",
        onClick: () =>
          void navigate({
            to: "/portal/$slug/tickets",
            params: { slug },
            search: { filter: "open" },
          }),
      },
      {
        id: "in-progress",
        label: "In Progress",
        value: stats.inProgress,
        tone: "text-warning-foreground",
        onClick: () =>
          void navigate({
            to: "/portal/$slug/tickets",
            params: { slug },
            search: { filter: "in-progress" },
          }),
      },
      {
        id: "solved",
        label: "Solved",
        value: stats.resolved + stats.closed,
        tone: "text-success",
        onClick: () => void navigate({ to: "/portal/$slug/solved", params: { slug } }),
      },
    ],
    [navigate, slug, pendingCount, stats],
  );

  function openTicket(ticketId: string) {
    void navigate({
      to: "/portal/$slug/tickets/$ticketId",
      params: { slug, ticketId },
    });
  }

  return (
    <PortalPageWrap>
      <DesignTicketPageHeader
        title="Dashboard"
        subtitle={`Track requests and replies for ${access.companyName}.`}
        actions={
          <Button size="sm" className="gap-1.5" asChild>
            <Link to="/portal/$slug/create-ticket" params={{ slug }}>
              <Plus className="h-4 w-4" />
              Create ticket
            </Link>
          </Button>
        }
      />

      <motion.div
        variants={ticketSectionVariants}
        initial="hidden"
        animate="show"
        className="mb-6"
      >
        <DesignTicketKpiGrid items={kpiCards} columns={4} />
      </motion.div>

      <PortalTicketTableCard title="My Current Tickets" delay={0.06}>
        {current.length === 0 ? (
          <div className="p-4">
            <EmptyPortalCurrent slug={slug} />
          </div>
        ) : (
          <PortalActiveTicketsTable
            rows={current}
            slug={slug}
            pageSize={6}
            onRowClick={(row) => openTicket(row.id)}
          />
        )}
      </PortalTicketTableCard>

      <PortalTicketTableCard
        title="Recently Solved"
        delay={0.1}
        action={
          solved.length > 0 ? (
            <Link
              to="/portal/$slug/solved"
              params={{ slug }}
              className="text-xs font-medium text-primary hover:underline"
            >
              View all
            </Link>
          ) : null
        }
        className="mt-8"
      >
        {solved.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No solved tickets yet.</p>
        ) : (
          <PortalSolvedTicketsTable
            rows={solved.slice(0, 5)}
            slug={slug}
            pageSize={5}
            onRowClick={(row) => openTicket(row.id)}
          />
        )}
      </PortalTicketTableCard>

      <motion.div
        variants={ticketSectionVariants}
        initial="hidden"
        animate="show"
        className="mt-8"
      >
        <DesignTicketInfoBanner>
          Replies from our team appear in real time. Use live chat for quick questions.
        </DesignTicketInfoBanner>
      </motion.div>
    </PortalPageWrap>
  );
}

function EmptyPortalCurrent({ slug }: { slug: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
      <h3 className="font-semibold">No open tickets yet</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Submit a design or support request and track replies here.
      </p>
      <Button className="mt-4 gap-1.5" asChild>
        <Link to="/portal/$slug/create-ticket" params={{ slug }}>
          <Plus className="h-4 w-4" />
          Create your first ticket
        </Link>
      </Button>
    </div>
  );
}
