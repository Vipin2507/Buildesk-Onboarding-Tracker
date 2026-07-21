import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import {
  DesignTicketFormCard,
  DesignTicketFormField,
  DesignTicketPageHeader,
  PortalPageWrap,
  ticketFieldClass,
} from "@/components/design-ticket/design-ticket-shared";
import { Button } from "@/components/ui/button";
import { portalPublicCreateUrl } from "@/lib/design-ticket-portal";
import { useCompanyPortalStore } from "@/stores/useCompanyPortalStore";

export const Route = createFileRoute("/portal/$slug/profile")({
  component: PortalProfile,
});

function PortalProfile() {
  const { slug } = Route.useParams();
  const access = useCompanyPortalStore((s) => s.getBySlug(slug));
  const updateContact = useCompanyPortalStore((s) => s.updateContact);

  if (!access) return null;

  return (
    <PortalPageWrap>
      <DesignTicketPageHeader title="Profile" subtitle="Your contact details for this client portal." />

      <DesignTicketFormCard>
        <div>
          <div className="text-xs text-muted-foreground">Company</div>
          <div className="font-medium">{access.companyName}</div>
        </div>
        <DesignTicketFormField label="Contact name">
          <input
            defaultValue={access.contactName}
            onBlur={(e) => {
              updateContact(access.companyId, { contactName: e.target.value.trim() });
              toast.success("Profile updated");
            }}
            className={ticketFieldClass}
          />
        </DesignTicketFormField>
        <DesignTicketFormField label="Email">
          <input
            type="email"
            defaultValue={access.contactEmail}
            onBlur={(e) => {
              updateContact(access.companyId, { contactEmail: e.target.value.trim() });
              toast.success("Profile updated");
            }}
            className={ticketFieldClass}
          />
        </DesignTicketFormField>
        <div>
          <div className="text-xs text-muted-foreground">Your ticket link</div>
          <div className="mt-1 break-all rounded-lg border bg-muted/30 p-2.5 font-mono text-xs">
            {portalPublicCreateUrl(slug)}
          </div>
        </div>
        <Button type="button" variant="outline" className="w-full sm:w-auto" asChild>
          <Link to="/portal/$slug/dashboard" params={{ slug }}>
            Back to dashboard
          </Link>
        </Button>
      </DesignTicketFormCard>
    </PortalPageWrap>
  );
}
