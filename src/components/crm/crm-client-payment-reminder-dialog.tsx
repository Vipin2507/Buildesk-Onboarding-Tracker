import { useEffect, useState } from "react";
import { Bell, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  usePreviewCrmPaymentClientReminder,
  useRemindCrmPayment,
} from "@/hooks/use-crm-payments";
import { refreshAutomationLogsInStore } from "@/lib/automation-log-sync";
import type { PaymentClientReminderPreview } from "@/lib/crm-payment-client-reminder";

function parseCcList(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function CrmClientPaymentReminderDialog({
  open,
  onOpenChange,
  accountId,
  accountName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountName: string;
}) {
  const previewMutation = usePreviewCrmPaymentClientReminder();
  const sendMutation = useRemindCrmPayment();

  const [preview, setPreview] = useState<PaymentClientReminderPreview | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [extraCc, setExtraCc] = useState("");

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setRecipientName("");
      setRecipientEmail("");
      setSubject("");
      setBody("");
      setExtraCc("");
      return;
    }

    void (async () => {
      try {
        const data = await previewMutation.mutateAsync(accountId);
        setPreview(data);
        setRecipientName(data.recipientName);
        setRecipientEmail(data.recipientEmail);
        setSubject(data.subject);
        setBody(data.body);
        setExtraCc("");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load reminder preview");
        onOpenChange(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when dialog opens for account
  }, [open, accountId]);

  async function handleSend() {
    const email = recipientEmail.trim();
    if (!email) {
      toast.error("Recipient email is required");
      return;
    }
    if (!subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    if (!body.trim()) {
      toast.error("Message body is required");
      return;
    }

    try {
      await sendMutation.mutateAsync({
        accountId,
        recipientName: recipientName.trim() || undefined,
        recipientEmail: email,
        subject: subject.trim(),
        body: body.trim(),
        extraCc: parseCcList(extraCc),
      });
      toast.success("Client payment reminder sent");
      void refreshAutomationLogsInStore("crm-automation");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send client reminder");
    }
  }

  const loading = open && !preview && previewMutation.isPending;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <AlertDialogHeader className="shrink-0 border-b px-5 py-4 text-left">
          <AlertDialogTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Remind client
          </AlertDialogTitle>
          <AlertDialogDescription>
            Review and edit the payment reminder for{" "}
            <span className="font-medium text-foreground">{accountName}</span> before sending.
            Uses the active Payment reminder (client) email rule in CRM Automation.
            {preview?.ruleName ? (
              <span className="mt-1 block text-[11px]">Rule: {preview.ruleName}</span>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading preview…
            </div>
          ) : null}

          {preview ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="client-remind-name" className="text-xs">
                    Recipient name
                  </Label>
                  <Input
                    id="client-remind-name"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="client-remind-email" className="text-xs">
                    Recipient email
                  </Label>
                  <Input
                    id="client-remind-email"
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="h-8 text-xs"
                    placeholder="client@example.com"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client-remind-cc" className="text-xs">
                  Extra CC
                </Label>
                <Input
                  id="client-remind-cc"
                  value={extraCc}
                  onChange={(e) => setExtraCc(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="optional@example.com, another@example.com"
                />
                {preview.defaultCc ? (
                  <p className="flex items-start gap-1 text-[10px] text-muted-foreground">
                    <Mail className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>
                      Automation CC (always included): {preview.defaultCc}
                    </span>
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground">
                    No default CC from CRM Automation. Add addresses above if needed.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client-remind-subject" className="text-xs">
                  Subject
                </Label>
                <Input
                  id="client-remind-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client-remind-body" className="text-xs">
                  Message
                </Label>
                <Textarea
                  id="client-remind-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="min-h-[180px] resize-y text-xs"
                />
              </div>
            </>
          ) : null}
        </div>

        <AlertDialogFooter className="shrink-0 border-t px-5 py-3">
          <AlertDialogCancel disabled={sendMutation.isPending}>Cancel</AlertDialogCancel>
          <Button
            disabled={sendMutation.isPending || loading || !preview}
            onClick={() => void handleSend()}
          >
            {sendMutation.isPending ? (
              <>
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                Sending…
              </>
            ) : (
              "Send reminder"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
