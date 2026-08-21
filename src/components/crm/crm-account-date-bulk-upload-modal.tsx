import { useMemo, useRef, useState } from "react";
import { CalendarRange, Download, FileSpreadsheet, Upload } from "lucide-react";
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
  buildCrmAccountDateImportPlan,
  downloadCrmAccountDateImportTemplate,
  parseCrmAccountDateImportFile,
  type CrmAccountDateImportPlan,
} from "@/lib/crm-account-date-sheet-import";
import { cn, formatDate } from "@/lib/utils";
import { useCrmAccountStore } from "@/stores";

function actionTone(action: CrmAccountDateImportPlan["rows"][number]["action"]) {
  if (action === "update") return "text-primary";
  if (action === "not_found") return "text-destructive";
  if (action === "error") return "text-destructive";
  return "text-muted-foreground";
}

export function CrmAccountDateBulkUploadModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const accounts = useCrmAccountStore((s) => s.accounts);
  const updateAccount = useCrmAccountStore((s) => s.updateAccount);

  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<Awaited<
    ReturnType<typeof parseCrmAccountDateImportFile>
  > | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const plan: CrmAccountDateImportPlan | null = useMemo(() => {
    if (!rawRows) return null;
    return buildCrmAccountDateImportPlan(rawRows, accounts);
  }, [rawRows, accounts]);

  function reset() {
    setFileName(null);
    setRawRows(null);
    setParseError(null);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setParseError(null);
    setRawRows(null);
    setFileName(file.name);
    try {
      const raw = await parseCrmAccountDateImportFile(file);
      setRawRows(raw);
      const preview = buildCrmAccountDateImportPlan(raw, accounts);
      if (preview.summary.update === 0 && preview.summary.error > 0) {
        toast.error("Sheet has errors — fix rows and try again");
      } else if (preview.summary.notFound > 0) {
        toast.message(`${preview.summary.notFound} Client Id${preview.summary.notFound === 1 ? "" : "s"} not found in CRM`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to read file";
      setParseError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  function applyUpdates() {
    if (!plan) return;

    const ready = plan.rows.filter((r) => r.action === "update" && r.existingId);
    if (ready.length === 0) {
      toast.error("No matching accounts to update");
      return;
    }

    setBusy(true);
    try {
      const current = useCrmAccountStore.getState().accounts;
      for (const row of ready) {
        const existing = current.find((a) => a.id === row.existingId);
        if (!existing) continue;
        updateAccount(existing.id, {
          ...(row.applyStartDate ? { startDate: row.applyStartDate } : {}),
          ...(row.applyEndDate ? { endDate: row.applyEndDate } : {}),
        });
      }
      toast.success(
        `Updated dates for ${ready.length} account${ready.length === 1 ? "" : "s"}`,
      );
      handleOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <AlertDialogHeader className="shrink-0 border-b px-5 py-4 text-left">
          <AlertDialogTitle className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4" />
            Update start & end dates
          </AlertDialogTitle>
          <AlertDialogDescription>
            Upload a sheet with Client Id, Company Name, Start Date, and End Date. Rows are matched
            to existing CRM accounts by Client Id (same as User ID on the account). Only dates are
            updated — no other fields change.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => downloadCrmAccountDateImportTemplate()}
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

          {!plan && !parseError ? (
            <div
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-10 text-center",
                "bg-muted/20 hover:bg-muted/35",
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void onFile(e.dataTransfer.files?.[0]);
              }}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
              }}
            >
              <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Drop Excel file here</p>
              <p className="mt-1 max-w-md text-[11px] text-muted-foreground">
                Headers: S.No, Client Id, Company Name, Start Date, End Date
              </p>
            </div>
          ) : null}

          {plan ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: "Update", value: plan.summary.update },
                  { label: "Not found", value: plan.summary.notFound },
                  { label: "Skip", value: plan.summary.skip },
                  { label: "Errors", value: plan.summary.error },
                ].map((k) => (
                  <div key={k.label} className="rounded-lg border bg-card/50 px-2.5 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {k.label}
                    </div>
                    <div className="text-sm font-semibold tabular-nums">{k.value}</div>
                  </div>
                ))}
              </div>

              <div className="overflow-hidden rounded-xl border">
                <div className="max-h-[42vh] overflow-auto">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead className="sticky top-0 bg-muted/80 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2 font-medium">Row</th>
                        <th className="px-2 py-2 font-medium">Client Id</th>
                        <th className="px-2 py-2 font-medium">Account</th>
                        <th className="px-2 py-2 font-medium">Current dates</th>
                        <th className="px-2 py-2 font-medium">New dates</th>
                        <th className="px-2 py-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.rows.map((row) => (
                        <tr key={row.key} className="border-t align-top">
                          <td className="px-2 py-2 tabular-nums text-muted-foreground">
                            {row.rowNumber}
                          </td>
                          <td className="px-2 py-2 font-medium">{row.clientId || "—"}</td>
                          <td className="px-2 py-2">
                            <div>{row.existingName ?? row.companyName ?? "—"}</div>
                            {row.companyName &&
                            row.existingName &&
                            row.companyName !== row.existingName ? (
                              <div className="text-[10px] text-muted-foreground">
                                Sheet: {row.companyName}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-2 py-2 text-muted-foreground">
                            {row.previousStartDate || row.previousEndDate ? (
                              <>
                                {row.previousStartDate ? formatDate(row.previousStartDate) : "—"}
                                {" → "}
                                {row.previousEndDate ? formatDate(row.previousEndDate) : "—"}
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-2 py-2">
                            {row.applyStartDate || row.applyEndDate ? (
                              <>
                                {row.applyStartDate ? formatDate(row.applyStartDate) : "—"}
                                {" → "}
                                {row.applyEndDate ? formatDate(row.applyEndDate) : "—"}
                              </>
                            ) : row.startDate || row.endDate ? (
                              <>
                                {row.startDate ? formatDate(row.startDate) : "—"}
                                {" → "}
                                {row.endDate ? formatDate(row.endDate) : "—"}
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className={cn("px-2 py-2", actionTone(row.action))}>
                            <div className="font-medium capitalize">{row.action.replace("_", " ")}</div>
                            <div className="text-[10px] opacity-90">{row.message}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <AlertDialogFooter className="shrink-0 border-t px-5 py-3">
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            disabled={busy || !plan || plan.summary.update === 0}
            onClick={applyUpdates}
          >
            Update {plan?.summary.update ?? 0} account{(plan?.summary.update ?? 0) === 1 ? "" : "s"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
