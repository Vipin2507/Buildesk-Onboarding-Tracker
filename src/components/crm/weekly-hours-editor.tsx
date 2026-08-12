import { Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type WeeklyHoursRow = {
  weekday: number;
  label: string;
  startTime: string;
  endTime: string;
  enabled: boolean;
};

type WeeklyHoursEditorProps = {
  timezone: string;
  onTimezoneChange: (value: string) => void;
  rows: WeeklyHoursRow[];
  onRowChange: (weekday: number, patch: Partial<Omit<WeeklyHoursRow, "weekday" | "label">>) => void;
  onSave: () => void;
  saving?: boolean;
  title?: string;
  description?: string;
  saveLabel?: string;
  className?: string;
};

export function WeeklyHoursEditor({
  timezone,
  onTimezoneChange,
  rows,
  onRowChange,
  onSave,
  saving = false,
  title = "Weekly availability",
  description = "Hours when portal clients can book calls with you. Unchecked days are treated as unavailable.",
  saveLabel = "Save weekly hours",
  className,
}: WeeklyHoursEditorProps) {
  const enabledCount = rows.filter((r) => r.enabled).length;

  return (
    <div className={cn("card-soft overflow-hidden", className)}>
      <div className="border-b border-border/70 px-4 py-3.5 sm:px-5">
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              {enabledCount} of {rows.length} days enabled
            </p>
          </div>
        </div>
      </div>

      <div className="border-b border-border/70 bg-muted/20 px-4 py-3.5 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-xs">
            <label
              htmlFor="weekly-hours-timezone"
              className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              Timezone
            </label>
            <Input
              id="weekly-hours-timezone"
              className="h-9 bg-background text-sm"
              value={timezone}
              onChange={(e) => onTimezoneChange(e.target.value)}
              placeholder="Asia/Kolkata"
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="h-9 shrink-0 px-4 text-xs sm:ml-4"
            disabled={saving}
            onClick={onSave}
          >
            {saving ? "Saving…" : saveLabel}
          </Button>
        </div>
      </div>

      <div className="hidden border-b border-border/50 bg-muted/10 px-4 py-2 sm:grid sm:grid-cols-[3.25rem_4.5rem_minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-3 sm:px-5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Day
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Open
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Start
        </span>
        <span aria-hidden className="w-4" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          End
        </span>
      </div>

      <ul className="divide-y divide-border/60">
        {rows.map((row) => (
          <li
            key={row.weekday}
            className={cn(
              "px-4 py-3 transition-colors sm:px-5",
              !row.enabled && "bg-muted/15",
            )}
          >
            <div className="grid grid-cols-[3.25rem_1fr] items-center gap-x-3 gap-y-2.5 sm:grid-cols-[3.25rem_4.5rem_minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-3">
              <span
                className={cn(
                  "text-sm font-medium",
                  row.enabled ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {row.label}
              </span>

              <div className="flex justify-end sm:justify-start">
                <Switch
                  checked={row.enabled}
                  onCheckedChange={(checked) => onRowChange(row.weekday, { enabled: checked })}
                  aria-label={`${row.label} available`}
                />
              </div>

              <div className="col-span-2 flex items-center gap-2 sm:col-span-1 sm:contents">
                <Input
                  type="time"
                  aria-label={`${row.label} start time`}
                  disabled={!row.enabled}
                  value={row.startTime}
                  onChange={(e) => onRowChange(row.weekday, { startTime: e.target.value })}
                  className={cn(
                    "h-9 w-full min-w-0 bg-background text-sm tabular-nums sm:col-start-3",
                    !row.enabled && "opacity-45",
                  )}
                />
                <span className="shrink-0 text-xs text-muted-foreground sm:col-start-4">to</span>
                <Input
                  type="time"
                  aria-label={`${row.label} end time`}
                  disabled={!row.enabled}
                  value={row.endTime}
                  onChange={(e) => onRowChange(row.weekday, { endTime: e.target.value })}
                  className={cn(
                    "h-9 w-full min-w-0 bg-background text-sm tabular-nums sm:col-start-5",
                    !row.enabled && "opacity-45",
                  )}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
