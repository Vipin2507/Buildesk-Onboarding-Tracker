import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatTimeRange12h, parseHm as parseHmMinutes } from "@/lib/task-scheduling";
import { cn } from "@/lib/utils";

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => i * 5);
const ITEM_H = 36;
const VISIBLE = 5;

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

function pad2(n: number) {
  return String(n).padStart(2, "0");
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

function isBeforeMin(hour24: number, minute: number, min?: string): boolean {
  const floor = minMinutes(min);
  if (floor === undefined) return false;
  return hour24 * 60 + minute < floor;
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

function clampToMin(hour24: number, minute: number, min?: string): { hour24: number; minute: number } {
  const floor = minMinutes(min);
  if (floor === undefined) return { hour24, minute };
  let total = hour24 * 60 + minute;
  if (total < floor) {
    total = Math.min(23 * 60 + 55, Math.ceil(floor / 5) * 5);
  }
  return { hour24: Math.floor(total / 60) % 24, minute: total % 60 };
}

type ActiveField = "hour" | "minute";

function TimeDrum({
  options,
  value,
  disabledValues,
  onChange,
  format = pad2,
}: {
  options: number[];
  value: number;
  disabledValues?: Set<number>;
  onChange: (next: number) => void;
  format?: (n: number) => string;
}) {
  const index = Math.max(0, options.indexOf(value));
  const pad = Math.floor(VISIBLE / 2);
  const listRef = useRef<HTMLDivElement>(null);
  const settling = useRef(false);
  const snapTimer = useRef<number | null>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    settling.current = true;
    el.scrollTo({ top: index * ITEM_H, behavior: "smooth" });
    const t = window.setTimeout(() => {
      settling.current = false;
    }, 320);
    return () => window.clearTimeout(t);
  }, [index, options]);

  useEffect(
    () => () => {
      if (snapTimer.current != null) window.clearTimeout(snapTimer.current);
    },
    [],
  );

  function applyFromScroll(smooth: boolean) {
    const el = listRef.current;
    if (!el) return;
    const nextIndex = Math.round(el.scrollTop / ITEM_H);
    const clamped = Math.max(0, Math.min(options.length - 1, nextIndex));
    if (smooth) {
      settling.current = true;
      el.scrollTo({ top: clamped * ITEM_H, behavior: "smooth" });
      window.setTimeout(() => {
        settling.current = false;
      }, 280);
    }
    const next = options[clamped]!;
    if (next !== value && !disabledValues?.has(next)) onChange(next);
  }

  return (
    <div className="relative h-[180px] w-[88px] overflow-hidden rounded-2xl bg-muted/50 dark:bg-muted/30">
      <div
        className="pointer-events-none absolute inset-x-1.5 top-1/2 z-10 h-9 -translate-y-1/2 rounded-xl bg-primary/15 ring-1 ring-primary/20"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-10 bg-gradient-to-b from-popover to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-10 bg-gradient-to-t from-popover to-transparent"
        aria-hidden
      />
      <div
        ref={listRef}
        className="h-full snap-y snap-mandatory overflow-y-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ paddingTop: pad * ITEM_H, paddingBottom: pad * ITEM_H }}
        onScroll={() => {
          if (settling.current) return;
          applyFromScroll(false);
          if (snapTimer.current != null) window.clearTimeout(snapTimer.current);
          snapTimer.current = window.setTimeout(() => applyFromScroll(true), 120);
        }}
        onMouseUp={() => applyFromScroll(true)}
        onTouchEnd={() => applyFromScroll(true)}
      >
        {options.map((opt) => {
          const selected = opt === value;
          const disabled = disabledValues?.has(opt);
          return (
            <button
              key={opt}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (!disabled) onChange(opt);
              }}
              className={cn(
                "flex h-9 w-full snap-center items-center justify-center text-sm tabular-nums transition-all duration-200",
                selected
                  ? "scale-110 font-semibold text-foreground"
                  : "text-muted-foreground/55",
                disabled && "cursor-not-allowed opacity-25",
              )}
            >
              {format(opt)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ClockDial({
  mode,
  hour12,
  minute,
  period,
  min,
  onHour,
  onMinute,
}: {
  mode: ActiveField;
  hour12: number;
  minute: number;
  period: "AM" | "PM";
  min?: string;
  onHour: (h: number) => void;
  onMinute: (m: number) => void;
}) {
  const size = 168;
  const cx = size / 2;
  const cy = size / 2;
  const r = 62;
  const selected = mode === "hour" ? hour12 : minute;
  const dialOptions = mode === "hour" ? HOUR_OPTIONS : MINUTE_OPTIONS;

  const angleFor = (value: number) => {
    if (mode === "hour") {
      const h = value % 12;
      return (h / 12) * 360 - 90;
    }
    return (value / 60) * 360 - 90;
  };

  const selectedAngle = angleFor(mode === "hour" ? hour12 % 12 || 12 : minute);
  const rad = (selectedAngle * Math.PI) / 180;
  const hx = cx + Math.cos(rad) * r;
  const hy = cy + Math.sin(rad) * r;

  return (
    <div className="relative flex h-[180px] w-[180px] items-center justify-center rounded-full bg-muted/50 dark:bg-muted/30">
      <svg width={size} height={size} className="absolute inset-0 m-auto text-primary" aria-hidden>
        <motion.line
          x1={cx}
          y1={cy}
          x2={hx}
          y2={hy}
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          initial={false}
          animate={{ x2: hx, y2: hy }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }}
        />
        <circle cx={cx} cy={cy} r={4} fill="currentColor" />
        <motion.circle
          r={16}
          fill="currentColor"
          initial={false}
          animate={{ cx: hx, cy: hy }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }}
        />
      </svg>
        {dialOptions.map((opt) => {
        const angle = angleFor(opt);
        const a = (angle * Math.PI) / 180;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        const isSelected = mode === "hour" ? opt === hour12 : opt === minute;
        const disabled =
          mode === "hour"
            ? !hour12HasValidTime(opt, min)
            : isBeforeMin(to24h(hour12, period), opt, min);
        return (
          <button
            key={`${mode}-${opt}`}
            type="button"
            disabled={disabled}
            onClick={() => (mode === "hour" ? onHour(opt) : onMinute(opt))}
            className={cn(
              "absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-medium tabular-nums transition-colors",
              isSelected ? "z-10 text-primary-foreground" : "text-foreground hover:bg-muted",
              disabled && "pointer-events-none opacity-30",
            )}
            style={{ left: x, top: y }}
          >
            {mode === "hour" ? opt : pad2(opt)}
          </button>
        );
      })}
    </div>
  );
}

export function TimePickerField({
  id,
  value,
  onChange,
  placeholder = "Select time",
  min,
  className,
  modal = false,
  compact = false,
  disabled = false,
}: TimePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"dial" | "drum">("drum");
  const [activeField, setActiveField] = useState<ActiveField>("hour");
  const parsed = useMemo(() => parseHmParts(value), [value]);
  const display = formatDisplay12h(value);
  const [hour12, setHour12] = useState(parsed ? to12hParts(parsed.hour24).hour12 : 9);
  const [minute, setMinute] = useState(parsed ? snapMinute(parsed.minute) : 0);
  const [period, setPeriod] = useState<"AM" | "PM">(
    parsed ? to12hParts(parsed.hour24).period : "AM",
  );
  const [hourDraft, setHourDraft] = useState(pad2(hour12));
  const [minuteDraft, setMinuteDraft] = useState(pad2(minute));

  useEffect(() => {
    if (!parsed) return;
    const parts = to12hParts(parsed.hour24);
    setHour12(parts.hour12);
    setMinute(snapMinute(parsed.minute));
    setPeriod(parts.period);
  }, [parsed?.hour24, parsed?.minute, value]);

  useEffect(() => {
    setHourDraft(pad2(hour12));
  }, [hour12]);

  useEffect(() => {
    setMinuteDraft(pad2(minute));
  }, [minute]);

  useEffect(() => {
    if (open) setActiveField("hour");
  }, [open]);

  function commit(nextHour12: number, nextMinute: number, nextPeriod: "AM" | "PM") {
    let hour24 = to24h(nextHour12, nextPeriod);
    let nextMin = nextMinute;
    ({ hour24, minute: nextMin } = clampToMin(hour24, nextMin, min));
    const snapped = snapMinute(nextMin);
    const parts = to12hParts(hour24);
    setHour12(parts.hour12);
    setMinute(snapped);
    setPeriod(parts.period);
    onChange(toHm(hour24, snapped));
  }

  function commitHourDraft() {
    const n = Number(hourDraft);
    if (!Number.isFinite(n) || n < 1 || n > 12) {
      setHourDraft(pad2(hour12));
      return;
    }
    commit(n, minute, period);
  }

  function commitMinuteDraft() {
    const n = Number(minuteDraft);
    if (!Number.isFinite(n) || n < 0 || n > 59) {
      setMinuteDraft(pad2(minute));
      return;
    }
    commit(hour12, n, period);
  }

  const disabledMinutes = useMemo(() => {
    const set = new Set<number>();
    for (const m of MINUTE_OPTIONS) {
      if (isBeforeMin(to24h(hour12, period), m, min)) set.add(m);
    }
    return set;
  }, [hour12, period, min]);

  const disabledHours = useMemo(() => {
    const set = new Set<number>();
    for (const h of HOUR_OPTIONS) {
      if (!hour12HasValidTime(h, min)) set.add(h);
    }
    return set;
  }, [min]);

  return (
    <div className={cn("relative flex gap-1.5", className)}>
      <Popover modal={modal} open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            disabled={disabled}
            className={cn(
              "flex min-w-0 flex-1 items-center rounded-lg border border-input bg-card px-3 text-left shadow-none dark:bg-muted/40",
              "focus-visible:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
              disabled && "cursor-not-allowed opacity-50",
              compact ? "h-8 text-xs" : "h-10 text-sm",
              !display && "text-muted-foreground",
            )}
          >
            <Clock
              className={cn(
                "mr-2 shrink-0 text-muted-foreground",
                compact ? "h-3.5 w-3.5" : "h-4 w-4",
              )}
            />
            <span className="min-w-0 flex-1 truncate">{display || placeholder}</span>
          </button>
        </PopoverTrigger>

        {value && !disabled ? (
          <button
            type="button"
            className={cn(
              "absolute top-1/2 z-10 flex -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
              compact ? "right-2 h-5 w-5" : "right-2.5 h-6 w-6",
            )}
            aria-label="Clear time"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange("")}
          >
            <X className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
          </button>
        ) : null}

        <PopoverContent
          align="end"
          className={cn(
            "w-auto overflow-hidden rounded-2xl border-border bg-popover p-0 text-popover-foreground shadow-lg",
            modal && "z-[100]",
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
            <div className="min-w-[148px] space-y-3">
              <div className="text-[11px] font-medium text-muted-foreground">Select time</div>

              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={hourDraft}
                  aria-label="Hour"
                  onFocus={() => setActiveField("hour")}
                  onChange={(e) => setHourDraft(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  onBlur={commitHourDraft}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitHourDraft();
                      setActiveField("minute");
                    }
                  }}
                  className={cn(
                    "h-14 w-[4.25rem] rounded-xl text-center text-2xl font-semibold tabular-nums outline-none transition-all duration-200",
                    activeField === "hour"
                      ? "bg-primary/15 text-foreground ring-2 ring-primary/35"
                      : "bg-muted/60 text-foreground hover:bg-muted",
                  )}
                />
                <span className="text-2xl font-semibold text-muted-foreground">:</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={minuteDraft}
                  aria-label="Minute"
                  onFocus={() => setActiveField("minute")}
                  onChange={(e) => setMinuteDraft(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  onBlur={commitMinuteDraft}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitMinuteDraft();
                    }
                  }}
                  className={cn(
                    "h-14 w-[4.25rem] rounded-xl text-center text-2xl font-semibold tabular-nums outline-none transition-all duration-200",
                    activeField === "minute"
                      ? "bg-primary/15 text-foreground ring-2 ring-primary/35"
                      : "bg-muted/60 text-foreground hover:bg-muted",
                  )}
                />
              </div>

              <div className="inline-flex overflow-hidden rounded-xl border border-border bg-muted/40 p-0.5">
                {(["AM", "PM"] as const).map((p) => {
                  const periodDisabled = !periodHasValidTime(hour12, p, min);
                  const active = period === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      disabled={periodDisabled}
                      onClick={() => commit(hour12, minute, p)}
                      className={cn(
                        "h-8 min-w-[3.25rem] rounded-lg px-3 text-xs font-semibold transition-all duration-200",
                        active
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                        periodDisabled && "cursor-not-allowed opacity-40",
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-1 rounded-lg bg-muted/40 p-0.5">
                <button
                  type="button"
                  onClick={() => setPickerMode("drum")}
                  className={cn(
                    "h-7 flex-1 rounded-md text-[10px] font-medium transition-colors",
                    pickerMode === "drum"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                >
                  Scroll
                </button>
                <button
                  type="button"
                  onClick={() => setPickerMode("dial")}
                  className={cn(
                    "h-7 flex-1 rounded-md text-[10px] font-medium transition-colors",
                    pickerMode === "dial"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                >
                  Dial
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${pickerMode}-${activeField}`}
                initial={{ opacity: 0, scale: 0.96, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -4 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="flex justify-center"
              >
                {pickerMode === "drum" ? (
                  <TimeDrum
                    options={activeField === "hour" ? HOUR_OPTIONS : MINUTE_OPTIONS}
                    value={activeField === "hour" ? hour12 : minute}
                    disabledValues={activeField === "hour" ? disabledHours : disabledMinutes}
                    format={activeField === "hour" ? (n) => String(n) : pad2}
                    onChange={(next) => {
                      if (activeField === "hour") commit(next, minute, period);
                      else commit(hour12, next, period);
                    }}
                  />
                ) : (
                  <ClockDial
                    mode={activeField}
                    hour12={hour12}
                    minute={minute}
                    period={period}
                    min={min}
                    onHour={(h) => {
                      commit(h, minute, period);
                      setActiveField("minute");
                    }}
                    onMinute={(m) => commit(hour12, m, period)}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border/70 px-3 py-2.5">
            {value ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                Clear
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              className="h-8 min-w-[4.5rem] text-xs"
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
