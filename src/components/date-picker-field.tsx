import { useEffect, useState } from "react";
import { CalendarIcon, X } from "lucide-react";
import { format, parse, isValid, startOfMonth, endOfMonth } from "date-fns";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function parseYmd(value: string): Date | undefined {
  if (!value) return undefined;
  const d = parse(value.slice(0, 10), "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

function toYmd(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** Accept typed dates like 2020-05-12, 12/05/2020, 12-05-2020, 12 May 2020. */
function parseTypedDate(raw: string): Date | undefined {
  const text = raw.trim();
  if (!text) return undefined;

  const formats = [
    "yyyy-MM-dd",
    "dd/MM/yyyy",
    "d/M/yyyy",
    "dd-MM-yyyy",
    "d-M-yyyy",
    "dd.MM.yyyy",
    "d.M.yyyy",
    "dd MMM yyyy",
    "d MMM yyyy",
    "dd MMMM yyyy",
    "d MMMM yyyy",
    "MMM d, yyyy",
    "MMMM d, yyyy",
  ];

  for (const fmt of formats) {
    const d = parse(text, fmt, new Date());
    if (isValid(d)) return d;
  }

  // Last resort: Date constructor for ISO-like values
  const fallback = new Date(text);
  return isValid(fallback) ? fallback : undefined;
}

function displayValue(ymd: string): string {
  const d = parseYmd(ymd);
  return d ? format(d, "dd MMM yyyy") : "";
}

type DatePickerFieldProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  className?: string;
  yearsBack?: number;
  yearsForward?: number;
  /** Use when nesting inside Dialog/AlertDialog so the calendar stays interactive. */
  modal?: boolean;
};

export function DatePickerField({
  id,
  value,
  onChange,
  placeholder = "Type or pick a date",
  min,
  max,
  className,
  yearsBack = 25,
  yearsForward = 5,
  modal = false,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => displayValue(value));
  const selected = parseYmd(value);
  const minDate = parseYmd(min ?? "");
  const maxDate = parseYmd(max ?? "");

  useEffect(() => {
    setDraft(displayValue(value));
  }, [value]);

  const now = new Date();
  const startMonth = (() => {
    const start = startOfMonth(new Date(now.getFullYear() - yearsBack, 0, 1));
    return minDate && minDate < start ? startOfMonth(minDate) : start;
  })();
  const endMonth = (() => {
    const end = endOfMonth(new Date(now.getFullYear() + yearsForward, 11, 31));
    return maxDate && maxDate > end ? endOfMonth(maxDate) : end;
  })();

  function commitTyped(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      onChange("");
      setDraft("");
      return;
    }
    const parsed = parseTypedDate(trimmed);
    if (!parsed) {
      setDraft(displayValue(value));
      return;
    }
    if (minDate && parsed < minDate) {
      setDraft(displayValue(value));
      return;
    }
    if (maxDate && parsed > maxDate) {
      setDraft(displayValue(value));
      return;
    }
    const next = toYmd(parsed);
    onChange(next);
    setDraft(format(parsed, "dd MMM yyyy"));
  }

  return (
    <div className={cn("relative flex gap-1.5", className)}>
      <div className="relative min-w-0 flex-1">
        <Input
          id={id}
          value={draft}
          placeholder={placeholder}
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commitTyped(draft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitTyped(draft);
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === "Escape") {
              setDraft(displayValue(value));
              (e.target as HTMLInputElement).blur();
            }
          }}
          className={cn(
            "h-10 rounded-lg border-input bg-card pr-9 shadow-none dark:bg-muted/40",
            "focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/20",
          )}
        />
        {value || draft ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Clear date"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange("");
              setDraft("");
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <Popover modal={modal} open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-lg border-input bg-card shadow-none hover:bg-muted dark:bg-muted/40 dark:hover:bg-muted/55"
            aria-label="Open calendar"
          >
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className={cn(
            "w-auto border-border bg-popover p-0 text-popover-foreground",
            modal && "z-[100]",
          )}
          onOpenAutoFocus={(e) => {
            if (modal) e.preventDefault();
          }}
        >
          <Calendar
            mode="single"
            captionLayout="dropdown"
            selected={selected}
            defaultMonth={selected ?? minDate ?? maxDate}
            startMonth={startMonth}
            endMonth={endMonth}
            onSelect={(date) => {
              if (!date) {
                onChange("");
                setDraft("");
              } else {
                onChange(toYmd(date));
                setDraft(format(date, "dd MMM yyyy"));
              }
              setOpen(false);
            }}
            disabled={(date) => {
              if (minDate && date < minDate) return true;
              if (maxDate && date > maxDate) return true;
              return false;
            }}
            initialFocus
          />
          {value ? (
            <div className="border-t border-border p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-full text-muted-foreground"
                onClick={() => {
                  onChange("");
                  setDraft("");
                  setOpen(false);
                }}
              >
                Clear date
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}
