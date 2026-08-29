import { useMemo } from "react";

import { cn } from "@/lib/utils";
import {
  CRM_CORE_MODULES,
  CRM_INTEGRATION_MODULES,
  isCrmIntegrationModule,
} from "@/data/crm-onboarding-defaults";
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

function ModuleGroup({
  title,
  description,
  items,
  selected,
  onChange,
  compact,
}: {
  title: string;
  description: string;
  items: { key: CrmProductModuleKey; label: string }[];
  selected: CrmProductModuleKey[];
  onChange: (keys: CrmProductModuleKey[]) => void;
  compact?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <div>
        <div className="text-xs font-semibold">{title}</div>
        <p className="text-[10px] text-muted-foreground">{description}</p>
      </div>
      <div className={cn("grid gap-1.5", compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3")}>
        {items.map((m) => {
          const checked = selected.includes(m.key);
          return (
            <label
              key={m.key}
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors",
                checked ? "border-primary/40 bg-primary/5" : "border-border/70 bg-background hover:bg-muted/30",
              )}
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={checked}
                onChange={(e) => onChange(toggleKey(selected, m.key, e.target.checked))}
              />
              <span className="min-w-0 font-medium leading-snug">{m.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** Checkbox picker for core modules + integrations when creating or editing an account. */
export function CrmAccountProductModulesPicker({ selected, onChange, compact }: Props) {
  const catalog = useMemo(() => getCrmMasterProductModuleCatalog(), []);
  const catalogKeys = useMemo(() => new Set(catalog.map((m) => m.key)), [catalog]);

  const coreItems = CRM_CORE_MODULES.filter((m) => catalogKeys.has(m.key));
  const integrationItems = CRM_INTEGRATION_MODULES.filter((m) => catalogKeys.has(m.key));

  return (
    <div className="space-y-4 rounded-lg border border-dashed bg-muted/10 p-3">
      <ModuleGroup
        title="Modules"
        description="Core CRM products purchased for this client."
        items={coreItems}
        selected={selected}
        onChange={onChange}
        compact={compact}
      />
      <ModuleGroup
        title="Integrations"
        description="Channel and lead-source integrations to configure during onboarding."
        items={integrationItems}
        selected={selected}
        onChange={onChange}
        compact={compact}
      />
      {selected.length > 0 ? (
        <p className="text-[10px] text-muted-foreground">
          {selected.filter((k) => !isCrmIntegrationModule(k)).length} module(s) ·{" "}
          {selected.filter((k) => isCrmIntegrationModule(k)).length} integration(s) selected
        </p>
      ) : null}
    </div>
  );
}
