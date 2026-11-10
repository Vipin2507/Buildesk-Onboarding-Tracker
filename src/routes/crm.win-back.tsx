import { createFileRoute } from "@tanstack/react-router";

import { CrmWinbackPanel } from "@/components/crm/crm-winback-panel";
import { DesignTicketPageHeader } from "@/components/design-ticket/design-ticket-shared";
import { PageWrap } from "@/components/page-header";

export const Route = createFileRoute("/crm/win-back")({
  component: CrmWinbackPage,
});

function CrmWinbackPage() {
  return (
    <PageWrap compact>
      <DesignTicketPageHeader
        compact
        title="Win-back"
        subtitle="Former clients · import closed accounts and schedule WhatsApp outreach in waves of 50."
      />
      <CrmWinbackPanel />
    </PageWrap>
  );
}
