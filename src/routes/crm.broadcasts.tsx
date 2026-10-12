import { createFileRoute } from "@tanstack/react-router";

import { CrmWhatsappBroadcastPanel } from "@/components/crm/crm-whatsapp-broadcast-panel";
import { DesignTicketPageHeader } from "@/components/design-ticket/design-ticket-shared";
import { PageWrap } from "@/components/page-header";

export const Route = createFileRoute("/crm/broadcasts")({
  component: CrmBroadcastsPage,
});

function CrmBroadcastsPage() {
  return (
    <PageWrap compact>
      <DesignTicketPageHeader
        compact
        title="WhatsApp Broadcast"
        subtitle="Send or schedule messages to account WhatsApp groups."
      />
      <CrmWhatsappBroadcastPanel />
    </PageWrap>
  );
}
