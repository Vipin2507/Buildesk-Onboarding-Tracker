import { createFileRoute } from "@tanstack/react-router";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, PageWrap } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { portalPublicCreateUrl } from "@/lib/design-ticket-portal";
import { useCompanyPortalStore, useCompanyStore } from "@/stores";

export const Route = createFileRoute("/tickets/links")({
  component: TicketLinksPage,
});

function TicketLinksPage() {
  const companies = useCompanyStore((s) => s.companies);
  const access = useCompanyPortalStore((s) => s.access);
  const setActive = useCompanyPortalStore((s) => s.setActive);

  const rows = companies.map((c) => {
    const portal = access.find((a) => a.companyId === c.id);
    return { company: c, portal };
  });

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <PageWrap>
      <PageHeader
        title="Company Portal Links"
        subtitle="Unique ticket creation links per company — share with clients to enable self-service."
      />

      <div className="space-y-3">
        {rows.map(({ company, portal }) => {
          const url = portal ? portalPublicCreateUrl(portal.slug) : "—";
          return (
            <div key={company.id} className="card-soft flex flex-col gap-3 p-4 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{company.name}</div>
                <div className="mt-1 flex gap-2">
                  <Input readOnly value={url} className="h-9 font-mono text-xs" />
                  {portal ? (
                    <Button type="button" variant="outline" size="icon" onClick={() => void copy(url)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
              {portal ? (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={portal.isActive}
                    onChange={(e) => {
                      setActive(company.id, e.target.checked);
                      toast.success(e.target.checked ? "Portal activated" : "Portal deactivated");
                    }}
                  />
                  Active
                </label>
              ) : (
                <span className="text-xs text-muted-foreground">Portal not generated yet</span>
              )}
            </div>
          );
        })}
      </div>
    </PageWrap>
  );
}
