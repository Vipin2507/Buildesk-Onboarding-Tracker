import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";
import { isDesignTicketActive, isDesignTicketSolved, useDesignTicketStats } from "@/stores/design-ticket-selectors";
import { useBookingStore } from "@/stores/useBookingStore";
import { useCompanyPortalStore } from "@/stores/useCompanyPortalStore";
import { useDesignTicketStore } from "@/stores/useDesignTicketStore";
import { BOOKING_STATUS_LABEL, type BookingAppointment } from "@/types/booking";

export const Route = createFileRoute("/portal/$slug/dashboard")({
  component: PortalDashboard,
});

function formatWhen(iso: string) {
  const date = iso.slice(0, 10);
  const time = iso.slice(11, 16);
  return `${date} · ${time}`;
}

function statusTone(status: string) {
  if (status === "confirmed") return "text-success";
  if (status === "pending") return "text-warning-foreground";
  if (status === "postponed") return "text-info";
  if (status === "cancelled" || status === "declined") return "text-destructive";
  return "text-muted-foreground";
}

function PortalDashboard() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const access = useCompanyPortalStore((s) => s.getBySlug(slug));
  const tickets = useDesignTicketStore((s) => s.tickets);
  const stats = useDesignTicketStats(access?.companyId);
  const listPortalAppointments = useBookingStore((s) => s.listPortalAppointments);
  const [bookings, setBookings] = useState<BookingAppointment[]>([]);

  useEffect(() => {
    if (!access) return;
    void listPortalAppointments(slug, access.contactEmail || undefined)
      .then(setBookings)
      .catch(() => setBookings([]));
  }, [access, listPortalAppointments, slug]);

  if (!access) return null;

  const companyTickets = tickets
    .filter((t) => t.companyId === access.companyId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const current = companyTickets.filter((t) => isDesignTicketActive(t.status));
  const solved = companyTickets.filter((t) => isDesignTicketSolved(t.status));

  const pendingCount = stats.open + stats.inProgress;
  const recentBookings = bookings.slice(0, 8);

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
        className="mb-4"
      >
        <DesignTicketKpiGrid items={kpiCards} columns={4} size="compact" />
      </motion.div>

      <PortalTicketTableCard
        title="Booked calls"
        delay={0.04}
        action={
          <Link
            to="/portal/$slug/book"
            params={{ slug }}
            className="text-xs font-medium text-primary hover:underline"
          >
            Book a call
          </Link>
        }
      >
        {recentBookings.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No booked calls yet.{" "}
            <Link to="/portal/$slug/book" params={{ slug }} className="text-primary hover:underline">
              Request a call
            </Link>{" "}
            to see status here.
          </p>
        ) : (
          <div className="divide-y">
            {recentBookings.map((appt) => (
              <div
                key={appt.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">{formatWhen(appt.startsAt)}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {appt.notes?.split("\n")[0] || "Call request"}
                  </div>
                  {appt.meetUrl && appt.status === "confirmed" ? (
                    <a
                      href={appt.meetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex text-xs font-medium text-primary hover:underline"
                    >
                      Join Google Meet
                    </a>
                  ) : null}
                </div>
                <span className={cn("text-xs font-semibold", statusTone(appt.status))}>
                  {BOOKING_STATUS_LABEL[appt.status] ?? appt.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </PortalTicketTableCard>

      <PortalTicketTableCard title="My Current Tickets" delay={0.06} className="mt-8">
        {current.length === 0 ? (
          <div className="p-4">
            <EmptyPortalCurrent slug={slug} />
          </div>
        ) : (
          <PortalActiveTicketsTable
            rows={current}
            slug={slug}
            pageSize={8}
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
