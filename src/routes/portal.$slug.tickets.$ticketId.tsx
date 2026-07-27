import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { DesignTicketThread } from "@/components/design-ticket/design-ticket-thread";
import { DesignTicketPriorityChip, DesignTicketStatusPill } from "@/components/design-ticket/design-ticket-chips";
import {
  DesignTicketDetailSkeleton,
  PortalPageWrap,
  ticketPageVariants,
  ticketSectionVariants,
} from "@/components/design-ticket/design-ticket-shared";
import { Button } from "@/components/ui/button";
import { EntityNotFound } from "@/components/empty-state";
import { getPortalDesignTicket } from "@/lib/api";
import { useCompanyPortalStore } from "@/stores/useCompanyPortalStore";
import { useDesignTicketStore } from "@/stores/useDesignTicketStore";

export const Route = createFileRoute("/portal/$slug/tickets/$ticketId")({
  component: PortalTicketDetail,
});

function PortalTicketDetail() {
  const { slug, ticketId } = Route.useParams();
  const navigate = useNavigate();
  const access = useCompanyPortalStore((s) => s.getBySlug(slug));
  const ticket = useDesignTicketStore((s) => s.getById(ticketId));
  const mergeTicket = useDesignTicketStore((s) => s.mergeTicket);
  const addMessage = useDesignTicketStore((s) => s.addMessage);
  const [loading, setLoading] = useState(!ticket);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    void getPortalDesignTicket({ data: { slug, ticketId } })
      .then((row) => {
        if (!cancelled) mergeTicket(row);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, ticketId, mergeTicket]);

  if (!access) return null;

  if (loading && !ticket) {
    return (
      <PortalPageWrap>
        <DesignTicketDetailSkeleton />
      </PortalPageWrap>
    );
  }

  if (notFound || !ticket || ticket.companyId !== access.companyId) {
    return <EntityNotFound entity="Ticket" listPath={`/portal/${slug}/tickets`} listLabel="My Tickets" />;
  }

  return (
    <PortalPageWrap>
      <motion.div variants={ticketPageVariants} initial="hidden" animate="show" className="space-y-4">
        <motion.div variants={ticketSectionVariants}>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 gap-1.5 text-muted-foreground"
            onClick={() => void navigate({ to: "/portal/$slug/tickets", params: { slug } })}
          >
            <ArrowLeft className="h-4 w-4" />
            My Tickets
          </Button>
        </motion.div>

        <motion.header variants={ticketSectionVariants} className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <h1 className="min-w-0 text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
              <span className="text-primary">{ticket.ticketNumber}</span>
              <span className="text-muted-foreground"> — </span>
              {ticket.subject}
            </h1>
            <div className="flex flex-wrap gap-2">
              <DesignTicketStatusPill status={ticket.status} />
              <DesignTicketPriorityChip priority={ticket.priority} />
            </div>
          </div>
        </motion.header>

        <motion.div variants={ticketSectionVariants} className="card-soft p-3 sm:p-4">
          <DesignTicketThread
            ticket={ticket}
            mode="client"
            contactName={access.contactName}
            reply={{
              placeholder: "Reply to the Buildesk team…",
              onSend: (message, attachments) => {
                addMessage(
                  ticketId,
                  {
                    authorType: "client",
                    authorName: access.contactName,
                    message,
                    attachments,
                  },
                  { portalSlug: slug },
                );
                toast.success("Reply sent");
              },
            }}
          />
        </motion.div>
      </motion.div>
    </PortalPageWrap>
  );
}
