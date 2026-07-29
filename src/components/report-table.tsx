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
      <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const primary = columns[0];

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="space-y-1.5 p-2 md:hidden">
        {rows.map((row, i) => (
          <div
            key={i}
            className={cn(
              "rounded-lg border border-border p-2.5",
              i % 2 === 0 ? "bg-background" : "bg-muted/20",
            )}
          >
            {primary ? (
              <div className="text-xs font-medium">{row[primary.key] ?? "—"}</div>
            ) : null}
            <dl className="mt-1.5 space-y-0.5">
              {columns.slice(primary ? 1 : 0).map((c) => (
                <div key={c.key} className="flex items-start justify-between gap-2 text-[10px]">
                  <dt className="shrink-0 text-muted-foreground">{c.label}</dt>
                  <dd className="min-w-0 text-right text-foreground/90">{row[c.key] ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      <div className="hidden max-h-[380px] overflow-auto md:block">
        <table className="w-full min-w-[640px] border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className="border-b border-border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
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
                  <td key={c.key} className="px-2.5 py-1.5 align-middle text-foreground/90">
                    {row[c.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border bg-muted/30 px-2.5 py-1 text-[10px] text-muted-foreground">
        {rows.length} row{rows.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}
