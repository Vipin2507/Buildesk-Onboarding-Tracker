import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
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
  CRM_ACCOUNT_EXPORT_COLUMNS,
  CRM_ACCOUNT_EXPORT_DEFAULT_COLUMN_IDS,
  downloadCrmAccountsExport,
  type CrmAccountExportColumnId,
  type CrmAccountExportContext,
} from "@/lib/crm-account-sheet-export";
import { cn } from "@/lib/utils";
import type { CrmAccountRow } from "@/stores/crm-dashboard-selectors";

const GROUP_ORDER = [
  "Account",
  "Location",
  "Team",
  "Onboarding",
  "Commercial",
  "Contact",
  "Activity",
] as const;

export function CrmAccountExportModal({
  open,
  onOpenChange,
  rows,
  exportContext,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: CrmAccountRow[];
  exportContext: CrmAccountExportContext;
}) {
  const [selected, setSelected] = useState<Set<CrmAccountExportColumnId>>(
    () => new Set(CRM_ACCOUNT_EXPORT_DEFAULT_COLUMN_IDS),
  );

  useEffect(() => {
    if (open) {
      setSelected(new Set(CRM_ACCOUNT_EXPORT_DEFAULT_COLUMN_IDS));
    }
  }, [open]);

  const groupedColumns = useMemo(() => {
    const groups = new Map<string, typeof CRM_ACCOUNT_EXPORT_COLUMNS>();
    for (const col of CRM_ACCOUNT_EXPORT_COLUMNS) {
      const list = groups.get(col.group) ?? [];
      list.push(col);
      groups.set(col.group, list);
    }
    return GROUP_ORDER.map((group) => ({
      group,
      columns: groups.get(group) ?? [],
    })).filter((entry) => entry.columns.length > 0);
  }, []);

  const allSelected = selected.size === CRM_ACCOUNT_EXPORT_COLUMNS.length;
  const noneSelected = selected.size === 0;

  function toggleColumn(id: CrmAccountExportColumnId, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(CRM_ACCOUNT_EXPORT_COLUMNS.map((c) => c.id)));
  }

  function selectNone() {
    setSelected(new Set());
  }

  function handleExport() {
    if (!rows.length) {
      toast.error("No accounts to export", {
        description: "Adjust filters or clear them to include accounts in the export.",
      });
      return;
    }
    if (!selected.size) {
      toast.error("Select at least one column");
      return;
    }

    try {
      const columnIds = CRM_ACCOUNT_EXPORT_COLUMNS.filter((c) => selected.has(c.id)).map(
        (c) => c.id,
      );
      downloadCrmAccountsExport(rows, columnIds, exportContext);
      toast.success(`Exported ${rows.length} ${rows.length === 1 ? "account" : "accounts"}`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <AlertDialogHeader className="shrink-0 border-b px-5 py-4 text-left">
          <AlertDialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Export CRM accounts
          </AlertDialogTitle>
          <AlertDialogDescription>
            Choose columns to include. The export uses your current filters
            {rows.length === 1 ? " (1 account)" : ` (${rows.length} accounts)`}.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs"
              disabled={allSelected}
              onClick={selectAll}
            >
              Select all
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs"
              disabled={noneSelected}
              onClick={selectNone}
            >
              Clear all
            </Button>
            <span className="text-xs text-muted-foreground">
              {selected.size} of {CRM_ACCOUNT_EXPORT_COLUMNS.length} columns selected
            </span>
          </div>

          <div className="space-y-5">
            {groupedColumns.map(({ group, columns }) => (
              <section key={group}>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group}
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {columns.map((col) => {
                    const checked = selected.has(col.id);
                    return (
                      <label
                        key={col.id}
                        htmlFor={`export-col-${col.id}`}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                          checked ? "border-primary/40 bg-primary/5" : "border-border",
                        )}
                      >
                        <Checkbox
                          id={`export-col-${col.id}`}
                          checked={checked}
                          onCheckedChange={(value) => toggleColumn(col.id, value === true)}
                        />
                        <Label
                          htmlFor={`export-col-${col.id}`}
                          className="cursor-pointer font-normal"
                        >
                          {col.label}
                        </Label>
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <AlertDialogFooter className="shrink-0 border-t px-5 py-3">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            type="button"
            className="gap-1.5"
            disabled={!rows.length || noneSelected}
            onClick={handleExport}
          >
            <Download className="h-3.5 w-3.5" />
            Export Excel
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
