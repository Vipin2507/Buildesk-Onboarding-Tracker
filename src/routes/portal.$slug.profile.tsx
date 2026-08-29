import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft, Copy } from "lucide-react";
import { toast } from "sonner";

import {
  DesignTicketFormCard,
  DesignTicketFormField,
  DesignTicketPageHeader,
  PortalPageWrap,
  ticketFieldClass,
  ticketPageVariants,
  ticketSectionVariants,
} from "@/components/design-ticket/design-ticket-shared";
import { Button } from "@/components/ui/button";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import { portalPublicCreateUrl } from "@/lib/design-ticket-portal";
import { isValidEmail } from "@/lib/utils";
import { useCompanyPortalStore } from "@/stores/useCompanyPortalStore";

export const Route = createFileRoute("/portal/$slug/profile")({
  component: PortalProfile,
});

function PortalProfile() {
  const { slug } = Route.useParams();
  const access = useCompanyPortalStore((s) => s.getBySlug(slug));
  const updateContact = useCompanyPortalStore((s) => s.updateContact);

  if (!access) return null;

  const portalUrl = portalPublicCreateUrl(slug);

  async function copyLink() {
    const ok = await copyTextToClipboard(portalUrl);
    toast.success(ok ? "Portal link copied" : "Could not copy — select the link manually");
  }

  return (
    <PortalPageWrap>
      <motion.div variants={ticketPageVariants} initial="hidden" animate="show" className="space-y-4">
        <motion.div variants={ticketSectionVariants}>
          <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground" asChild>
            <Link to="/portal/$slug/dashboard" params={{ slug }}>
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        </motion.div>

        <motion.div variants={ticketSectionVariants}>
          <DesignTicketPageHeader
            title="Profile"
            subtitle="Your contact details for this client portal."
          />
        </motion.div>

        <motion.div variants={ticketSectionVariants}>
          <DesignTicketFormCard>
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Company
              </div>
              <div className="mt-0.5 font-semibold">{access.companyName}</div>
            </div>

            <DesignTicketFormField label="Contact name">
              <input
                defaultValue={access.contactName}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== access.contactName) {
                    updateContact(access.companyId, { contactName: v });
                    toast.success("Profile updated");
                  }
                }}
                className={ticketFieldClass}
              />
            </DesignTicketFormField>

            <DesignTicketFormField label="Email" required hint="Required for meeting confirmations.">
              <input
                type="email"
                defaultValue={access.contactEmail}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (!v) {
                    toast.error("Email is required");
                    e.target.value = access.contactEmail;
                    return;
                  }
                  if (!isValidEmail(v)) {
                    toast.error("Enter a valid email address");
                    e.target.value = access.contactEmail;
                    return;
                  }
                  if (v !== access.contactEmail) {
                    updateContact(access.companyId, { contactEmail: v });
                    toast.success("Profile updated");
                  }
                }}
                className={ticketFieldClass}
                required
              />
            </DesignTicketFormField>

            <div>
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Your portal link
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="min-w-0 flex-1 break-all rounded-lg border bg-muted/30 p-2.5 font-mono text-xs">
                  {portalUrl}
                </div>
                <Button type="button" variant="outline" className="shrink-0 gap-1.5" onClick={() => void copyLink()}>
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
              </div>
            </div>

            <Button type="button" variant="outline" className="w-full sm:w-auto" asChild>
              <Link to="/portal/$slug/dashboard" params={{ slug }}>
                Back to dashboard
              </Link>
            </Button>
          </DesignTicketFormCard>
        </motion.div>
      </motion.div>
    </PortalPageWrap>
  );
}
