import { createFileRoute } from "@tanstack/react-router";

import {
  DesignTicketPageHeader,
  DesignTicketSection,
} from "@/components/design-ticket/design-ticket-shared";
import { PageWrap } from "@/components/page-header";
import { useAuthStore } from "@/stores";
import { productScopeOf } from "@/lib/product-scope";

export const Route = createFileRoute("/crm/settings")({
  component: CrmSettingsPage,
});

function CrmSettingsPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <PageWrap compact>
      <DesignTicketPageHeader
        compact
        title="CRM Settings"
        subtitle="Profile and product scope for the CRM workspace"
      />
      <DesignTicketSection compact title="Signed-in user">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[10px] uppercase text-muted-foreground">Name</dt>
            <dd className="font-medium">{user?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-muted-foreground">Email</dt>
            <dd className="font-medium">{user?.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-muted-foreground">Role</dt>
            <dd className="font-medium">{user?.role ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-muted-foreground">Product</dt>
            <dd className="font-medium uppercase">{productScopeOf(user)}</dd>
          </div>
        </dl>
      </DesignTicketSection>
    </PageWrap>
  );
}
