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
  buildCrmAccountImportPlan,
  downloadCrmAccountImportTemplate,
  mergeCrmAccountImportRow,
  parseCrmAccountImportFile,
  type CrmAccountImportPlan,
  type CrmManagerOption,
} from "@/lib/crm-account-sheet-import";
import { cn } from "@/lib/utils";
import { useCrmAccountStore, useCrmOnboardingStore, useUserStore } from "@/stores";

type ManagerOverrides = Record<
  string,
  {
    salesManagerName?: string;
    supportManager1Name?: string;
    supportManager2Name?: string;
  }
>;

export function CrmAccountBulkUploadModal({
  open,
  onOpenChange,
  updatesOnly = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When true, only updates existing accounts matched by Client Id / company name. */
  updatesOnly?: boolean;
}) {
  const accounts = useCrmAccountStore((s) => s.accounts);
  const upsertAccountsBatch = useCrmAccountStore((s) => s.upsertAccountsBatch);
  const ensure = useCrmOnboardingStore((s) => s.ensureForCompany);
  const users = useUserStore((s) => s.users);

  const managers = useMemo<CrmManagerOption[]>(
    () =>
      users
        .filter((u) => u.active && u.productScope === "crm")
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((u) => ({ id: u.id, name: u.name })),
    [users],
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawPlanSeed, setRawPlanSeed] = useState<Awaited<
    ReturnType<typeof parseCrmAccountImportFile>
  > | null>(null);
  const [overrides, setOverrides] = useState<ManagerOverrides>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const plan: CrmAccountImportPlan | null = useMemo(() => {
    if (!rawPlanSeed) return null;
    const base = buildCrmAccountImportPlan(rawPlanSeed, accounts, managers, overrides);
    if (!updatesOnly) return base;

    let update = 0;
    let notFound = 0;
    let needsManagerPick = 0;
    const rows = base.rows.map((row) => {
      if (row.action === "create") {
        notFound += 1;
        return {
          ...row,
          action: "skip" as const,
          message: row.clientId
            ? `Client Id “${row.clientId}” not found — use Bulk upload to add new accounts`
            : `Account “${row.companyName}” not found — use Bulk upload to add new accounts`,
        };
      }
      if (row.action === "update") {
        update += 1;
        if (row.salesManagerNeedsPick || row.supportManager1NeedsPick || row.supportManager2NeedsPick) {
          needsManagerPick += 1;
        }
      }
      return row;
    });

    return {
      rows,
      summary: {
        create: 0,
        update,
        skip: base.summary.skip + notFound,
        error: base.summary.error,
        needsManagerPick,
      },
    };
  }, [rawPlanSeed, accounts, managers, overrides, updatesOnly]);

  function reset() {
    setFileName(null);
    setRawPlanSeed(null);
    setOverrides({});
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
    setRawPlanSeed(null);
    setOverrides({});
    setFileName(file.name);
    try {
      const raw = await parseCrmAccountImportFile(file);
      setRawPlanSeed(raw);
      const preview = buildCrmAccountImportPlan(raw, accounts, managers, {});
      if (preview.summary.error > 0 && preview.summary.create + preview.summary.update === 0) {
        toast.error("Import sheet has errors — fix rows and try again");
      } else if (updatesOnly && preview.summary.update === 0 && preview.summary.error === 0) {
        toast.message("No matching accounts to update — check Client Id / company names");
      } else if (preview.summary.needsManagerPick > 0) {
        toast.message("Some managers were not found — pick them before importing");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to read file";
      setParseError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  function setSalesOverride(rowKey: string, value: string) {
    setOverrides((prev) => ({
      ...prev,
      [rowKey]: { ...prev[rowKey], salesManagerName: value },
    }));
  }

  function setSupportOverride(rowKey: string, value: string) {
    setOverrides((prev) => ({
      ...prev,
      [rowKey]: { ...prev[rowKey], supportManager1Name: value },
    }));
  }

  function setSupport2Override(rowKey: string, value: string) {
    setOverrides((prev) => ({
      ...prev,
      [rowKey]: { ...prev[rowKey], supportManager2Name: value },
    }));
  }

  const unresolvedPicks = plan?.rows.filter(
    (r) =>
      r.action === "update" &&
      (r.salesManagerNeedsPick || r.supportManager1NeedsPick || r.supportManager2NeedsPick),
  ).length;

  const planStats = useMemo(() => {
    if (!plan) return null;
    if (!updatesOnly) return plan.summary;
    return {
      ...plan.summary,
      notFound: plan.rows.filter((r) => r.message.includes("not found")).length,
      skip: plan.rows.filter((r) => r.message === "Empty row skipped").length,
    };
  }, [plan, updatesOnly]);

  function applyImport() {
    if (!plan) return;

    const actionable = updatesOnly
      ? plan.rows.filter((r) => r.action === "update")
      : plan.rows.filter((r) => r.action === "create" || r.action === "update");
    if (actionable.length === 0) {
      toast.error(updatesOnly ? "No matching accounts to update" : "Nothing to import");
      return;
    }

    setBusy(true);
    let created = 0;
    let updated = 0;

    try {
      const current = useCrmAccountStore.getState().accounts;
      const payloads = actionable.map((row) => {
        const existing = row.existingId
          ? current.find((a) => a.id === row.existingId)
          : undefined;
        if (existing) updated += 1;
        else created += 1;
        return mergeCrmAccountImportRow(
          {
            ...row,
            salesManagerName: row.salesManagerNeedsPick ? "" : row.salesManagerName,
            supportManager1Name: row.supportManager1NeedsPick ? "" : row.supportManager1Name,
            supportManager2Name: row.supportManager2NeedsPick ? "" : row.supportManager2Name,
          },
          existing,
        );
      });

      const saved = upsertAccountsBatch(payloads);
      for (const account of saved) {
        ensure(account.id, account.companyType);
      }

      const leftBlank = unresolvedPicks ?? 0;
      toast.success(
        updatesOnly
          ? `Updated ${updated} account${updated === 1 ? "" : "s"}` +
              (leftBlank > 0
                ? ` · ${leftBlank} row${leftBlank === 1 ? "" : "s"} left manager blank for manual edit`
                : "")
          : `Imported ${created + updated} account${created + updated === 1 ? "" : "s"} (${created} new, ${updated} updated)` +
              (leftBlank > 0
                ? ` · ${leftBlank} row${leftBlank === 1 ? "" : "s"} left manager blank for manual edit`
                : ""),
      );
      handleOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="flex max-h-[90vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <AlertDialogHeader className="shrink-0 border-b px-5 py-4 text-left">
          <AlertDialogTitle>
            {updatesOnly ? "Client bulk update" : "Bulk upload accounts"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {updatesOnly
              ? "Upload an Excel sheet to update existing CRM accounts matched by Client Id or company name. Rows that do not match an account are skipped — use Bulk upload to add new clients. Empty cells are skipped, except an empty Sales Manager cell clears the assignment."
              : "Upload an Excel sheet with the template headers. Empty cells are skipped, except an empty Sales Manager cell clears the assignment (unassigned). Manager names match CRM users case-insensitively — first, middle, or last name alone is fine when unique (e.g. “asif” → Md Asif Ansari). Ambiguous names can be picked manually."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => downloadCrmAccountImportTemplate()}
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
                Headers: S.No, Client Id, Company Name, City, State, POC Name, Number, Email, Users,
                Deal Value, Pending Amount, Start Date, End Date, Sales Manager, Support manager 1
              </p>
            </div>
          ) : null}

          {plan ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {(updatesOnly
                  ? [
                      { label: "Update", value: planStats?.update ?? 0 },
                      { label: "Not found", value: planStats?.notFound ?? 0 },
                      { label: "Skip", value: planStats?.skip ?? 0 },
                      { label: "Errors", value: planStats?.error ?? 0 },
                      { label: "Need manager pick", value: planStats?.needsManagerPick ?? 0 },
                    ]
                  : [
                      { label: "Create", value: planStats?.create ?? 0 },
                      { label: "Update", value: planStats?.update ?? 0 },
                      { label: "Skip", value: planStats?.skip ?? 0 },
                      { label: "Errors", value: planStats?.error ?? 0 },
                      { label: "Need manager pick", value: planStats?.needsManagerPick ?? 0 },
                    ]
                ).map((k) => (
                  <div key={k.label} className="rounded-lg border bg-card/50 px-2.5 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {k.label}
                    </div>
                    <div className="text-sm font-semibold tabular-nums">{k.value}</div>
                  </div>
                ))}
              </div>

              {managers.length === 0 ? (
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  No CRM users found. Add CRM users in Settings so manager dropdowns can be filled.
                </p>
              ) : null}

              <div className="overflow-hidden rounded-xl border">
                <div className="max-h-[42vh] overflow-auto">
                  <table className="w-full min-w-[1020px] text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur">
                      <tr className="border-b text-[10px] uppercase tracking-wide text-muted-foreground">
                        <th className="px-2 py-2 font-medium">Row</th>
                        <th className="px-2 py-2 font-medium">Action</th>
                        <th className="px-2 py-2 font-medium">Company</th>
                        <th className="px-2 py-2 font-medium">Client Id</th>
                        <th className="px-2 py-2 font-medium">Sales manager</th>
                        <th className="px-2 py-2 font-medium">Support mgr 1</th>
                        <th className="px-2 py-2 font-medium">Support mgr 2</th>
                        <th className="px-2 py-2 font-medium">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.rows.map((row) => (
                        <tr key={row.key} className="border-b last:border-0 align-top">
                          <td className="px-2 py-2 tabular-nums text-muted-foreground">
                            {row.rowNumber}
                          </td>
                          <td className="px-2 py-2">
                            <span
                              className={cn(
                                "inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium capitalize",
                                row.action === "create" && "bg-success/15 text-success",
                                row.action === "update" && "bg-info/15 text-info",
                                row.action === "skip" && "bg-muted text-muted-foreground",
                                row.action === "error" && "bg-destructive/15 text-destructive",
                              )}
                            >
                              {row.action}
                            </span>
                          </td>
                          <td className="px-2 py-2 font-medium">{row.companyName || "—"}</td>
                          <td className="px-2 py-2 font-mono text-[11px] text-muted-foreground">
                            {row.clientId || "—"}
                          </td>
                          <td className="px-2 py-2">
                            {row.salesManagerNeedsPick ? (
                              <div className="space-y-1">
                                <p className="text-[10px] text-amber-700 dark:text-amber-400">
                                  Sheet: {row.salesManagerRaw}
                                </p>
                                <select
                                  className="h-8 w-full min-w-[9rem] rounded-md border bg-background px-2 text-xs"
                                  value={overrides[row.key]?.salesManagerName ?? ""}
                                  onChange={(e) => setSalesOverride(row.key, e.target.value)}
                                >
                                  <option value="">Skip / pick later</option>
                                  {managers.map((m) => (
                                    <option key={m.id} value={m.name}>
                                      {m.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : row.clearSalesManager ? (
                              <span className="text-muted-foreground">Unassigned</span>
                            ) : row.salesManagerName ? (
                              <span>{row.salesManagerName}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            {row.supportManager1NeedsPick ? (
                              <div className="space-y-1">
                                <p className="text-[10px] text-amber-700 dark:text-amber-400">
                                  Sheet: {row.supportManager1Raw}
                                </p>
                                <select
                                  className="h-8 w-full min-w-[9rem] rounded-md border bg-background px-2 text-xs"
                                  value={overrides[row.key]?.supportManager1Name ?? ""}
                                  onChange={(e) => setSupportOverride(row.key, e.target.value)}
                                >
                                  <option value="">Skip / pick later</option>
                                  {managers.map((m) => (
                                    <option key={m.id} value={m.name}>
                                      {m.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : row.supportManager1Name ? (
                              <span>{row.supportManager1Name}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            {row.supportManager2NeedsPick ? (
                              <div className="space-y-1">
                                <p className="text-[10px] text-amber-700 dark:text-amber-400">
                                  Sheet: {row.supportManager2Raw}
                                </p>
                                <select
                                  className="h-8 w-full min-w-[9rem] rounded-md border bg-background px-2 text-xs"
                                  value={overrides[row.key]?.supportManager2Name ?? ""}
                                  onChange={(e) => setSupport2Override(row.key, e.target.value)}
                                >
                                  <option value="">Skip / pick later</option>
                                  {managers.map((m) => (
                                    <option key={m.id} value={m.name}>
                                      {m.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : row.supportManager2Name ? (
                              <span>{row.supportManager2Name}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="max-w-[220px] px-2 py-2 text-[11px] text-muted-foreground">
                            {row.message}
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
          <AlertDialogCancel type="button" disabled={busy}>
            Cancel
          </AlertDialogCancel>
          <Button
            type="button"
            disabled={
              busy ||
              !plan ||
              (updatesOnly ? plan.summary.update === 0 : plan.summary.create + plan.summary.update === 0)
            }
            onClick={applyImport}
          >
            {busy
              ? updatesOnly
                ? "Updating…"
                : "Importing…"
              : updatesOnly
                ? `Update ${plan?.summary.update ?? 0} accounts`
                : `Import ${plan ? plan.summary.create + plan.summary.update : 0} accounts`}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
