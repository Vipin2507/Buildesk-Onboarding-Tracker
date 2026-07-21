import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { DesignTicketThread } from "@/components/design-ticket/design-ticket-thread";
import { DesignTicketPriorityChip, DesignTicketStatusPill } from "@/components/design-ticket/design-ticket-chips";
import { PortalPageWrap, TICKET_EASE } from "@/components/design-ticket/design-ticket-shared";
import { Button } from "@/components/ui/button";
import { EntityNotFound } from "@/components/empty-state";
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
  const addMessage = useDesignTicketStore((s) => s.addMessage);

  if (!access) return null;

  if (!ticket || ticket.companyId !== access.companyId) {
    return <EntityNotFound entity="Ticket" listPath={`/portal/${slug}/tickets`} listLabel="My Tickets" />;
  }

  return (
    <PortalPageWrap>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 mb-3 gap-1.5 text-muted-foreground"
        onClick={() => void navigate({ to: "/portal/$slug/tickets", params: { slug } })}
      >
        <ArrowLeft className="h-4 w-4" />
        My Tickets
      </Button>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: TICKET_EASE }}
        className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
      >
        <h1 className="min-w-0 text-base font-semibold leading-snug sm:text-lg">
          <span className="text-primary">{ticket.ticketNumber}</span>
          <span className="text-muted-foreground"> — </span>
          {ticket.subject}
        </h1>
        <div className="flex flex-wrap gap-2">
          <DesignTicketStatusPill status={ticket.status} />
          <DesignTicketPriorityChip priority={ticket.priority} />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.06, ease: TICKET_EASE }}
        className="card-soft p-3 sm:p-4"
      >
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
    </PortalPageWrap>
  );
}
