import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownAZ, ArrowUpAZ, ChevronDown, ListFilter, RotateCcw, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

const fieldControl =
  "h-10 rounded-lg border-input bg-card text-foreground shadow-none transition-[box-shadow,border-color,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] placeholder:text-muted-foreground focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/20 dark:bg-muted/40 dark:hover:bg-muted/55";

export type FilterChip = {
  id: string;
  label: string;
  count?: number;
};

export type FilterSelect = {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
};

export type SortOption = {
  value: string;
  label: string;
};

export type DateRangeFilter = {
  label?: string;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
};

type ListToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  chips?: FilterChip[];
  activeChip?: string;
  onChipChange?: (id: string) => void;
  selects?: FilterSelect[];
  dateRange?: DateRangeFilter;
  sortOptions?: SortOption[];
  sortBy?: string;
  sortDir?: "asc" | "desc";
  onSortByChange?: (value: string) => void;
  onSortDirChange?: (dir: "asc" | "desc") => void;
  resultCount?: number;
  resultLabel?: string;
  activeFilterCount?: number;
  onClear?: () => void;
  /** Start with the filters panel open. Defaults to false. */
  defaultFiltersOpen?: boolean;
  trailing?: ReactNode;
  className?: string;
};

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
    >
      {children}
    </label>
  );
}

function ThemedSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className={cn(fieldControl, "w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="border-border bg-popover text-popover-foreground">
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

export function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  chips,
  activeChip,
  onChipChange,
  selects,
  dateRange,
  sortOptions,
  sortBy,
  sortDir = "asc",
  onSortByChange,
  onSortDirChange,
  resultCount,
  resultLabel = "results",
  activeFilterCount = 0,
  onClear,
  defaultFiltersOpen = false,
  trailing,
  className,
}: ListToolbarProps) {
  const searchId = useId();
  const [filtersOpen, setFiltersOpen] = useState(defaultFiltersOpen);
  const hasSelects = Boolean(selects?.length);
  const hasDateRange = Boolean(dateRange);
  const hasChips = Boolean(chips?.length);
  const hasFilterPanel = hasSelects || hasDateRange || hasChips;
  const hasSortSelect = Boolean(sortOptions?.length);
  const hasSort = hasSortSelect || Boolean(onSortDirChange);

  return (
    <motion.div
      layout
      className={cn("card-soft mb-4 space-y-3.5 p-3 sm:p-4", className)}
      transition={{ duration: 0.28, ease }}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={searchId}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className={cn(fieldControl, "pl-9 pr-9")}
          />
          <AnimatePresence>
            {search ? (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.18, ease }}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => onSearchChange("")}
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </motion.button>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasFilterPanel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-10 gap-1.5 border-input bg-card dark:bg-muted/40 dark:hover:bg-muted/55",
                filtersOpen && "border-primary/40 bg-primary/10 text-primary dark:bg-primary/15",
              )}
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((o) => !o)}
            >
              <ListFilter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  {activeFilterCount}
                </span>
              )}
              <motion.span
                animate={{ rotate: filtersOpen ? 180 : 0 }}
                transition={{ duration: 0.25, ease }}
                className="flex"
              >
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </motion.span>
            </Button>
          )}

          {hasSort && (
            <div className="flex items-center gap-1.5">
              {hasSortSelect && (
                <ThemedSelect
                  id={`${searchId}-sort`}
                  value={sortBy ?? sortOptions![0]!.value}
                  onChange={(v) => onSortByChange?.(v)}
                  options={sortOptions!}
                  className="min-w-[10.5rem]"
                />
              )}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0 border-input bg-card hover:bg-muted dark:bg-muted/40 dark:hover:bg-muted/55"
                onClick={() => onSortDirChange?.(sortDir === "asc" ? "desc" : "asc")}
                aria-label={sortDir === "asc" ? "Sort ascending" : "Sort descending"}
                title={sortDir === "asc" ? "Ascending" : "Descending"}
              >
                <motion.span
                  key={sortDir}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease }}
                  className="flex"
                >
                  {sortDir === "asc" ? (
                    <ArrowDownAZ className="h-4 w-4" />
                  ) : (
                    <ArrowUpAZ className="h-4 w-4" />
                  )}
                </motion.span>
              </Button>
            </div>
          )}

          <AnimatePresence>
            {activeFilterCount > 0 && onClear ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.2, ease }}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-10 gap-1.5 text-muted-foreground hover:text-foreground"
                  onClick={onClear}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Clear
                </Button>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {trailing}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {hasFilterPanel && filtersOpen && (
          <motion.div
            key="filters-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease }}
            className="overflow-hidden"
          >
            <div className="space-y-3.5 border-t border-border/70 pt-3.5">
              {hasChips && (
                <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:overflow-visible">
                  {chips!.map((chip) => {
                    const active = activeChip === chip.id;
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => onChipChange?.(chip.id)}
                        className={cn(
                          "min-h-9 shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                          active
                            ? "border-primary bg-primary text-primary-foreground shadow-[0_0_0_3px_rgb(0_155_255_/_0.14)] dark:shadow-[0_0_0_3px_rgb(46_176_255_/_0.18)]"
                            : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground dark:bg-muted/30 dark:hover:bg-muted/50",
                        )}
                      >
                        {chip.label}
                        {typeof chip.count === "number" && (
                          <span
                            className={cn(
                              "ml-1.5 tabular-nums",
                              active ? "text-primary-foreground/80" : "text-muted-foreground",
                            )}
                          >
                            {chip.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {(hasSelects || hasDateRange) && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {hasDateRange && (
                    <>
                      <div className="min-w-0">
                        <FieldLabel htmlFor={`${searchId}-from`}>
                          {dateRange!.label ? `${dateRange!.label} from` : "From"}
                        </FieldLabel>
                        <Input
                          id={`${searchId}-from`}
                          type="date"
                          value={dateRange!.from}
                          max={dateRange!.to || undefined}
                          onChange={(e) => dateRange!.onFromChange(e.target.value)}
                          className={cn(fieldControl, "[color-scheme:inherit]")}
                        />
                      </div>
                      <div className="min-w-0">
                        <FieldLabel htmlFor={`${searchId}-to`}>
                          {dateRange!.label ? `${dateRange!.label} to` : "To"}
                        </FieldLabel>
                        <Input
                          id={`${searchId}-to`}
                          type="date"
                          value={dateRange!.to}
                          min={dateRange!.from || undefined}
                          onChange={(e) => dateRange!.onToChange(e.target.value)}
                          className={cn(fieldControl, "[color-scheme:inherit]")}
                        />
                      </div>
                    </>
                  )}
                  {selects?.map((select) => (
                    <div key={select.id} className="min-w-0">
                      <FieldLabel htmlFor={`${searchId}-${select.id}`}>{select.label}</FieldLabel>
                      <ThemedSelect
                        id={`${searchId}-${select.id}`}
                        value={select.value}
                        onChange={select.onChange}
                        options={select.options}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {typeof resultCount === "number" && (
        <div className="flex items-center justify-between border-t border-border/70 pt-2.5 text-xs text-muted-foreground">
          <motion.span
            key={resultCount}
            initial={{ opacity: 0.4, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease }}
            className="tabular-nums"
          >
            {resultCount} {resultLabel}
          </motion.span>
        </div>
      )}
    </motion.div>
  );
}

export function compareText(a: string, b: string, dir: "asc" | "desc") {
  const cmp = a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
  return dir === "asc" ? cmp : -cmp;
}

export function compareNumber(a: number, b: number, dir: "asc" | "desc") {
  return dir === "asc" ? a - b : b - a;
}

/** Inclusive YYYY-MM-DD range check. Empty from/to means open-ended. */
export function inDateRange(date: string | undefined | null, from: string, to: string) {
  if (!from && !to) return true;
  const value = (date ?? "").slice(0, 10);
  if (!value) return false;
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
}
