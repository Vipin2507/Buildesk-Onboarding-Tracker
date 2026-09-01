import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import {
  DesignTicketSection,
  TICKET_EASE,
} from "@/components/design-ticket/design-ticket-shared";
import { Button } from "@/components/ui/button";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import { portalPublicBookUrl } from "@/lib/design-ticket-portal";
import { getBookingSummaryForCompany } from "@/lib/api";
import {
  useAuthStore,
  useBookingStore,
  useCompanyPortalStore,
  useCrmAccountStore,
} from "@/stores";

export function CrmAccountMeetingsPanel({ accountId }: { accountId: string }) {
  const user = useAuthStore((s) => s.user);
  const account = useCrmAccountStore((s) => s.getById(accountId));
  const portal = useCompanyPortalStore((s) => s.getByCompanyId(accountId));
  const generateAccess = useCompanyPortalStore((s) => s.generateAccessForCompany);
  const ensureDefaults = useBookingStore((s) => s.ensureDefaults);
  const storePending = useBookingStore(
    (s) => s.appointments.filter((a) => a.companyId === accountId && a.status === "pending").length,
  );
  const storeUpcoming = useBookingStore((s) => {
    const nowIso = new Date().toISOString().slice(0, 19);
    return s.appointments.filter(
      (a) =>
        a.companyId === accountId &&
        (a.status === "confirmed" || a.status === "postponed") &&
        a.startsAt >= nowIso,
    ).length;
  });
  const [bookingSummary, setBookingSummary] = useState<{ pending: number; upcoming: number } | null>(
    null,
  );
  const pendingCount = bookingSummary?.pending ?? storePending;
  const upcomingCount = bookingSummary?.upcoming ?? storeUpcoming;

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
    if (!account || !user) return;
    void ensureDefaults(account.id).catch(() => undefined);
    void getBookingSummaryForCompany({ data: { companyId: account.id } })
      .then((s) => setBookingSummary({ pending: s.pending, upcoming: s.upcoming }))
      .catch(() => undefined);
  }, [account, ensureDefaults, user]);

  if (!account) return null;

  if (!portal) {
    return (
      <div className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
        Setting up meeting portal access…
      </div>
    );
  }

  const bookUrl = portalPublicBookUrl(portal.slug);

  return (
    <div className="space-y-2.5">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: TICKET_EASE }}
        className="card-soft space-y-2 p-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold">Book-a-call portal link</div>
            <p className="text-[10px] text-muted-foreground">
              Share with {account.name} so they can request meetings from the client portal.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
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
              Copy link
            </Button>
            <Button type="button" size="sm" variant="secondary" className="h-8 gap-1 text-xs" asChild>
              <a href={bookUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Open portal
              </a>
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" asChild>
              <Link to="/crm/bookings">Manage all meetings</Link>
            </Button>
          </div>
        </div>
        <p className="break-all font-mono text-[10px] text-muted-foreground">{bookUrl}</p>
      </motion.div>

      <DesignTicketSection compact title="Meeting summary">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="card-soft p-2.5">
            <div className="text-[10px] text-muted-foreground">Pending approval</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums">{pendingCount}</div>
          </div>
          <div className="card-soft p-2.5">
            <div className="text-[10px] text-muted-foreground">Upcoming confirmed</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums">{upcomingCount}</div>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Approve, reschedule, or decline requests from{" "}
          <Link to="/crm/bookings" search={{ tab: "pending" }} className="text-primary hover:underline">
            CRM Meetings
          </Link>
          .
        </p>
      </DesignTicketSection>
    </div>
  );
}
