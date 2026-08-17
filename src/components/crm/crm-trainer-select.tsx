import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  executiveNames: string[];
  disabled?: boolean;
  className?: string;
  placeholder?: string;
};

/** Executive-only trainer picker shared by CRM training and report workflows. */
export function CrmTrainerSelect({
  value,
  onChange,
  executiveNames,
  disabled,
  className,
  placeholder = "Select trainer",
}: Props) {
  const names = Array.from(
    new Set(executiveNames.map((name) => name.trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  const hasLegacyValue = Boolean(value && !names.includes(value));

  return (
    <select
      disabled={disabled}
      className={cn(
        "rounded-lg border border-input bg-card px-2 text-xs outline-none transition-shadow focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-muted/40",
        className,
      )}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{placeholder}</option>
      {hasLegacyValue ? <option value={value}>{value} (existing)</option> : null}
      {names.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}
