import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type RangeId = "7" | "30" | "90";
export type AppFilter = "all" | "erp" | "crm";

type Filters = {
  rangeId: RangeId;
  setRangeId: (id: RangeId) => void;
  app: AppFilter;
  setApp: (app: AppFilter) => void;
  from: string;
  to: string;
};

const Ctx = createContext<Filters | null>(null);

function bounds(days: number) {
  const to = new Date();
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (days - 1));
  return { from: from.toISOString(), to: to.toISOString() };
}

export function AdminFilterProvider({ children }: { children: ReactNode }) {
  const [rangeId, setRangeId] = useState<RangeId>("7");
  const [app, setApp] = useState<AppFilter>("all");
  const value = useMemo(() => {
    const days = rangeId === "7" ? 7 : rangeId === "30" ? 30 : 90;
    return { rangeId, setRangeId, app, setApp, ...bounds(days) };
  }, [rangeId, app]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminFilters() {
  const value = useContext(Ctx);
  if (!value) throw new Error("Admin filters are only available inside Command Center");
  return value;
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const lines = [
    keys.join(","),
    ...rows.map((row) => keys.map((key) => JSON.stringify(row[key] ?? "")).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
