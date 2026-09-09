import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, KeyRound, Upload } from "lucide-react";
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
  buildCrmAccountApiKeyImportPlan,
  downloadCrmAccountApiKeyImportTemplate,
  parseCrmAccountApiKeyImportFile,
  reconcileApiKeyImportPlanWithServer,
  type CrmAccountApiKeyImportPlan,
} from "@/lib/crm-account-api-key-sheet-import";
import { listCompanyPortalAccess } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useCompanyPortalStore, useCrmAccountStore } from "@/stores";

function actionTone(action: CrmAccountApiKeyImportPlan["rows"][number]["action"]) {
  if (action === "update") return "text-primary";
  if (action === "not_found") return "text-destructive";
  if (action === "error") return "text-destructive";
  return "text-muted-foreground";
}

export function CrmAccountApiKeyBulkUploadModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const accounts = useCrmAccountStore((s) => s.accounts);
  const portals = useCompanyPortalStore((s) => s.access);
  const hydratePortalAccess = useCompanyPortalStore((s) => s.hydrateAccess);
  const setPortalApiKey = useCompanyPortalStore((s) => s.setPortalApiKey);

  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<Awaited<
    ReturnType<typeof parseCrmAccountApiKeyImportFile>
  > | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [serverPlan, setServerPlan] = useState<CrmAccountApiKeyImportPlan | null>(null);

  useEffect(() => {
    if (!open) return;
    void listCompanyPortalAccess()
      .then((records) => hydratePortalAccess(records))
      .catch(() => {});
  }, [open, hydratePortalAccess]);

  const localPlan: CrmAccountApiKeyImportPlan | null = useMemo(() => {
    if (!rawRows) return null;
    return buildCrmAccountApiKeyImportPlan(rawRows, accounts, portals);
  }, [rawRows, accounts, portals]);

  const plan = serverPlan ?? localPlan;

  function reset() {
    setFileName(null);
    setRawRows(null);
    setParseError(null);
    setServerPlan(null);
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
    setServerPlan(null);
    setFileName(file.name);
    try {
      const records = await listCompanyPortalAccess().catch(() => null);
      if (records) hydratePortalAccess(records);
      const freshPortals = useCompanyPortalStore.getState().access;

      const raw = await parseCrmAccountApiKeyImportFile(file);
      setRawRows(raw);
      const preview = await reconcileApiKeyImportPlanWithServer(
        buildCrmAccountApiKeyImportPlan(raw, accounts, freshPortals),
        accounts,
        freshPortals,
      );
      setServerPlan(preview);
      if (preview.summary.update === 0 && preview.summary.error > 0) {
        toast.error("Sheet has errors — fix rows and try again");
      } else if (preview.summary.notFound > 0) {
        toast.message(
          `${preview.summary.notFound} Client ID${preview.summary.notFound === 1 ? "" : "s"} not found in CRM`,
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to read file";
      setParseError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function applyUpdates() {
    if (!plan) return;

    const ready = plan.rows.filter((r) => r.action === "update" && r.existingId);
    if (ready.length === 0) {
      toast.error("No matching accounts to update");
      return;
    }

    setBusy(true);
    try {
      let updated = 0;
      const failures: string[] = [];

      for (const row of ready) {
        const account = useCrmAccountStore.getState().accounts.find((a) => a.id === row.existingId);
        if (!account) continue;

        const result = await setPortalApiKey(
          {
            id: account.id,
            name: account.name,
            contact: account.contact,
            email: account.email,
          },
          row.apiRaw,
        );
        if (result.ok) {
          updated += 1;
        } else {
          failures.push(`${account.name}: ${result.error}`);
        }
      }

      if (updated > 0) {
        toast.success(`Updated API key for ${updated} account${updated === 1 ? "" : "s"}`);
      }
      if (failures.length > 0) {
        toast.error(failures.slice(0, 3).join(" · "));
      }
      if (updated > 0 && failures.length === 0) {
        handleOpenChange(false);
      }
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
            <KeyRound className="h-4 w-4" />
            Bulk update portal API keys
          </AlertDialogTitle>
          <AlertDialogDescription>
            Upload Excel with <strong>Client ID</strong> and <strong>API</strong> columns. Rows are
            matched to CRM accounts by Client ID (User ID on the account). The API value becomes the
            portal API key used in client portal links.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => downloadCrmAccountApiKeyImportTemplate()}
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
                Headers: Client ID, API
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
                        <th className="px-2 py-2 font-medium">Client ID</th>
                        <th className="px-2 py-2 font-medium">Account</th>
                        <th className="px-2 py-2 font-medium">Current API</th>
                        <th className="px-2 py-2 font-medium">New API</th>
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
                          <td className="px-2 py-2">{row.existingName ?? "—"}</td>
                          <td className="px-2 py-2 font-mono text-muted-foreground">
                            {row.previousSlug || "—"}
                          </td>
                          <td className="px-2 py-2 font-mono">{row.apiSlug || "—"}</td>
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
            onClick={() => void applyUpdates()}
          >
            Update {plan?.summary.update ?? 0} API key{(plan?.summary.update ?? 0) === 1 ? "" : "s"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
