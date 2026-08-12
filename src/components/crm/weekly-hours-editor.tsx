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
  saveLabel = "Save",
  className,
}: WeeklyHoursEditorProps) {
  const enabledCount = rows.filter((r) => r.enabled).length;

  return (
    <div className={cn("card-soft overflow-hidden", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold">Weekly hours</div>
          <div className="text-[10px] text-muted-foreground">
            {enabledCount}/{rows.length} days · portal bookable slots
          </div>
        </div>
        <Input
          id="weekly-hours-timezone"
          aria-label="Timezone"
          className="h-8 w-full min-w-[8rem] max-w-[11rem] bg-background text-xs"
          value={timezone}
          onChange={(e) => onTimezoneChange(e.target.value)}
          placeholder="Asia/Kolkata"
        />
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0 px-3 text-xs"
          disabled={saving}
          onClick={onSave}
        >
          {saving ? "Saving…" : saveLabel}
        </Button>
      </div>

      <ul className="divide-y divide-border/50">
        {rows.map((row) => (
          <li
            key={row.weekday}
            className={cn(
              "flex flex-wrap items-center gap-2 px-3 py-1.5 sm:flex-nowrap",
              !row.enabled && "bg-muted/10",
            )}
          >
            <span
              className={cn(
                "w-8 shrink-0 text-xs font-medium",
                row.enabled ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {row.label}
            </span>
            <Switch
              checked={row.enabled}
              onCheckedChange={(checked) => onRowChange(row.weekday, { enabled: checked })}
              aria-label={`${row.label} available`}
              className="shrink-0"
            />
            <Input
              type="time"
              aria-label={`${row.label} start`}
              disabled={!row.enabled}
              value={row.startTime}
              onChange={(e) => onRowChange(row.weekday, { startTime: e.target.value })}
              className={cn(
                "h-8 w-[6.5rem] shrink-0 bg-background text-xs tabular-nums",
                !row.enabled && "opacity-40",
              )}
            />
            <span className="shrink-0 text-[10px] text-muted-foreground">–</span>
            <Input
              type="time"
              aria-label={`${row.label} end`}
              disabled={!row.enabled}
              value={row.endTime}
              onChange={(e) => onRowChange(row.weekday, { endTime: e.target.value })}
              className={cn(
                "h-8 w-[6.5rem] shrink-0 bg-background text-xs tabular-nums",
                !row.enabled && "opacity-40",
              )}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
