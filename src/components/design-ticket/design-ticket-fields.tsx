import type { ReactNode } from "react";

import { DatePickerField } from "@/components/date-picker-field";
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

export function DesignTicketFieldLabel({
  htmlFor,
  children,
  className,
}: {
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
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
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: DesignTicketSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className={cn(ticketFieldControl, "w-full", className)}>
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
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <DesignTicketFieldLabel>{label}</DesignTicketFieldLabel>
      {children}
    </div>
  );
}

export function DesignTicketDateField({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <DesignTicketFilterField label={label} className={className}>
      <DatePickerField
        value={value}
        onChange={onChange}
        placeholder={placeholder ?? "Pick a date"}
        className="w-full [&_input]:h-10"
      />
    </DesignTicketFilterField>
  );
}
