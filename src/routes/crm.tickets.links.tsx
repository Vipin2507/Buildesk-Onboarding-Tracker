import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Copy, Link2, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import {
  DesignTicketInfoBanner,
  DesignTicketKpiGrid,
  DesignTicketPageHeader,
  DesignTicketSection,
  ticketSectionVariants,
} from "@/components/design-ticket/design-ticket-shared";
import { DataTable } from "@/components/data-table";
import { PageWrap } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { CrmTicketsNav } from "@/components/crm/crm-tickets-nav";
import { portalPublicCreateUrl } from "@/lib/design-ticket-portal";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import { useCompanyPortalStore, useCrmAccountStore } from "@/stores";

export const Route = createFileRoute("/crm/tickets/links")({
  component: CrmTicketLinksPage,
});

function CrmTicketLinksPage() {
  const accounts = useCrmAccountStore((s) => s.accounts);
  const access = useCompanyPortalStore((s) => s.access);
  const setActive = useCompanyPortalStore((s) => s.setActive);
  const generateAccess = useCompanyPortalStore((s) => s.generateAccessForCompany);

  useEffect(() => {
    for (const account of accounts) {
      generateAccess({
        id: account.id,
        name: account.name,
        contact: account.contact,
        email: account.email,
      });
    }
  }, [accounts, generateAccess]);

  const rows = useMemo(
    () =>
      accounts.map((a) => {
        const portal = access.find((p) => p.companyId === a.id);
        return {
          id: a.id,
          accountName: a.name,
          slug: portal?.slug ?? "",
          url: portal ? portalPublicCreateUrl(portal.slug) : "—",
          isActive: portal?.isActive ?? false,
          hasPortal: Boolean(portal),
        };
      }),
    [accounts, access],
  );

  async function copy(url: string) {
    const ok = await copyTextToClipboard(url);
    if (ok) {
      toast.success("Link copied");
      return;
    }
    toast.error("Auto-copy blocked. Please copy manually.");
  }

  const total = rows.length;
  const active = rows.filter((r) => r.isActive).length;
  const inactive = rows.filter((r) => r.hasPortal && !r.isActive).length;
  const missing = rows.filter((r) => !r.hasPortal).length;

  return (
    <PageWrap compact>
      <DesignTicketPageHeader
        compact
        title="Account Portal Links"
        subtitle="Share secure ticket links with CRM clients and control portal access."
      />

      <CrmTicketsNav compact />

      <div className="mb-3">
        <DesignTicketKpiGrid
          size="compact"
          columns={4}
          items={[
            { id: "total", label: "Accounts", value: total, icon: Link2 },
            { id: "active", label: "Active links", value: active, tone: "text-success", icon: ShieldCheck },
            { id: "inactive", label: "Inactive links", value: inactive, tone: "text-warning-foreground", icon: ShieldOff },
            { id: "missing", label: "Not generated", value: missing, tone: "text-muted-foreground" },
          ]}
        />
      </div>

      <motion.div variants={ticketSectionVariants} initial="hidden" animate="show">
        <DesignTicketSection title="Portal Access by Account" compact>
          <div className="card-soft overflow-hidden p-0.5">
            <DataTable
              data={rows}
              getRowId={(r) => r.id}
              searchKeys={["accountName", "slug", "url"]}
              pageSize={15}
              density="compact"
              columns={[
                {
                  key: "accountName",
                  header: "Account",
                  render: (r) => <span className="font-medium">{r.accountName}</span>,
                  sortable: true,
                },
                {
                  key: "slug",
                  header: "Slug",
                  render: (r) =>
                    r.hasPortal ? (
                      <code className="rounded bg-muted px-1.5 py-px text-[11px]">{r.slug}</code>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    ),
                  sortable: true,
                },
                {
                  key: "url",
                  header: "Portal Link",
                  render: (r) =>
                    r.hasPortal ? (
                      <span className="line-clamp-1 max-w-[360px] font-mono text-[11px]">{r.url}</span>
                    ) : (
                      <span className="text-muted-foreground">Not generated yet</span>
                    ),
                },
                {
                  key: "isActive",
                  header: "Status",
                  render: (r) =>
                    r.hasPortal ? (
                      <span
                        className={`inline-flex rounded px-1.5 py-px text-[10px] font-medium ${
                          r.isActive
                            ? "bg-success/15 text-success"
                            : "bg-warning/15 text-warning-foreground"
                        }`}
                      >
                        {r.isActive ? "Active" : "Inactive"}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Unavailable</span>
                    ),
                },
              ]}
              actions={(r) => (
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    disabled={!r.hasPortal}
                    onClick={() => void copy(r.url)}
                  >
                    <Copy className="mr-1 h-3 w-3" />
                    Copy
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" asChild>
                    <Link to="/crm/accounts/$accountId" params={{ accountId: r.id }}>
                      Account
                    </Link>
                  </Button>
                  <label className="inline-flex h-7 items-center gap-1.5 rounded border px-2 text-xs">
                    <input
                      type="checkbox"
                      checked={r.isActive}
                      disabled={!r.hasPortal}
                      onChange={(e) => {
                        setActive(r.id, e.target.checked);
                        toast.success(e.target.checked ? "Portal activated" : "Portal deactivated");
                      }}
                    />
                    Active
                  </label>
                </div>
              )}
            />
          </div>
        </DesignTicketSection>
      </motion.div>

      <div className="mt-3">
        <DesignTicketInfoBanner compact>
          Portal links are shared with clients. After regenerating a link on an account, old URLs stop
          working.
        </DesignTicketInfoBanner>
      </div>
    </PageWrap>
  );
}
