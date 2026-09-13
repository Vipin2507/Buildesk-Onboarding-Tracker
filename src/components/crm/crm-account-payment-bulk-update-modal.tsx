import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
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
import {
  buildCrmAccountPaymentImportPlan,
  downloadCrmAccountPaymentImportTemplate,
  mergeCrmAccountPaymentImportRow,
  parseCrmAccountPaymentImportFile,
  type CrmAccountPaymentImportPlan,
  type CrmAccountPaymentPickOverrides,
} from "@/lib/crm-account-payment-sheet-import";
import { crmPaymentsKeys } from "@/hooks/use-crm-payments";
import { cn, formatDate, formatInr } from "@/lib/utils";
import { useCrmAccountStore } from "@/stores";

const UNSET_PICK = "__unset__";

export function CrmAccountPaymentBulkUpdateModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const accounts = useCrmAccountStore((s) => s.accounts);
  const bulkUpdatePaymentsFromSheet = useCrmAccountStore((s) => s.bulkUpdatePaymentsFromSheet);
  const queryClient = useQueryClient();

  const accountOptions = useMemo(
    () => accounts.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [accounts],
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<Awaited<
    ReturnType<typeof parseCrmAccountPaymentImportFile>
  > | null>(null);
  const [accountPicks, setAccountPicks] = useState<CrmAccountPaymentPickOverrides>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const plan: CrmAccountPaymentImportPlan | null = useMemo(() => {
    if (!rawRows) return null;
    return buildCrmAccountPaymentImportPlan(rawRows, accounts, accountPicks);
  }, [rawRows, accounts, accountPicks]);

  function reset() {
    setFileName(null);
    setRawRows(null);
    setAccountPicks({});
    setParseError(null);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function setAccountPick(rowNumber: number, value: string) {
    setAccountPicks((prev) => {
      const next = { ...prev };
      if (value === UNSET_PICK) delete next[rowNumber];
      else next[rowNumber] = value;
      return next;
    });
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setParseError(null);
    setRawRows(null);
    setAccountPicks({});
    setFileName(file.name);
    try {
      const raw = await parseCrmAccountPaymentImportFile(file);
      setRawRows(raw);
      const preview = buildCrmAccountPaymentImportPlan(raw, accounts, {});
      if (preview.summary.error > 0 && preview.summary.update === 0 && preview.summary.needsAccountPick === 0) {
        toast.error("Import sheet has errors — fix rows and try again");
      } else if (preview.summary.needsAccountPick > 0) {
        toast.message(`${preview.summary.needsAccountPick} row(s) need an account pick`, {
          description: "Match by User Id or Account name, or pick manually.",
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to read file";
      setParseError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function applyImport() {
    if (!plan) return;
    const actionable = plan.rows.filter((r) => r.action === "update");
    if (actionable.length === 0) {
      toast.error("No accounts ready to update");
      return;
    }

    setBusy(true);
    try {
      const updates = actionable.map((row) => mergeCrmAccountPaymentImportRow(row));
      const updated = await bulkUpdatePaymentsFromSheet(updates);
      await queryClient.invalidateQueries({ queryKey: crmPaymentsKeys.all });
      toast.success(
        `Updated payment details for ${updated} account${updated === 1 ? "" : "s"}. Paid amounts replace the payment ledger for those accounts.`,
      );
      handleOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  const updateCount = plan?.summary.update ?? 0;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="flex max-h-[90vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <AlertDialogHeader className="shrink-0 border-b px-5 py-4 text-left">
          <AlertDialogTitle>Bulk update CRM payment details</AlertDialogTitle>
          <AlertDialogDescription>
            Upload Excel with Account, User Id, deal values, Paid, Pending, and installment dates.
            Use &amp; between multiple installment dates (e.g. 01-07-2027 &amp; 01-07-2028). When one
            installment amount equals Pending, it is split equally across all dates. Matching is by User
            Id first, then account name. Paid replaces the account payment ledger with one entry.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => downloadCrmAccountPaymentImportTemplate()}
            >
              <Download className="h-3.5 w-3.5" />
              Download template
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              Choose file
            </Button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            {fileName ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                {fileName}
              </span>
            ) : null}
          </div>

          {parseError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {parseError}
            </div>
          ) : null}

          {plan ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: "Update", value: plan.summary.update },
                  { label: "Need pick", value: plan.summary.needsAccountPick },
                  { label: "Not found", value: plan.summary.notFound },
                  { label: "Ambiguous", value: plan.summary.ambiguous },
                  { label: "Skip", value: plan.summary.skip },
                  { label: "Error", value: plan.summary.error },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border bg-muted/20 px-3 py-2 text-center"
                  >
                    <div className="text-lg font-semibold tabular-nums">{item.value}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="border-b bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2">Row</th>
                      <th className="px-2 py-2">Sheet</th>
                      <th className="min-w-[12rem] px-2 py-2">CRM account</th>
                      <th className="px-2 py-2">Deal (GST)</th>
                      <th className="px-2 py-2">Paid</th>
                      <th className="px-2 py-2">Pending</th>
                      <th className="px-2 py-2">Installments</th>
                      <th className="px-2 py-2">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.rows.map((row) => (
                      <tr key={row.rowNumber} className="border-b align-top last:border-0">
                        <td className="px-2 py-2 tabular-nums">{row.rowNumber}</td>
                        <td className="px-2 py-2">
                          <div className="font-medium">{row.accountName || "—"}</div>
                          {row.userId ? (
                            <div className="text-[10px] text-muted-foreground">Id: {row.userId}</div>
                          ) : null}
                        </td>
                        <td className="px-2 py-2">
                          {row.action === "pick" ? (
                            <select
                              className="h-8 w-full min-w-[10rem] rounded-md border bg-background px-2 text-xs"
                              value={accountPicks[row.rowNumber] ?? UNSET_PICK}
                              onChange={(e) => setAccountPick(row.rowNumber, e.target.value)}
                            >
                              <option value={UNSET_PICK}>Choose account…</option>
                              <option value="">Skip this row</option>
                              {accountOptions.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                  {a.userId ? ` (${a.userId})` : ""}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-muted-foreground">{row.existingName ?? "—"}</span>
                          )}
                        </td>
                        <td className="px-2 py-2 tabular-nums">
                          {row.dealSize != null ? formatInr(row.dealSize) : "—"}
                        </td>
                        <td className="px-2 py-2 tabular-nums">
                          {row.paymentReceived != null ? formatInr(row.paymentReceived) : "—"}
                        </td>
                        <td className="px-2 py-2 tabular-nums">
                          {row.pendingAmount != null ? formatInr(row.pendingAmount) : "—"}
                        </td>
                        <td className="px-2 py-2">
                          {row.installments.length ? (
                            <ul className="space-y-0.5 text-[10px]">
                              {row.installments.map((inst, i) => (
                                <li key={`${inst.dueDate}-${i}`}>
                                  {formatDate(inst.dueDate)} · {formatInr(inst.amount)}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <span
                            className={cn(
                              row.action === "update" && "text-emerald-600",
                              row.action === "pick" && "text-amber-700 dark:text-amber-400",
                              row.action === "error" && "text-destructive",
                              row.action === "skip" && "text-muted-foreground",
                            )}
                          >
                            {row.message}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>

        <AlertDialogFooter className="shrink-0 border-t px-5 py-3">
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button disabled={busy || updateCount === 0} onClick={() => void applyImport()}>
            Update {updateCount} account{updateCount === 1 ? "" : "s"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
