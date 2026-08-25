import { useEffect, useMemo, useState } from "react";
import { Clock, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatTimeRange12h } from "@/lib/task-scheduling";
import { cn } from "@/lib/utils";

const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => i * 5);

function parseHm(value: string): { hour24: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.slice(0, 5));
  if (!match) return null;
  const hour24 = Number(match[1]);
  const minute = Number(match[2]);
  if (hour24 < 0 || hour24 > 23 || minute < 0 || minute > 59) return null;
  return { hour24, minute };
}

function toHm(hour24: number, minute: number): string {
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function snapMinute(minute: number): number {
  return Math.min(55, Math.round(minute / 5) * 5);
}

function to12hParts(hour24: number): { hour12: number; period: "AM" | "PM" } {
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return { hour12, period };
}

function to24h(hour12: number, period: "AM" | "PM"): number {
  if (period === "AM") return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

type TimePickerFieldProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  modal?: boolean;
  compact?: boolean;
  disabled?: boolean;
};

export function TimePickerField({
  id,
  value,
  onChange,
  placeholder = "Pick time",
  className,
  modal = false,
  compact = false,
  disabled = false,
}: TimePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const parsed = useMemo(() => parseHm(value), [value]);
  const [hour12, setHour12] = useState(parsed ? to12hParts(parsed.hour24).hour12 : 9);
  const [minute, setMinute] = useState(parsed ? snapMinute(parsed.minute) : 0);
  const [period, setPeriod] = useState<"AM" | "PM">(
    parsed ? to12hParts(parsed.hour24).period : "AM",
  );

  useEffect(() => {
    if (!parsed) return;
    const parts = to12hParts(parsed.hour24);
    setHour12(parts.hour12);
    setMinute(snapMinute(parsed.minute));
    setPeriod(parts.period);
  }, [parsed?.hour24, parsed?.minute, value]);

  const display = value ? formatTimeRange12h(value) : "";

  function commit(nextHour12: number, nextMinute: number, nextPeriod: "AM" | "PM") {
    const hour24 = to24h(nextHour12, nextPeriod);
    onChange(toHm(hour24, nextMinute));
  }

  const selectClass = cn(
    "h-8 rounded-md border border-input bg-card px-2 text-xs shadow-none focus:border-primary/45 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:bg-muted/40",
    compact && "h-7 text-[11px]",
  );

  return (
    <div className={cn("relative flex gap-1.5", className)}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(true)}
        className={cn(
          "flex min-w-0 flex-1 items-center rounded-lg border border-input bg-card px-3 text-left shadow-none dark:bg-muted/40",
          "focus-visible:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
          disabled && "cursor-not-allowed opacity-50",
          compact ? "h-8 text-xs" : "h-10 text-sm",
          !display && "text-muted-foreground",
        )}
      >
        {display || placeholder}
      </button>

      {value && !disabled ? (
        <button
          type="button"
          className={cn(
            "absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
            compact ? "right-10 h-5 w-5" : "right-11 h-6 w-6",
          )}
          aria-label="Clear time"
          onClick={() => onChange("")}
        >
          <X className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
        </button>
      ) : null}

      <Popover modal={modal} open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled}
            className={cn(
              "shrink-0 rounded-lg border-input bg-card shadow-none hover:bg-muted dark:bg-muted/40 dark:hover:bg-muted/55",
              compact ? "h-8 w-8" : "h-10 w-10",
            )}
            aria-label="Open time picker"
          >
            <Clock className={compact ? "h-3.5 w-3.5 text-muted-foreground" : "h-4 w-4 text-muted-foreground"} />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className={cn(
            "w-auto border-border bg-popover p-3 text-popover-foreground",
            modal && "z-[100]",
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-center gap-2">
            <select
              className={selectClass}
              value={hour12}
              onChange={(e) => {
                const next = Number(e.target.value);
                setHour12(next);
                commit(next, minute, period);
              }}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <span className="text-sm font-medium text-muted-foreground">:</span>
            <select
              className={selectClass}
              value={minute}
              onChange={(e) => {
                const next = Number(e.target.value);
                setMinute(next);
                commit(hour12, next, period);
              }}
            >
              {MINUTE_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {String(m).padStart(2, "0")}
                </option>
              ))}
            </select>
            <select
              className={selectClass}
              value={period}
              onChange={(e) => {
                const next = e.target.value as "AM" | "PM";
                setPeriod(next);
                commit(hour12, minute, next);
              }}
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              size="sm"
              className="h-7 flex-1 text-xs"
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
            {value ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
