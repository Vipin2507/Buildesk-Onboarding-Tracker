import { createFileRoute } from "@tanstack/react-router";

import { CrmDashboardActivityPanel } from "@/components/crm/crm-dashboard-activity-panel";
import { useCrmDashboardOverview } from "@/stores/crm-dashboard-selectors";

export const Route = createFileRoute("/crm/activity")({
  component: CrmActivityPage,
});

function CrmActivityPage() {
  const { allActivity } = useCrmDashboardOverview();

  return <CrmDashboardActivityPanel items={allActivity} />;
}
