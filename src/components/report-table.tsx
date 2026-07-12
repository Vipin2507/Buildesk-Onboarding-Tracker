import { cn } from "@/lib/utils";
import type { ReportColumn, ReportRow } from "@/lib/reports";

export function ReportTable({
  columns,
  rows,
  emptyMessage = "No rows for this report yet.",
}: {
  columns: ReportColumn[];
  rows: ReportRow[];
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className="border-b border-border px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={cn(
                  "border-b border-border/60 last:border-0",
                  i % 2 === 0 ? "bg-background" : "bg-muted/20",
                )}
              >
                {columns.map((c) => (
                  <td key={c.key} className="px-3 py-2 align-middle text-foreground/90">
                    {row[c.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
        {rows.length} row{rows.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}
