import { useMemo, useState, type ReactNode } from "react";
import { Search, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

export function DataTable<T>({
  data,
  columns,
  searchKeys,
  pageSize = 10,
  onRowClick,
  emptyState,
  actions,
}: {
  data: T[];
  columns: {
    key: string;
    header: string;
    render: (row: T) => ReactNode;
    sortable?: boolean;
  }[];
  searchKeys?: (keyof T)[];
  pageSize?: number;
  onRowClick?: (row: T) => void;
  emptyState?: ReactNode;
  actions?: (row: T) => ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let rows = data;
    if (search && searchKeys) {
      const q = search.toLowerCase();
      rows = rows.filter((row) =>
        searchKeys.some((k) => String(row[k] ?? "").toLowerCase().includes(q)),
      );
    }
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col) {
        rows = [...rows].sort((a, b) => {
          const av = String((a as Record<string, unknown>)[sortKey] ?? "");
          const bv = String((b as Record<string, unknown>)[sortKey] ?? "");
          return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
        });
      }
    }
    return rows;
  }, [data, search, searchKeys, sortKey, sortDir, columns]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  if (data.length === 0 && emptyState) return <>{emptyState}</>;

  const primary = columns[0];
  const secondary = columns[1];
  const tertiary = columns.find((c) => /status|progress/i.test(c.key) || /status|progress/i.test(c.header));

  return (
    <div>
      {searchKeys && (
        <div className="relative mb-3 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search…"
            className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40 md:h-9"
          />
        </div>
      )}

      {/* Mobile cards — desktop unchanged */}
      <div className="space-y-2.5 md:hidden">
        {paged.map((row, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.24), ease }}
            className={cn(
              "rounded-xl border border-border bg-card p-3.5",
              onRowClick && "active:bg-muted/50",
            )}
            onClick={() => onRowClick?.(row)}
            role={onRowClick ? "button" : undefined}
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">{primary?.render(row)}</div>
                {secondary && (
                  <div className="mt-1 text-xs text-muted-foreground">{secondary.render(row)}</div>
                )}
                {tertiary && tertiary !== primary && tertiary !== secondary && (
                  <div className="mt-2">{tertiary.render(row)}</div>
                )}
              </div>
              {onRowClick && <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/70" />}
            </div>
            {actions && (
              <div
                className="mt-3 flex justify-end gap-1 border-t border-border/60 pt-2.5"
                onClick={(e) => e.stopPropagation()}
              >
                {actions(row)}
              </div>
            )}
          </motion.div>
        ))}
        {paged.length === 0 && (
          <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            No results
          </div>
        )}
      </div>

      <div className="hidden overflow-hidden rounded-lg border md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn("px-4 py-2.5 text-left font-medium", col.sortable && "cursor-pointer select-none")}
                    onClick={() => {
                      if (!col.sortable) return;
                      if (sortKey === col.key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                      else {
                        setSortKey(col.key);
                        setSortDir("asc");
                      }
                    }}
                  >
                    {col.header}
                    {sortKey === col.key && (sortDir === "asc" ? " ↑" : " ↓")}
                  </th>
                ))}
                {actions && <th className="px-4 py-2.5 text-right font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {paged.map((row, i) => (
                <tr
                  key={i}
                  className={cn("border-t transition-colors", onRowClick && "cursor-pointer hover:bg-muted/40")}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      {col.render(row)}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {actions(row)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{filtered.length} results</span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            <span className="flex items-center px-2">
              {page + 1} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
