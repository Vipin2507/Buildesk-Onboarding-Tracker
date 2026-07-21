import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { PageWrap } from "@/components/page-header";
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
    <PageWrap>
      <h1 className="mb-6 text-xl font-semibold">Profile</h1>
      <div className="card-soft mx-auto max-w-lg space-y-4 p-5 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Company</div>
          <div className="font-medium">{access.companyName}</div>
        </div>
        <label className="block space-y-1">
          Contact name
          <input
            defaultValue={access.contactName}
            onBlur={(e) => {
              updateContact(access.companyId, { contactName: e.target.value.trim() });
              toast.success("Profile updated");
            }}
            className="h-10 w-full rounded-md border bg-card px-3"
          />
        </label>
        <label className="block space-y-1">
          Email
          <input
            type="email"
            defaultValue={access.contactEmail}
            onBlur={(e) => {
              updateContact(access.companyId, { contactEmail: e.target.value.trim() });
              toast.success("Profile updated");
            }}
            className="h-10 w-full rounded-md border bg-card px-3"
          />
        </label>
        <div>
          <div className="text-xs text-muted-foreground">Your ticket link</div>
          <div className="mt-1 break-all font-mono text-xs">{portalPublicCreateUrl(slug)}</div>
        </div>
        <Button type="button" variant="outline" asChild>
          <a href={`/portal/${slug}/dashboard`}>Back to dashboard</a>
        </Button>
      </div>
    </PageWrap>
  );
}
