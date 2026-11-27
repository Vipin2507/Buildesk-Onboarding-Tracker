import { useMemo, useState } from "react";
import { ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { financialYearLabel, type RenewalYearSheetRow } from "@/lib/crm-renewal-years";
import { cn } from "@/lib/utils";

export type RenewalYearUnmatchedRow = {
  key: string;
  row: RenewalYearSheetRow;
  reason: string;
};

function yearPreview(row: RenewalYearSheetRow) {
  const filled = row.years.filter((year) => year.dealValue != null && year.dealValue > 0);
  if (filled.length === 0) return "No year values";
  return filled
    .slice(0, 4)
    .map((year) => `${financialYearLabel(year.fyStartYear)} ₹${(year.dealValue ?? 0).toLocaleString("en-IN")}`)
    .join(" · ");
}

function AccountPicker({
  accounts,
  value,
  takenIds,
  onChange,
}: {
  accounts: { id: string; name: string }[];
  value: string;
  takenIds: Set<string>;
  onChange: (accountId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = accounts.find((account) => account.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-8 w-full justify-between px-2 text-xs font-normal"
        >
          <span className="truncate">{selected?.name ?? "Select account"}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="end">
        <Command>
          <CommandInput placeholder="Search accounts…" className="h-8 text-xs" />
          <CommandList className="max-h-52">
            <CommandEmpty className="py-4 text-xs">No accounts found</CommandEmpty>
            {accounts.map((account) => {
              const taken = takenIds.has(account.id) && account.id !== value;
              return (
                <CommandItem
                  key={account.id}
                  value={account.name}
                  disabled={taken}
                  onSelect={() => {
                    if (taken) return;
                    onChange(account.id);
                    setOpen(false);
                  }}
                  className={cn("text-xs", taken && "opacity-40")}
                >
                  {account.name}
                  {taken ? " · already used" : ""}
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function CrmRenewalYearMatchDialog({
  open,
  onOpenChange,
  savedCount,
  rows,
  accounts,
  reservedAccountIds,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  savedCount: number;
  rows: RenewalYearUnmatchedRow[];
  accounts: { id: string; name: string }[];
  reservedAccountIds: string[];
  saving: boolean;
  onSave: (picks: { key: string; accountId: string }[]) => void;
}) {
  const [picks, setPicks] = useState<Record<string, string>>({});
  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [accounts],
  );
  const takenIds = useMemo(() => {
    const ids = new Set(reservedAccountIds);
    for (const accountId of Object.values(picks)) {
      if (accountId) ids.add(accountId);
    }
    return ids;
  }, [picks, reservedAccountIds]);
  const chosen = rows.filter((row) => picks[row.key]).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setPicks({});
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-3">
        <DialogHeader>
          <DialogTitle>Match renewal sheet</DialogTitle>
          <DialogDescription>
            {savedCount} accounts matched by name and were saved. Choose the CRM account for each
            name that did not match.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {rows.map((item) => (
            <div key={item.key} className="grid gap-1.5 rounded-md border border-border p-2 sm:grid-cols-2">
              <div className="min-w-0">
                <div className="truncate text-xs font-medium">{item.row.accountName}</div>
                <div className="text-[10px] text-muted-foreground">{item.reason}</div>
                <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{yearPreview(item.row)}</div>
              </div>
              <AccountPicker
                accounts={sortedAccounts}
                value={picks[item.key] ?? ""}
                takenIds={takenIds}
                onChange={(accountId) => setPicks((prev) => ({ ...prev, [item.key]: accountId }))}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Skip remaining
          </Button>
          <Button
            type="button"
            disabled={saving || chosen === 0}
            onClick={() =>
              onSave(
                rows
                  .filter((row) => picks[row.key])
                  .map((row) => ({ key: row.key, accountId: picks[row.key]! })),
              )
            }
          >
            {saving ? "Saving…" : `Save ${chosen} selected`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
