import { CalendarRange } from "lucide-react";

import {
  DesignTicketDateField,
} from "@/components/design-ticket/design-ticket-fields";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import {
  type DprDatePreset,
  dprDateRangeForPreset,
  inferDprDatePreset,
  type DprTrackerSearch,
} from "@/lib/dpr-tracker-search";

const PRESET_LABELS: Record<DprDatePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last7: "Last 7 days",
  month: "This month",
  custom: "Custom",
};

type Props = {
  search: DprTrackerSearch;
  dateFrom: string;
  dateTo: string;
  onSearchChange: (patch: Partial<DprTrackerSearch>) => void;
};

export function DprTrackerDateFilter({ search, dateFrom, dateTo, onSearchChange }: Props) {
  const activePreset = inferDprDatePreset({ ...search, dateFrom, dateTo });

  function applyPreset(preset: DprDatePreset) {
    if (preset === "custom") {
      onSearchChange({ datePreset: "custom" });
      return;
    }
    const range = dprDateRangeForPreset(preset);
    onSearchChange({
      datePreset: preset,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
    });
  }

  const sameDay = dateFrom === dateTo;

  return (
    <div className="rounded-md border bg-card p-3 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <CalendarRange className="h-3.5 w-3.5" />
          Date range
        </span>
        <span className="text-[10px] text-muted-foreground">
          {sameDay
            ? formatDate(dateFrom)
            : `${formatDate(dateFrom)} – ${formatDate(dateTo)}`}
        </span>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(Object.keys(PRESET_LABELS) as DprDatePreset[])
          .filter((p) => p !== "custom")
          .map((preset) => (
            <Button
              key={preset}
              type="button"
              size="sm"
              variant={activePreset === preset ? "default" : "outline"}
              className={cn("h-7 px-2.5 text-xs", activePreset === preset && "shadow-sm")}
              onClick={() => applyPreset(preset)}
            >
              {PRESET_LABELS[preset]}
            </Button>
          ))}
        <Button
          type="button"
          size="sm"
          variant={activePreset === "custom" ? "default" : "outline"}
          className={cn("h-7 px-2.5 text-xs", activePreset === "custom" && "shadow-sm")}
          onClick={() => applyPreset("custom")}
        >
          Custom
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:max-w-md">
        <DesignTicketDateField
          compact
          label="From"
          value={dateFrom}
          displayFormat="dd/MM/yyyy"
          placeholder="Start date"
          onChange={(v) =>
            onSearchChange({
              dateFrom: v,
              datePreset: "custom",
              dateTo: search.dateTo && search.dateTo >= v ? search.dateTo : v,
            })
          }
        />
        <DesignTicketDateField
          compact
          label="To"
          value={dateTo}
          displayFormat="dd/MM/yyyy"
          placeholder="End date"
          onChange={(v) =>
            onSearchChange({
              dateTo: v,
              datePreset: "custom",
              dateFrom: search.dateFrom && search.dateFrom <= v ? search.dateFrom : v,
            })
          }
        />
      </div>
    </div>
  );
}
