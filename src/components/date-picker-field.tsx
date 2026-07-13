import { useState } from "react";
import { CalendarIcon, X } from "lucide-react";
import { format, parse, isValid } from "date-fns";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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

type DatePickerFieldProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  className?: string;
};

export function DatePickerField({
  id,
  value,
  onChange,
  placeholder = "Pick a date",
  min,
  max,
  className,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = parseYmd(value);
  const minDate = parseYmd(min ?? "");
  const maxDate = parseYmd(max ?? "");

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              "h-10 w-full justify-start gap-2 rounded-lg border-input bg-card px-3 text-left text-sm font-normal shadow-none hover:bg-muted dark:bg-muted/40 dark:hover:bg-muted/55",
              !selected && "text-muted-foreground",
              selected && "pr-9",
            )}
          >
            <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {selected ? format(selected, "dd MMM yyyy") : placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto border-border bg-popover p-0 text-popover-foreground"
        >
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? minDate ?? maxDate}
            onSelect={(date) => {
              onChange(date ? toYmd(date) : "");
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
                  setOpen(false);
                }}
              >
                Clear date
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
      {value ? (
        <button
          type="button"
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Clear date"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onChange("");
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
