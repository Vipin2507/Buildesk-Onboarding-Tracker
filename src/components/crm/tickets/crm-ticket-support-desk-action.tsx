import { useNavigate } from "@tanstack/react-router";
import { ExternalLink, LifeBuoy, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { isCrmTicket } from "@/lib/crm-tickets";
import { cn } from "@/lib/utils";
import { useDesignTicketStore } from "@/stores/useDesignTicketStore";
import { useTicketStore } from "@/stores/useTicketStore";
import type { DesignTicket } from "@/types/design-ticket";

export function CrmTicketSupportDeskAction({
  ticket,
  actorName,
  className,
  size = "sm",
  /** Prefer CRM Support Desk routes when cloning from CRM Ticket Tracking. */
  preferCrm = true,
}: {
  ticket: Pick<DesignTicket, "id" | "supportTicketId">;
  actorName: string;
  className?: string;
  size?: "sm" | "default";
  preferCrm?: boolean;
}) {
  const navigate = useNavigate();
  const linkToSupportDesk = useDesignTicketStore((s) => s.linkToSupportDesk);
  const live = useDesignTicketStore((s) => s.getById(ticket.id));
  const supportTicketId = live?.supportTicketId ?? ticket.supportTicketId;
  const [busy, setBusy] = useState(false);

  function openSupportDesk(id: string) {
    const support = useTicketStore.getState().getById(id);
    const useCrm = preferCrm || (support ? isCrmTicket(support) : true);
    if (useCrm) {
      void navigate({ to: "/crm/support/$ticketId", params: { ticketId: id } });
    } else {
      void navigate({ to: "/support/$ticketId", params: { ticketId: id } });
    }
  }

  if (supportTicketId) {
    return (
      <Button
        type="button"
        size={size}
        variant="outline"
        className={cn("h-8 gap-1.5 text-xs", className)}
        onClick={() => openSupportDesk(supportTicketId)}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Support Desk {supportTicketId}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size={size}
      variant="outline"
      className={cn(
        "h-8 gap-1.5 border-violet-500/30 bg-violet-500/5 text-xs text-violet-700 hover:bg-violet-500/10 dark:text-violet-300",
        className,
      )}
      disabled={busy}
      onClick={() => {
        setBusy(true);
        try {
          const result = linkToSupportDesk(ticket.id, actorName);
          if (!result) {
            toast.error("Could not add to Support Desk");
            return;
          }
          if (result.alreadyLinked) {
            toast.message(`Already linked to ${result.supportTicketId}`);
          } else {
            toast.success(`Cloned to Support Desk as ${result.supportTicketId}`);
          }
          openSupportDesk(result.supportTicketId);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LifeBuoy className="h-3.5 w-3.5" />}
      Add to Support Desk
    </Button>
  );
}
