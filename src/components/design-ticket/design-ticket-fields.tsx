import { useMemo, useState, type ReactNode } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { DatePickerField } from "@/components/date-picker-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Shared control styling for ticket filters, forms, and detail actions */
export const ticketFieldControl =
  "h-10 rounded-lg border-input bg-card text-foreground shadow-none transition-[box-shadow,border-color,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/20 dark:bg-muted/40 dark:hover:bg-muted/55";

export const ticketFieldControlCompact =
  "h-8 rounded-md border-input bg-card text-xs text-foreground shadow-none transition-[box-shadow,border-color,background-color] duration-200 focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/20 dark:bg-muted/40";

export function DesignTicketFieldLabel({
  htmlFor,
  children,
  className,
  compact,
}: {
  htmlFor?: string;
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "mb-1 block font-medium uppercase tracking-wide text-muted-foreground",
        compact ? "text-[10px]" : "mb-1.5 text-[11px]",
        className,
      )}
    >
      {children}
    </label>
  );
}

export type DesignTicketSelectOption = {
  value: string;
  label: string;
};

export function DesignTicketSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  className,
  disabled,
  compact,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: DesignTicketSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        id={id}
        className={cn(compact ? ticketFieldControlCompact : ticketFieldControl, "w-full", className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-[min(16rem,70vh)] border-border bg-popover text-popover-foreground">
        {options.map((o) => (
          <SelectItem
            key={o.value}
            value={o.value}
            className="focus:bg-muted focus:text-foreground data-[highlighted]:bg-muted data-[highlighted]:text-foreground"
          >
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DesignTicketFilterField({
  label,
  children,
  className,
  compact,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <DesignTicketFieldLabel compact={compact}>{label}</DesignTicketFieldLabel>
      {children}
    </div>
  );
}

/** Searchable combobox for long company/project lists in ticket forms. */
export function DesignTicketSearchableSelect({
  value,
  options,
  onChange,
  placeholder = "Search…",
  emptyLabel = "No results found",
  disabled,
}: {
  value: string;
  options: DesignTicketSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
}) {
  const selected = options.find((option) => option.value === value);

  return (
    <Popover modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn(
            ticketFieldControl,
            "w-full justify-between font-normal hover:bg-card dark:hover:bg-muted/40",
            !selected && "text-muted-foreground",
          )}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.label}
                onSelect={() => onChange(option.value)}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === option.value ? "opacity-100 text-primary" : "opacity-0",
                  )}
                />
                {option.label}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function multiSelectSummaryLabel(
  values: string[],
  options: DesignTicketSelectOption[],
  placeholder: string,
) {
  if (values.length === 0) return placeholder;
  if (values.length === 1) {
    return options.find((option) => option.value === values[0])?.label ?? values[0];
  }
  return `${values.length} selected`;
}

/** Multi-select popover for filter toolbars (checkbox list, stays open while selecting). */
export function DesignTicketMultiSelect({
  id,
  values,
  onChange,
  options,
  placeholder = "All",
  searchPlaceholder = "Search…",
  emptyLabel = "No results found",
  className,
  disabled,
  compact,
}: {
  id?: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: DesignTicketSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  className?: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(q) || option.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  function toggle(value: string) {
    if (values.includes(value)) {
      onChange(values.filter((item) => item !== value));
      return;
    }
    onChange([...values, value]);
  }

  const summary = multiSelectSummaryLabel(values, options, placeholder);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            compact ? ticketFieldControlCompact : ticketFieldControl,
            "w-full justify-between font-normal hover:bg-card dark:hover:bg-muted/40",
            values.length === 0 && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{summary}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[min(16rem,70vh)]">
            {filteredOptions.length === 0 ? <CommandEmpty>{emptyLabel}</CommandEmpty> : null}
            {filteredOptions.map((option) => {
              const checked = values.includes(option.value);
              return (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => toggle(option.value)}
                  className="gap-2"
                >
                  <Checkbox
                    checked={checked}
                    tabIndex={-1}
                    aria-hidden
                    className="pointer-events-none"
                  />
                  <span className="truncate">{option.label}</span>
                  {checked ? <Check className="ml-auto h-4 w-4 shrink-0 text-primary" /> : null}
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
        {values.length > 0 ? (
          <div className="border-t border-border p-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-center text-xs"
              onClick={() => onChange([])}
            >
              Clear selection
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export function DesignTicketDateField({
  label,
  value,
  onChange,
  placeholder,
  className,
  compact,
  displayFormat,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  compact?: boolean;
  displayFormat?: string;
}) {
  return (
    <DesignTicketFilterField label={label} className={className} compact={compact}>
      <DatePickerField
        value={value}
        onChange={onChange}
        placeholder={placeholder ?? "Pick a date"}
        displayFormat={displayFormat}
        className={cn("w-full", compact ? "[&_input]:h-8 [&_input]:text-xs" : "[&_input]:h-10")}
      />
    </DesignTicketFilterField>
  );
}
