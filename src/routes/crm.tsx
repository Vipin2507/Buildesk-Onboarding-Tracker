import { createFileRoute, Outlet } from "@tanstack/react-router";

import { CrmDashboardBootstrap } from "@/components/crm/crm-dashboard-bootstrap";
import { CrmPortalBootstrap } from "@/components/crm/crm-portal-bootstrap";

export const Route = createFileRoute("/crm")({
  component: CrmShell,
});

function CrmShell() {
  return (
    <>
      <CrmPortalBootstrap />
      <CrmDashboardBootstrap />
      <Outlet />
    </>
  );
}
