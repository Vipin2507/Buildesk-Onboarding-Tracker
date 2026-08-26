import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";

import { ProgressBar } from "@/components/progress-bar";
import { Pill } from "@/components/status-pill";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  CrmAccountRow,
  CrmDashboardDrillDownFilter,
} from "@/stores/crm-dashboard-selectors";

type DrillDownData = {
  kind: "accounts" | "masters";
  title: string;
  accounts: CrmAccountRow[];
  phase?: string;
};

type Props = {
  open: boolean;
  filter: CrmDashboardDrillDownFilter | null;
  data: DrillDownData | null;
  onClose: () => void;
};

export function CrmDashboardDrillDownSheet({ open, filter, data, onClose }: Props) {
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const list = data?.accounts ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        a.companyType.toLowerCase().includes(q) ||
        (a.salesManagerName ?? "").toLowerCase().includes(q) ||
        (a.supportManager1 ?? "").toLowerCase().includes(q) ||
        (a.supportManager2 ?? "").toLowerCase().includes(q),
    );
  }, [data, query]);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setQuery("");
          onClose();
        }
      }}
    >
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="border-b pb-3">
          <SheetTitle className="text-base">{data?.title ?? "Accounts"}</SheetTitle>
          <SheetDescription>
            {rows.length} account{rows.length === 1 ? "" : "s"}
            {filter ? ` · filtered` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="relative border-b px-1 py-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search accounts…"
            className="h-8 pl-8 text-xs"
          />
        </div>

        <div className="flex-1 space-y-1.5 overflow-y-auto py-2">
          {rows.length === 0 ? (
            <p className="px-1 py-8 text-center text-xs text-muted-foreground">No matching accounts.</p>
          ) : (
            rows.map((a) => (
              <Link
                key={a.id}
                to="/crm/accounts/$accountId"
                params={{ accountId: a.id }}
                onClick={onClose}
                className="card-soft block p-2.5 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{a.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {a.companyType} · {a.city} · {a.stageLabel}
                    </div>
                  </div>
                  <Pill tone={a.status === "live" ? "success" : a.overdue ? "danger" : "muted"}>
                    {a.status}
                  </Pill>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <ProgressBar value={a.progress} className="h-1.5 flex-1" />
                  <span className="text-[10px] tabular-nums text-muted-foreground">{a.progress}%</span>
                </div>
                <div className="mt-1.5 space-y-0.5 text-[10px] text-muted-foreground">
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                    <span>Health {a.resolvedHealth}</span>
                    {a.openTickets > 0 ? <span>· {a.openTickets} tickets</span> : null}
                  </div>
                  <div className="truncate" title={a.salesManagerName || undefined}>
                    Sales: {a.salesManagerName || "—"}
                  </div>
                  <div className="truncate" title={a.supportManager1 || undefined}>
                    Support 1: {a.supportManager1 || "—"}
                  </div>
                  <div className="truncate" title={a.supportManager2 || undefined}>
                    Support 2: {a.supportManager2 || "—"}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
