import { cn } from "@/lib/utils";
import type { CrmChecklistStatusFilter } from "@/lib/crm-checklist-filters";

type StatusCounts = {
  all: number;
  pending: number;
  completed: number;
  na: number;
};

type Props = {
  value: CrmChecklistStatusFilter;
  onChange: (value: CrmChecklistStatusFilter) => void;
  counts: StatusCounts;
  completedLabel?: string;
  className?: string;
};

const FILTERS: { id: CrmChecklistStatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "completed", label: "Completed" },
  { id: "na", label: "N/A" },
];

export function CrmChecklistStatusFilterBar({
  value,
  onChange,
  counts,
  completedLabel = "Completed",
  className,
}: Props) {
  return (
    <div className={cn("mb-3 flex flex-wrap gap-1.5", className)}>
      {FILTERS.map(({ id, label }) => {
        const displayLabel = id === "completed" ? completedLabel : label;
        const count = counts[id];
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-[10px] font-medium transition-colors",
              value === id
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-muted",
            )}
          >
            {displayLabel} ({count})
          </button>
        );
      })}
    </div>
  );
}
