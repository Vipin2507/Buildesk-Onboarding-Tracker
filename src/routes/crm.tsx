import { createFileRoute, Outlet } from "@tanstack/react-router";

import { CrmDashboardBootstrap } from "@/components/crm/crm-dashboard-bootstrap";
import { CrmPortalBootstrap } from "@/components/crm/crm-portal-bootstrap";
import { useAutoWebPushOnLogin } from "@/hooks/use-auto-web-push";

export const Route = createFileRoute("/crm")({
  component: CrmShell,
});

function CrmShell() {
  useAutoWebPushOnLogin();

  return (
    <>
      <CrmPortalBootstrap />
      <CrmDashboardBootstrap />
      <Outlet />
    </>
  );
}
