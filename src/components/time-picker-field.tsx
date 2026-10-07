import { useEffect, useMemo, useState } from "react";
import { Clock, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatTimeRange12h, parseHm as parseHmMinutes } from "@/lib/task-scheduling";
import { cn } from "@/lib/utils";

const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => i * 5);

function parseHmParts(value: string): { hour24: number; minute: number } | null {
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

function formatDisplay12h(value: string): string {
  if (!value) return "";
  const formatted = formatTimeRange12h(value);
  return formatted === "—" ? "" : formatted;
}

/** Parse typed times: 3:00 PM, 15:00, 3pm, 1500, 3.30 pm, etc. */
function parseFlexibleTime(raw: string): { hour24: number; minute: number } | null {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, " ");
  if (!cleaned) return null;

  const compact = cleaned.replace(/\s/g, "").replace(/\./g, ":");

  const ampmColon = /^(\d{1,2})(?::(\d{2}))?(AM|PM)$/.exec(compact);
  if (ampmColon) {
    const hour12 = Number(ampmColon[1]);
    const minute = ampmColon[2] != null ? Number(ampmColon[2]) : 0;
    const period = ampmColon[3] as "AM" | "PM";
    if (hour12 < 1 || hour12 > 12 || minute < 0 || minute > 59) return null;
    return { hour24: to24h(hour12, period), minute };
  }

  const ampmDigits = /^(\d{3,4})(AM|PM)$/.exec(compact);
  if (ampmDigits) {
    const digits = ampmDigits[1]!;
    const period = ampmDigits[2] as "AM" | "PM";
    const hour12 = Number(digits.length === 3 ? digits.slice(0, 1) : digits.slice(0, 2));
    const minute = Number(digits.length === 3 ? digits.slice(1) : digits.slice(2));
    if (hour12 < 1 || hour12 > 12 || minute < 0 || minute > 59) return null;
    return { hour24: to24h(hour12, period), minute };
  }

  const h24Colon = /^(\d{1,2}):(\d{2})$/.exec(compact);
  if (h24Colon) {
    const hour24 = Number(h24Colon[1]);
    const minute = Number(h24Colon[2]);
    if (hour24 < 0 || hour24 > 23 || minute < 0 || minute > 59) return null;
    return { hour24, minute };
  }

  const h24Digits = /^(\d{3,4})$/.exec(compact);
  if (h24Digits) {
    const digits = h24Digits[1]!;
    const hour24 = Number(digits.length === 3 ? digits.slice(0, 1) : digits.slice(0, 2));
    const minute = Number(digits.length === 3 ? digits.slice(1) : digits.slice(2));
    if (hour24 < 0 || hour24 > 23 || minute < 0 || minute > 59) return null;
    return { hour24, minute };
  }

  // Bare hour: "3" or "15" — treat as that hour :00 (12h if 1–12 without AM/PM stays ambiguous; prefer 24h for 0–23)
  const bareHour = /^(\d{1,2})$/.exec(compact);
  if (bareHour) {
    const hour24 = Number(bareHour[1]);
    if (hour24 < 0 || hour24 > 23) return null;
    return { hour24, minute: 0 };
  }

  return null;
}

type TimePickerFieldProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Earliest selectable time (HH:mm). */
  min?: string;
  className?: string;
  modal?: boolean;
  compact?: boolean;
  disabled?: boolean;
};

function minMinutes(min?: string): number | undefined {
  if (!min) return undefined;
  return parseHmMinutes(min.slice(0, 5));
}

function hour12HasValidTime(hour12: number, min?: string): boolean {
  if (!minMinutes(min)) return true;
  return (["AM", "PM"] as const).some((period) =>
    MINUTE_OPTIONS.some((m) => !isBeforeMin(to24h(hour12, period), m, min)),
  );
}

function periodHasValidTime(hour12: number, nextPeriod: "AM" | "PM", min?: string): boolean {
  if (!minMinutes(min)) return true;
  return MINUTE_OPTIONS.some((m) => !isBeforeMin(to24h(hour12, nextPeriod), m, min));
}

