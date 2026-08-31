import { useMemo, useRef, useState } from "react";
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
  buildCompanyCommercialImportPlan,
  downloadCompanyCommercialImportTemplate,
  mergeCompanyCommercialImportRow,
  parseCompanyCommercialImportFile,
  type CompanyCommercialImportPlan,
} from "@/lib/company-sheet-import";
import { cn, formatInr } from "@/lib/utils";
import { useCompanyStore } from "@/stores";

export function CompanyCommercialBulkUpdateModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const companies = useCompanyStore((s) => s.companies);
  const updateCompaniesCommercialBatch = useCompanyStore((s) => s.updateCompaniesCommercialBatch);

  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<Awaited<
    ReturnType<typeof parseCompanyCommercialImportFile>
  > | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const plan: CompanyCommercialImportPlan | null = useMemo(() => {
    if (!rawRows) return null;
    return buildCompanyCommercialImportPlan(rawRows, companies);
  }, [rawRows, companies]);

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
      const raw = await parseCompanyCommercialImportFile(file);
      setRawRows(raw);
      const preview = buildCompanyCommercialImportPlan(raw, companies);
      if (preview.summary.error > 0 && preview.summary.update === 0) {
        toast.error("Import sheet has errors — fix rows and try again");
      } else if (preview.summary.update === 0 && preview.summary.error === 0) {
        toast.message("No matching companies to update — check company names");
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
      toast.error("No matching companies to update");
      return;
    }

    setBusy(true);
    try {
      const current = useCompanyStore.getState().companies;
      const updates = actionable.map((row) => {
        const existing = current.find((c) => c.id === row.existingId)!;
        return mergeCompanyCommercialImportRow(row, existing);
      });

      const updated = await updateCompaniesCommercialBatch(updates);
      toast.success(`Updated ${updated} compan${updated === 1 ? "y" : "ies"}`);
      handleOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="flex max-h-[90vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <AlertDialogHeader className="shrink-0 border-b px-5 py-4 text-left">
          <AlertDialogTitle>Update company commercial data</AlertDialogTitle>
          <AlertDialogDescription>
            Upload an Excel sheet to update existing ERP companies matched by company name. Rows
            that do not match a company are skipped. Empty cells leave the current value unchanged.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => downloadCompanyCommercialImportTemplate()}
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
              <p className="mt-1 max-w-lg text-[11px] text-muted-foreground">
                Status: Live, Unpaid, Canceled, Expired, Future · Plan Name: Post Sales / Buildesk
                annual license plans · Payment status: NA, Fully paid, Partially paid, Pending, Part
                payment subscription
              </p>
            </div>
          ) : null}

          {plan ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[
                  { label: "Update", value: plan.summary.update },
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
                <table className="w-full min-w-[960px] text-left text-xs">
                  <thead className="border-b bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2">Row</th>
                      <th className="px-2 py-2">Sheet name</th>
                      <th className="px-2 py-2">Match</th>
                      <th className="px-2 py-2">Deal</th>
                      <th className="px-2 py-2">Pending</th>
                      <th className="px-2 py-2">Plan</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Payment</th>
                      <th className="px-2 py-2">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.rows.map((row) => (
                      <tr key={row.rowNumber} className="border-b last:border-0">
                        <td className="px-2 py-2 tabular-nums">{row.rowNumber}</td>
                        <td className="px-2 py-2 font-medium">{row.name || "—"}</td>
                        <td className="px-2 py-2 text-muted-foreground">
                          {row.existingName ?? "—"}
                        </td>
                        <td className="px-2 py-2 tabular-nums">
                          {row.dealSize != null ? formatInr(row.dealSize) : "—"}
                        </td>
                        <td className="px-2 py-2 tabular-nums">
                          {row.pendingAmount != null ? formatInr(row.pendingAmount) : "—"}
                        </td>
                        <td className="px-2 py-2">{row.planName ?? "—"}</td>
                        <td className="px-2 py-2">{row.commercialStatus ?? "—"}</td>
                        <td className="px-2 py-2">{row.paymentStatus ?? "—"}</td>
                        <td className="px-2 py-2">
                          <span
                            className={cn(
                              row.action === "update" && "text-emerald-600",
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
          <Button
            disabled={busy || !plan || plan.summary.update === 0}
            onClick={() => void applyImport()}
          >
            {busy ? "Updating…" : `Update ${plan?.summary.update ?? 0} companies`}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
