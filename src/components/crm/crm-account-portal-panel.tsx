import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Copy, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import {
  DesignTicketPriorityChip,
  DesignTicketStatusPill,
} from "@/components/design-ticket/design-ticket-chips";
import {
  DesignTicketKpiGrid,
  DesignTicketSection,
  TICKET_EASE,
} from "@/components/design-ticket/design-ticket-shared";
import { ConfirmDeleteDialog } from "@/components/entity-form-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copyTextToClipboard, selectInputText } from "@/lib/copy-to-clipboard";
import {
  portalCreatePath,
  portalPublicBookUrl,
  portalPublicCreateUrl,
  portalPublicDashboardUrl,
} from "@/lib/design-ticket-portal";
import { formatDate } from "@/lib/utils";
import {
  useBookingStore,
  useCompanyPortalStore,
  useCrmAccountStore,
  useDesignTicketStats,
  useDesignTicketsForCompany,
  useDesignTicketStore,
} from "@/stores";
import { getBookingSummaryForCompany } from "@/lib/api";
import type { DesignTicket } from "@/types/design-ticket";

export function CrmAccountPortalPanel({ accountId }: { accountId: string }) {
  const account = useCrmAccountStore((s) => s.getById(accountId));
  const portal = useCompanyPortalStore((s) => s.getByCompanyId(accountId));
  const generateAccess = useCompanyPortalStore((s) => s.generateAccessForCompany);
  const regenerateSlug = useCompanyPortalStore((s) => s.regenerateSlug);
  const ensureDefaults = useBookingStore((s) => s.ensureDefaults);
  const tickets = useDesignTicketsForCompany(accountId);
  const stats = useDesignTicketStats(accountId);
  const deleteTicket = useDesignTicketStore((s) => s.deleteTicket);
  const [regenOpen, setRegenOpen] = useState(false);
  const [bookingSummary, setBookingSummary] = useState({ pending: 0, upcoming: 0 });

  useEffect(() => {
    if (!account) return;
    generateAccess({
      id: account.id,
      name: account.name,
      contact: account.contact,
      email: account.email,
    });
  }, [account, generateAccess]);

  useEffect(() => {
    if (!account) return;
    void ensureDefaults(account.id).catch(() => undefined);
    void getBookingSummaryForCompany({ data: { companyId: account.id } })
      .then((s) => setBookingSummary({ pending: s.pending, upcoming: s.upcoming }))
      .catch(() => undefined);
  }, [account, ensureDefaults]);

  const publicUrl = portal ? portalPublicCreateUrl(portal.slug) : "";
  const previewUrl = portal ? portalPublicDashboardUrl(portal.slug) : "";
  const bookUrl = portal ? portalPublicBookUrl(portal.slug) : "";

  const enriched = useMemo(
    () => tickets.map((t) => ({ ...t })),
    [tickets],
  );

  async function copyLink(inputEl?: HTMLInputElement | null) {
    if (!publicUrl) return;
    const ok = await copyTextToClipboard(publicUrl);
    if (ok) {
      toast.success("CRM portal link copied");
      return;
    }
    if (inputEl) selectInputText(inputEl);
    toast.error("Auto-copy blocked — link selected, press Ctrl+C / Cmd+C");
  }

  if (!account) return null;

  if (!portal) {
    return (
      <div className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
        Setting up CRM portal access…
      </div>
    );
  }

  const kpiCards = [
    { id: "open", label: "Open", value: stats.open, tone: "text-info" },
    { id: "in-progress", label: "In Progress", value: stats.inProgress, tone: "text-warning-foreground" },
    { id: "resolved", label: "Resolved", value: stats.resolved, tone: "text-success" },
    { id: "closed", label: "Closed", value: stats.closed, tone: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-2.5">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: TICKET_EASE }}
        className="card-soft space-y-2 p-3"
      >
        <div className="text-xs font-semibold">Client portal link</div>
        <p className="text-[10px] text-muted-foreground">
          Share this link with {account.name} so they can raise tickets from their portal.
        </p>
        <div className="flex flex-col gap-1.5 sm:flex-row">
          <Input
            readOnly
            value={publicUrl}
            className="h-8 font-mono text-xs"
            onFocus={(e) => selectInputText(e.currentTarget)}
          />
          <div className="flex shrink-0 flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              onClick={(e) => {
                const input = e.currentTarget.closest(".card-soft")?.querySelector("input");
                void copyLink(input instanceof HTMLInputElement ? input : null);
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              onClick={() => setRegenOpen(true)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate
            </Button>
            <Button type="button" size="sm" variant="secondary" className="h-8 gap-1 text-xs" asChild>
              <a href={previewUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Preview
              </a>
            </Button>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Shareable links point to{" "}
          <span className="font-mono">
            {publicUrl.replace(portalCreatePath(portal.slug), "") || "this site"}
          </span>
          . Update <code className="rounded bg-muted px-1">VITE_PORTAL_BASE_URL</code> if the host
          changes.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: TICKET_EASE, delay: 0.05 }}
        className="card-soft space-y-2 p-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold">Bookings</div>
            <p className="text-[10px] text-muted-foreground">
              {bookingSummary.pending} pending · {bookingSummary.upcoming} upcoming
            </p>
          </div>
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              onClick={async () => {
                if (!bookUrl) return;
                const ok = await copyTextToClipboard(bookUrl);
                toast[ok ? "success" : "error"](
                  ok ? "Book-a-call link copied" : "Copy failed — select the URL manually",
                );
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy book link
            </Button>
            <Button type="button" size="sm" variant="secondary" className="h-8 gap-1 text-xs" asChild>
              <a href={bookUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Open
              </a>
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" asChild>
              <Link to="/crm/bookings">Manage</Link>
            </Button>
          </div>
        </div>
      </motion.div>

      <DesignTicketKpiGrid items={kpiCards} columns={4} size="compact" />

      <DesignTicketSection
        compact
        title="Portal tickets"
        action={
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {enriched.length} total
          </span>
        }
      >
        {enriched.length === 0 ? (
          <EmptyState
            title="No portal tickets yet"
            description="When the client creates a ticket from their portal link, it will appear here."
          />
        ) : (
          <div className="card-soft overflow-hidden p-0.5">
            <DataTable
              data={enriched}
              getRowId={(r) => r.id}
              hideSearch
              pageSize={8}
              density="compact"
              columns={[
                {
                  key: "ticketNumber",
                  header: "Ticket ID",
                  render: (r) => r.ticketNumber,
                  sortable: true,
                },
                { key: "subject", header: "Subject", render: (r) => r.subject, sortable: true },
                {
                  key: "priority",
                  header: "Priority",
                  render: (r) => <DesignTicketPriorityChip priority={r.priority} />,
                },
                {
                  key: "status",
                  header: "Status",
                  render: (r) => <DesignTicketStatusPill status={r.status} />,
                },
                {
                  key: "createdAt",
                  header: "Created",
                  render: (r) => formatDate(r.createdAt),
                  sortable: true,
                },
              ]}
              actions={(row: DesignTicket) => (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteTicket(row.id);
                    toast.success("Ticket deleted");
                  }}
                >
                  Delete
                </Button>
              )}
            />
          </div>
        )}
      </DesignTicketSection>

      <p className="text-center text-[10px] text-muted-foreground">
        Internal CRM implementation tickets stay in{" "}
        <Link to="/crm/support" className="text-primary hover:underline">
          Support Desk
        </Link>
        .
      </p>

      <ConfirmDeleteDialog
        open={regenOpen}
        onOpenChange={setRegenOpen}
        title="Regenerate portal link?"
        description="The current client link will stop working. Share the new link with your client after regenerating."
        confirmLabel="Regenerate"
        confirmTone="default"
        onConfirm={() => {
          regenerateSlug(accountId);
          toast.success("Portal link regenerated — old links are now invalid");
          setRegenOpen(false);
        }}
      />
    </div>
  );
}
