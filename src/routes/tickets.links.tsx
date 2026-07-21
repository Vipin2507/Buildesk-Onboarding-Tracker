import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import {
  DesignTicketPageHeader,
  InternalTicketsNav,
  TICKET_EASE,
} from "@/components/design-ticket/design-ticket-shared";
import { PageWrap } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { portalPublicCreateUrl } from "@/lib/design-ticket-portal";
import { copyTextToClipboard, selectInputText } from "@/lib/copy-to-clipboard";
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

  async function copy(url: string, inputEl?: HTMLInputElement | null) {
    const ok = await copyTextToClipboard(url);
    if (ok) {
      toast.success("Link copied");
      return;
    }
    if (inputEl) selectInputText(inputEl);
    toast.error("Auto-copy blocked — link selected, press Ctrl+C / Cmd+C");
  }

  return (
    <PageWrap>
      <DesignTicketPageHeader
        title="Company Portal Links"
        subtitle="Unique ticket creation links per company — share with clients to enable self-service."
      />

      <InternalTicketsNav />

      <div className="space-y-3">
        {rows.map(({ company, portal }, i) => {
          const url = portal ? portalPublicCreateUrl(portal.slug) : "—";
          return (
            <motion.div
              key={company.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: Math.min(i * 0.04, 0.2), ease: TICKET_EASE }}
              className="card-soft flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium">{company.name}</div>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <Input
                    readOnly
                    value={url}
                    className="h-10 font-mono text-xs"
                    onFocus={(e) => selectInputText(e.currentTarget)}
                  />
                  {portal ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 gap-1.5 sm:w-auto"
                      onClick={(e) => {
                        const input = e.currentTarget
                          .closest(".card-soft")
                          ?.querySelector("input");
                        void copy(url, input instanceof HTMLInputElement ? input : null);
                      }}
                    >
                      <Copy className="h-4 w-4" />
                      Copy
                    </Button>
                  ) : null}
                </div>
              </div>
              {portal ? (
                <label className="flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm">
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
            </motion.div>
          );
        })}
      </div>
    </PageWrap>
  );
}
