import { useMemo } from "react";
import { Check, Package } from "lucide-react";

import { cn } from "@/lib/utils";
import { CRM_CORE_MODULES } from "@/data/crm-onboarding-defaults";
import { getCrmMasterProductModuleCatalog } from "@/stores/useCrmMasterStore";
import type { CrmProductModuleKey } from "@/types/crm-onboarding";

type Props = {
  selected: CrmProductModuleKey[];
  onChange: (keys: CrmProductModuleKey[]) => void;
  compact?: boolean;
};

function toggleKey(list: CrmProductModuleKey[], key: CrmProductModuleKey, on: boolean) {
  if (on) return list.includes(key) ? list : [...list, key];
  return list.filter((k) => k !== key);
}

/** Checkbox picker for core modules when creating an account. */
export function CrmAccountProductModulesPicker({ selected, onChange, compact }: Props) {
  const catalog = useMemo(() => getCrmMasterProductModuleCatalog(), []);
  const catalogKeys = useMemo(() => new Set(catalog.map((m) => m.key)), [catalog]);
  const items = useMemo(
    () => CRM_CORE_MODULES.filter((m) => catalogKeys.has(m.key)),
    [catalogKeys],
  );

  const selectedCoreCount = selected.filter((key) => items.some((m) => m.key === key)).length;

  return (
    <div className="space-y-3">
      <div className={cn("grid gap-2", compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3")}>
        {items.map((m) => {
          const checked = selected.includes(m.key);
          return (
            <button
              key={m.key}
              type="button"
              role="checkbox"
              aria-checked={checked}
              aria-label={m.label}
              onClick={() => onChange(toggleKey(selected, m.key, !checked))}
              className={cn(
                "group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-xs transition-all",
                checked
                  ? "border-primary/50 bg-primary/5 shadow-sm ring-1 ring-primary/15"
                  : "border-border/80 bg-card hover:border-primary/25 hover:bg-muted/20",
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                  checked
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/70 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                )}
              >
                <Package className="h-4 w-4" />
              </div>
              <span className="min-w-0 flex-1 font-medium leading-snug">{m.label}</span>
              <div
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                  checked
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/25 bg-background",
                )}
              >
                {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
              </div>
            </button>
          );
        })}
      </div>
      {selectedCoreCount > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          {selectedCoreCount} module{selectedCoreCount === 1 ? "" : "s"} selected
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">No modules selected yet.</p>
      )}
    </div>
  );
}
