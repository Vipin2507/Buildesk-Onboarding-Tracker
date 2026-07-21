import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ClientPortalLayout, PortalInactiveState } from "@/components/client-portal-layout";
import { getPortalBySlug } from "@/lib/api";
import type { CompanyPortalAccess } from "@/types/design-ticket";
import { useCompanyPortalStore } from "@/stores/useCompanyPortalStore";

export const Route = createFileRoute("/portal/$slug")({
  component: PortalLayoutRoute,
});

function PortalLayoutRoute() {
  const { slug } = Route.useParams();
  const localAccess = useCompanyPortalStore((s) => s.getBySlug(slug));
  const mergeAccess = useCompanyPortalStore((s) => s.mergeAccess);
  const [access, setAccess] = useState<CompanyPortalAccess | null | undefined>(
    localAccess ?? undefined,
  );

  useEffect(() => {
    if (localAccess) {
      setAccess(localAccess);
      return;
    }

    let cancelled = false;
    setAccess(undefined);

    getPortalBySlug({ data: { slug } })
      .then((record) => {
        if (cancelled) return;
        mergeAccess(record);
        setAccess(record);
      })
      .catch(() => {
        if (!cancelled) setAccess(null);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, localAccess, mergeAccess]);

  if (access === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading client portal…
      </div>
    );
  }

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
