import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { DesignTicketThread } from "@/components/design-ticket/design-ticket-thread";
import { DesignTicketPriorityChip, DesignTicketStatusPill } from "@/components/design-ticket/design-ticket-chips";
import { PageWrap } from "@/components/page-header";
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
    <PageWrap>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 mb-3 gap-1.5 text-muted-foreground"
        onClick={() => void navigate({ to: "/portal/$slug/tickets", params: { slug } })}
      >
        <ArrowLeft className="h-4 w-4" />
        My Tickets
      </Button>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">
          {ticket.ticketNumber} — {ticket.subject}
        </h1>
        <DesignTicketStatusPill status={ticket.status} />
        <DesignTicketPriorityChip priority={ticket.priority} />
      </div>

      <div className="card-soft p-4">
        <DesignTicketThread
          ticket={ticket}
          mode="client"
          contactName={access.contactName}
          reply={{
            placeholder: "Reply to the Buildesk team…",
            onSend: (message, attachments) => {
              addMessage(ticketId, {
                authorType: "client",
                authorName: access.contactName,
                message,
                attachments,
              });
              toast.success("Reply sent");
            },
          }}
        />
      </div>
    </PageWrap>
  );
}
