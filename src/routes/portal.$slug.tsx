import { createFileRoute } from "@tanstack/react-router";

import { ClientPortalLayout, PortalInactiveState } from "@/components/client-portal-layout";
import { useCompanyPortalStore } from "@/stores/useCompanyPortalStore";

export const Route = createFileRoute("/portal/$slug")({
  component: PortalLayoutRoute,
});

function PortalLayoutRoute() {
  const { slug } = Route.useParams();
  const access = useCompanyPortalStore((s) => s.getBySlug(slug));

  if (!access) {
    return (
      <PortalInactiveState reason="We couldn't find a client portal for this link. Please contact your Buildesk account manager." />
    );
  }

  if (!access.isActive) {
    return (
      <PortalInactiveState reason="This company's client portal has been deactivated. Please ask your Buildesk contact for an updated link." />
    );
  }

  return <ClientPortalLayout access={access} />;
}
