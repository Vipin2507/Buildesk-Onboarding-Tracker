import { createFileRoute } from "@tanstack/react-router";

import { CrmDashboardActivityPanel } from "@/components/crm/crm-dashboard-activity-panel";
import { DesignTicketPageHeader } from "@/components/design-ticket/design-ticket-shared";
import { PageWrap } from "@/components/page-header";
import { useCrmDashboardOverview } from "@/stores/crm-dashboard-selectors";

export const Route = createFileRoute("/crm/activity")({
  component: CrmActivityPage,
});

function CrmActivityPage() {
  const { allActivity } = useCrmDashboardOverview();

  return (
    <PageWrap compact>
      <DesignTicketPageHeader
        compact
        title="Activity history"
        subtitle="CRM-style activity log with filters, sorting, and pagination across accounts, follow-ups, and visits."
      />
      <CrmDashboardActivityPanel items={allActivity} />
    </PageWrap>
  );
}
