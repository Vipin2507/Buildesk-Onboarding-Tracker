import { createFileRoute, Outlet } from "@tanstack/react-router";

import { CrmPortalBootstrap } from "@/components/crm/crm-portal-bootstrap";

export const Route = createFileRoute("/crm")({
  component: CrmShell,
});

function CrmShell() {
  return (
    <>
      <CrmPortalBootstrap />
      <Outlet />
    </>
  );
}