function isBeforeMin(hour24: number, minute: number, min?: string): boolean {
  const floor = minMinutes(min);
  if (floor === undefined) return false;
  return hour24 * 60 + minute < floor;
}

function clampToMin(hour24: number, minute: number, min?: string): { hour24: number; minute: number } {
  const floor = minMinutes(min);
  if (floor === undefined) return { hour24, minute };
  let total = hour24 * 60 + minute;
  if (total < floor) {
    total = Math.min(23 * 60 + 55, Math.ceil(floor / 5) * 5);
  }
  return { hour24: Math.floor(total / 60) % 24, minute: total % 60 };
}

export function TimePickerField({
  id,
  value,
  onChange,
  placeholder = "e.g. 3:00 PM",
  min,
  className,
  modal = false,
  compact = false,
  disabled = false,
}: TimePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const parsed = useMemo(() => parseHmParts(value), [value]);
  const display = formatDisplay12h(value);
  const [text, setText] = useState(display);
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

  useEffect(() => {
    if (!focused) setText(display);
  }, [display, focused]);

  function commit(nextHour12: number, nextMinute: number, nextPeriod: "AM" | "PM") {
    let hour24 = to24h(nextHour12, nextPeriod);
    let nextMin = nextMinute;
    ({ hour24, minute: nextMin } = clampToMin(hour24, nextMin, min));
    const snapped = snapMinute(nextMin);
    setHour12(to12hParts(hour24).hour12);
    setMinute(snapped);
    setPeriod(to12hParts(hour24).period);
    const hm = toHm(hour24, snapped);
    onChange(hm);
    setText(formatDisplay12h(hm));
  }

  function commitTyped(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      onChange("");
      setText("");
      return;
    }
    const flex = parseFlexibleTime(trimmed);
    if (!flex) {
      setText(display);
      return;
    }
    const parts = to12hParts(flex.hour24);
    commit(parts.hour12, flex.minute, parts.period);
  }

  const selectClass = cn(
    "h-8 rounded-md border border-input bg-card px-2 text-xs shadow-none focus:border-primary/45 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:bg-muted/40",
    compact && "h-7 text-[11px]",
  );

  return (
    <div className={cn("relative flex gap-1.5", className)}>
      <input
        id={id}
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        value={text}
        placeholder={placeholder}
        aria-label="Time"
        onFocus={() => setFocused(true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          setFocused(false);
          commitTyped(text);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === "Escape") {
            setText(display);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={cn(
          "min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-left shadow-none dark:bg-muted/40",
          "placeholder:text-muted-foreground",
          "focus-visible:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
          disabled && "cursor-not-allowed opacity-50",
          compact ? "h-8 pr-8 text-xs" : "h-10 pr-9 text-sm",
        )}
      />

      {value && !disabled ? (
        <button
          type="button"
          className={cn(
            "absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
            compact ? "right-10 h-5 w-5" : "right-11 h-6 w-6",
          )}
          aria-label="Clear time"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onChange("");
            setText("");
          }}
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
          <div className="mb-2 text-[11px] text-muted-foreground">Or pick from lists</div>
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
              {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => {
                const hourDisabled = !hour12HasValidTime(h, min);
                return (
                  <option key={h} value={h} disabled={hourDisabled}>
                    {h}
                  </option>
                );
              })}
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
              {MINUTE_OPTIONS.map((m) => {
                const minuteDisabled = isBeforeMin(to24h(hour12, period), m, min);
                return (
                  <option key={m} value={m} disabled={minuteDisabled}>
                    {String(m).padStart(2, "0")}
                  </option>
                );
              })}
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
              <option value="AM" disabled={!periodHasValidTime(hour12, "AM", min)}>
                AM
              </option>
              <option value="PM" disabled={!periodHasValidTime(hour12, "PM", min)}>
                PM
              </option>
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
                  setText("");
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
