import { useEffect, useMemo, useState } from "react";
import { Loader2, Mail, Users } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  buildDeliveriesFromSelection,
  formatExecutivePaymentDigestMessage,
  type ExecutiveOverdueDigestPreview,
} from "@/lib/crm-payment-executive-digest";
import {
  usePreviewExecutivePaymentDigest,
  useSendExecutivePaymentDigest,
} from "@/hooks/use-crm-payments";
import { refreshAutomationLogsInStore } from "@/lib/automation-log-sync";
import { cn, formatDate, formatInr } from "@/lib/utils";

export function CrmExecutivePaymentReminderDialog({
  open,
  onOpenChange,
  accountIdsScope,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, digest is limited to these overdue accounts (e.g. table selection). */
  accountIdsScope?: string[];
}) {
  const previewMutation = usePreviewExecutivePaymentDigest();
  const sendMutation = useSendExecutivePaymentDigest();

  const [preview, setPreview] = useState<ExecutiveOverdueDigestPreview | null>(null);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(() => new Set());
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<Set<string>>(() => new Set());
  const [previewRecipientId, setPreviewRecipientId] = useState<string>("");

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setSelectedAccountIds(new Set());
      setSelectedRecipientIds(new Set());
      setPreviewRecipientId("");
      return;
    }

    void (async () => {
      try {
        const data = await previewMutation.mutateAsync(accountIdsScope);
        setPreview(data);
        setSelectedAccountIds(new Set(data.accounts.map((a) => a.accountId)));
        setSelectedRecipientIds(new Set(data.recipients.map((r) => r.userId)));
        setPreviewRecipientId(data.recipients[0]?.userId ?? "");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load digest preview");
        onOpenChange(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when dialog opens or scope changes
  }, [open, accountIdsScope?.join(",")]);

  const deliveries = useMemo(() => {
    if (!preview) return [];
    return buildDeliveriesFromSelection({
      recipients: preview.recipients,
      selectedRecipientIds,
      selectedAccountIds,
    });
  }, [preview, selectedRecipientIds, selectedAccountIds]);

  const messagePreview = useMemo(() => {
    if (!preview || !previewRecipientId) return null;
    const recipient = preview.recipients.find((r) => r.userId === previewRecipientId);
    if (!recipient) return null;
    const accounts = preview.accounts.filter(
      (a) =>
        selectedAccountIds.has(a.accountId) && recipient.accountIds.includes(a.accountId),
    );
    return formatExecutivePaymentDigestMessage(recipient.name, accounts);
  }, [preview, previewRecipientId, selectedAccountIds]);

  function toggleAccount(id: string, checked: boolean) {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleRecipient(id: string, checked: boolean) {
    setSelectedRecipientIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllAccounts(checked: boolean) {
    if (!preview) return;
    setSelectedAccountIds(
      checked ? new Set(preview.accounts.map((a) => a.accountId)) : new Set(),
    );
  }

  function toggleAllRecipients(checked: boolean) {
    if (!preview) return;
    setSelectedRecipientIds(
      checked ? new Set(preview.recipients.map((r) => r.userId)) : new Set(),
    );
  }

  async function handleSend() {
    if (deliveries.length === 0) {
      toast.error("Select at least one recipient with overdue accounts");
      return;
    }
    try {
      const res = await sendMutation.mutateAsync(deliveries);
      if (res.sent === 0) {
        toast.error(res.failed ? "All digest emails failed — check CRM automation" : "Nothing sent");
        return;
      }
      toast.success(
        `Sent ${res.sent} digest${res.sent === 1 ? "" : "s"}` +
          (res.failed > 0 ? ` · ${res.failed} failed` : ""),
      );
      void refreshAutomationLogsInStore("crm-automation");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send digest");
    }
  }

  const loading = open && !preview && previewMutation.isPending;
  const totalMessages = deliveries.length;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <AlertDialogHeader className="shrink-0 border-b px-5 py-4 text-left">
          <AlertDialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Remind executives — overdue digest
          </AlertDialogTitle>
          <AlertDialogDescription>
            One consolidated message per person (admins, sales manager, support 1 / 2) via the active
            Payment reminder (executive) email and WhatsApp rules in CRM Automation. Each person
            only sees overdue accounts they are tied to (with sales manager and support 1 / 2 per
            account). Each recipient gets email then WhatsApp with a short pause (~400ms) between
            channels; another pause between recipients.
            {accountIdsScope?.length
              ? ` Scope: ${accountIdsScope.length} selected account(s).`
              : " Scope: all overdue accounts you can view."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Building digest…
            </div>
          ) : null}

          {preview && preview.accounts.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              No overdue accounts in this scope. Change filters or select overdue rows first.
            </p>
          ) : null}

          {preview && preview.accounts.length > 0 ? (
            <>
              <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs">
                <span className="font-medium text-foreground">{totalMessages}</span> recipient
                {totalMessages === 1 ? "" : "s"} (email + WhatsApp per automation rules) ·{" "}
                <span className="font-medium">{selectedAccountIds.size}</span> account
                {selectedAccountIds.size === 1 ? "" : "s"} ·{" "}
                <span className="font-medium">{selectedRecipientIds.size}</span> recipient
                {selectedRecipientIds.size === 1 ? "" : "s"}
              </div>

              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Overdue accounts
                  </h3>
                  <div className="flex items-center gap-2 text-xs">
                    <Checkbox
                      id="digest-all-accounts"
                      checked={
                        preview.accounts.length > 0 &&
                        selectedAccountIds.size === preview.accounts.length
                      }
                      onCheckedChange={(v) => toggleAllAccounts(v === true)}
                    />
                    <Label htmlFor="digest-all-accounts" className="text-xs font-normal">
                      Select all
                    </Label>
                  </div>
                </div>
                <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border p-2">
                  {preview.accounts.map((a) => (
                    <label
                      key={a.accountId}
                      className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={selectedAccountIds.has(a.accountId)}
                        onCheckedChange={(v) => toggleAccount(a.accountId, v === true)}
                      />
                      <span className="min-w-0 flex-1 text-xs">
                        <span className="font-medium">{a.accountName}</span>
                        <span className="mt-0.5 block text-muted-foreground">
                          Overdue {formatInr(a.overdueAmount)}
                          {a.overdueDays != null ? ` · ${a.overdueDays}d` : ""}
                          {a.dueDate ? ` · Due ${formatDate(a.dueDate)}` : ""}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-muted-foreground">
                          SM: {a.salesManager?.trim() || "—"} · S1: {a.supportManager1?.trim() || "—"} · S2:{" "}
                          {a.supportManager2?.trim() || "—"}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Recipients
                  </h3>
                  <div className="flex items-center gap-2 text-xs">
                    <Checkbox
                      id="digest-all-recipients"
                      checked={
                        preview.recipients.length > 0 &&
                        selectedRecipientIds.size === preview.recipients.length
                      }
                      onCheckedChange={(v) => toggleAllRecipients(v === true)}
                    />
                    <Label htmlFor="digest-all-recipients" className="text-xs font-normal">
                      Select all
                    </Label>
                  </div>
                </div>
                {preview.recipients.length === 0 ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    No recipients with email — assign sales / support managers on accounts and ensure
                    CRM users have work emails.
                  </p>
                ) : (
                  <div className="space-y-1 rounded-lg border p-2">
                    {preview.recipients.map((r) => {
                      const count = r.accountIds.filter((id) => selectedAccountIds.has(id)).length;
                      const checked = selectedRecipientIds.has(r.userId);
                      return (
                        <label
                          key={r.userId}
                          className={cn(
                            "flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40",
                            count === 0 && "opacity-50",
                          )}
                        >
                          <Checkbox
                            checked={checked && count > 0}
                            disabled={count === 0}
                            onCheckedChange={(v) => toggleRecipient(r.userId, v === true)}
                          />
                          <span className="min-w-0 flex-1 text-xs">
                            <span className="font-medium">{r.name}</span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-muted-foreground">
                              <Mail className="inline h-3 w-3" />
                              {r.email}
                              <span>· {r.roles.join(", ")}</span>
                              <span>· {count} account{count === 1 ? "" : "s"} in digest</span>
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </section>

              {preview.recipients.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Message preview
                  </h3>
                  <select
                    className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                    value={previewRecipientId}
                    onChange={(e) => setPreviewRecipientId(e.target.value)}
                  >
                    {preview.recipients.map((r) => (
                      <option key={r.userId} value={r.userId}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  {messagePreview ? (
                    <div className="rounded-lg border bg-muted/15 p-3 text-xs">
                      <div className="mb-2 font-medium">{messagePreview.subject}</div>
                      <pre className="whitespace-pre-wrap font-sans text-muted-foreground">
                        {messagePreview.body}
                      </pre>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </>
          ) : null}
        </div>

        <AlertDialogFooter className="shrink-0 border-t px-5 py-3">
          <AlertDialogCancel disabled={sendMutation.isPending}>Cancel</AlertDialogCancel>
          <Button
            disabled={
              sendMutation.isPending ||
              loading ||
              !preview ||
              preview.accounts.length === 0 ||
              totalMessages === 0
            }
            onClick={() => void handleSend()}
          >
            {sendMutation.isPending ? (
              <>
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                Sending…
              </>
            ) : (
              `Send ${totalMessages} digest${totalMessages === 1 ? "" : "s"}`
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
