import { cn } from "@/lib/utils";

export type DprStatItem = {
  id: string;
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "danger";
};

export function DprStatStrip({ items }: { items: DprStatItem[] }) {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-md border bg-card sm:grid-cols-4">
      {items.map((item, i) => (
        <div
          key={item.id}
          className={cn(
            "flex min-w-0 flex-col gap-0.5 border-border px-3 py-2.5",
            i % 2 === 0 && "border-r sm:border-r",
            i < 2 && "border-b sm:border-b-0",
            i > 0 && i % 4 !== 3 && "sm:border-r",
            item.tone === "danger" && "bg-destructive/5",
          )}
        >
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {item.label}
          </span>
          <span
            className={cn(
              "text-lg font-semibold tabular-nums leading-tight",
              item.tone === "success" && "text-success",
              item.tone === "warning" && "text-warning dark:text-warning-foreground",
              item.tone === "danger" && "text-destructive",
            )}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
