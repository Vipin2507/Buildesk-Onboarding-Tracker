import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Copy, Link2, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import {
  DesignTicketKpiGrid,
  DesignTicketPageHeader,
  DesignTicketSection,
  DesignTicketInfoBanner,
  InternalTicketsNav,
  ticketSectionVariants,
} from "@/components/design-ticket/design-ticket-shared";
import { DesignTicketSelect } from "@/components/design-ticket/design-ticket-fields";
import { DataTable } from "@/components/data-table";
import { PageWrap } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { isValidPortalSlug, portalPublicCreateUrl } from "@/lib/design-ticket-portal";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import { cn } from "@/lib/utils";
import { useCompanyPortalStore, useCompanyStore } from "@/stores";

export const Route = createFileRoute("/tickets/links")({
  component: TicketLinksPage,
});

type PortalApiFilter = "all" | "has_api" | "no_api" | "inactive";

function hasProperPortalApi(row: { hasPortal: boolean; slug: string; isActive: boolean }) {
  if (!row.hasPortal || !row.isActive) return false;
  const slug = row.slug.trim();
  if (!slug || !isValidPortalSlug(slug)) return false;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)) {
    return false;
  }
  return true;
}

function TicketLinksPage() {
  const companies = useCompanyStore((s) => s.companies);
  const access = useCompanyPortalStore((s) => s.access);
  const setActive = useCompanyPortalStore((s) => s.setActive);
  const generateAccess = useCompanyPortalStore((s) => s.generateAccessForCompany);
  const [apiFilter, setApiFilter] = useState<PortalApiFilter>("all");

  const rows = useMemo(
    () =>
      companies.map((c) => {
        const portal = access.find((a) => a.companyId === c.id);
        return {
          id: c.id,
          companyName: c.name,
          contact: c.contact,
          email: c.email,
          slug: portal?.slug ?? "",
          url: portal ? portalPublicCreateUrl(portal.slug) : "—",
          isActive: portal?.isActive ?? false,
          hasPortal: Boolean(portal),
        };
      }),
    [companies, access],
  );

  const total = rows.length;
  const active = rows.filter((r) => hasProperPortalApi(r)).length;
  const inactive = rows.filter((r) => r.hasPortal && !r.isActive).length;
  const noApi = rows.filter((r) => !hasProperPortalApi(r)).length;

  const filteredRows = useMemo(() => {
    if (apiFilter === "has_api") return rows.filter((r) => hasProperPortalApi(r));
    if (apiFilter === "no_api") return rows.filter((r) => !hasProperPortalApi(r));
    if (apiFilter === "inactive") return rows.filter((r) => r.hasPortal && !r.isActive);
    return rows;
  }, [rows, apiFilter]);

  async function copy(url: string) {
    const ok = await copyTextToClipboard(url);
    if (ok) {
      toast.success("Link copied");
      return;
    }
    toast.error("Auto-copy blocked. Please copy manually.");
  }

  return (
    <PageWrap compact>
      <DesignTicketPageHeader
        compact
        title="Company Portal Links"
        subtitle="Share secure ticket links with clients and control portal access from one place."
      />

      <InternalTicketsNav compact />

      <div className="mb-3">
        <DesignTicketKpiGrid
          size="compact"
          columns={4}
          items={[
            {
              id: "total",
              label: "Companies",
              value: total,
              icon: Link2,
              onClick: () => setApiFilter("all"),
              active: apiFilter === "all",
            },
            {
              id: "active",
              label: "Active links",
              value: active,
              tone: "text-success",
              icon: ShieldCheck,
              onClick: () => setApiFilter("has_api"),
              active: apiFilter === "has_api",
            },
            {
              id: "inactive",
              label: "Inactive links",
              value: inactive,
              tone: "text-warning-foreground",
              icon: ShieldOff,
              onClick: () => setApiFilter("inactive"),
              active: apiFilter === "inactive",
            },
            {
              id: "missing",
              label: "No API key",
              value: noApi,
              tone: "text-destructive",
              onClick: () => setApiFilter("no_api"),
              active: apiFilter === "no_api",
            },
          ]}
        />
      </div>

      <motion.div variants={ticketSectionVariants} initial="hidden" animate="show">
        <DesignTicketSection title="Portal Access by Company" compact>
          <div className="mb-2 flex flex-wrap items-center gap-2 px-0.5">
            <label className="text-[11px] font-medium text-muted-foreground">API status</label>
            <div className="w-[12rem]">
              <DesignTicketSelect
                compact
                value={apiFilter}
                onChange={(v) => setApiFilter(v as PortalApiFilter)}
                options={[
                  { value: "all", label: "All companies" },
                  { value: "has_api", label: "Has proper API" },
                  { value: "no_api", label: "No proper API" },
                  { value: "inactive", label: "Inactive only" },
                ]}
              />
            </div>
            {apiFilter !== "all" ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={() => setApiFilter("all")}
              >
                Clear filter
              </Button>
            ) : null}
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {filteredRows.length} shown
            </span>
          </div>
          <div className="card-soft overflow-hidden p-0.5">
            <DataTable
              data={filteredRows}
              getRowId={(r) => r.id}
              searchKeys={["companyName", "slug", "url"]}
              pageSize={15}
              density="compact"
              columns={[
                {
                  key: "companyName",
                  header: "Company",
                  render: (r) => <span className="font-medium">{r.companyName}</span>,
                  sortable: true,
                },
                {
                  key: "slug",
                  header: "API key / Slug",
                  render: (r) =>
                    r.hasPortal ? (
                      <code
                        className={cn(
                          "rounded px-1.5 py-px text-[11px]",
                          hasProperPortalApi(r) ? "bg-muted" : "bg-destructive/10 text-destructive",
                        )}
                      >
                        {r.slug || "—"}
                      </code>
                    ) : (
                      <span className="text-muted-foreground">Not set</span>
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
                  render: (r) => {
                    if (!r.hasPortal) {
                      return <span className="text-muted-foreground">No API</span>;
                    }
                    if (!hasProperPortalApi(r)) {
                      return (
                        <span className="inline-flex rounded bg-destructive/15 px-1.5 py-px text-[10px] font-medium text-destructive">
                          {r.isActive ? "Invalid API" : "Inactive"}
                        </span>
                      );
                    }
                    return (
                      <span className="inline-flex rounded bg-success/15 px-1.5 py-px text-[10px] font-medium text-success">
                        Active
                      </span>
                    );
                  },
                },
              ]}
              actions={(r) => (
                <div className="flex items-center justify-end gap-1.5">
                  {!r.hasPortal ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        generateAccess({
                          id: r.id,
                          name: r.companyName,
                          contact: r.contact,
                          email: r.email,
                        });
                        toast.success("Portal API key generated");
                      }}
                    >
                      Generate API
                    </Button>
                  ) : null}
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
          Use <strong>No API key</strong> to find companies without a portal key or with an inactive /
          invalid link.
        </DesignTicketInfoBanner>
      </div>
    </PageWrap>
  );
}
