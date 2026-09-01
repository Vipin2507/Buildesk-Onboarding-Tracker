import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  ticketFieldClass,
  ticketSelectClass,
} from "@/components/design-ticket/design-ticket-shared";
import { CRM_PROVIDER_OTHER } from "@/data/crm-onboarding-defaults";
import { isCustomCrmProvider, useCrmProviderOptions } from "@/lib/crm-providers";
import { cn } from "@/lib/utils";
import { useCrmOnboardingStore } from "@/stores";
import type { CrmProductModuleKey } from "@/types/crm-onboarding";

type Props = {
  companyId: string;
  moduleKey: CrmProductModuleKey;
  moduleLabel: string;
  provider?: string;
};

export function CrmModuleProviderSelect({ companyId, moduleKey, moduleLabel, provider }: Props) {
  const setModuleProvider = useCrmOnboardingStore((s) => s.setModuleProvider);
  const options = useCrmProviderOptions(moduleKey);
  const custom = isCustomCrmProvider(moduleKey, provider);
  const [customDraft, setCustomDraft] = useState(custom ? (provider ?? "") : "");
  const selectValue = custom ? CRM_PROVIDER_OTHER : (provider ?? "");

  useEffect(() => {
    setCustomDraft(isCustomCrmProvider(moduleKey, provider) ? (provider ?? "") : "");
  }, [moduleKey, provider]);

  return (
    <div className="flex flex-col items-end gap-1">
      <select
        className={cn(ticketSelectClass, "h-7 w-40 text-[11px]")}
        value={selectValue}
        onChange={(e) => {
          const value = e.target.value;
          if (value === CRM_PROVIDER_OTHER) {
            setCustomDraft(custom ? (provider ?? "") : "");
            if (!custom) setModuleProvider(companyId, moduleKey, "");
            return;
          }
          setCustomDraft("");
          setModuleProvider(companyId, moduleKey, value);
          if (value) toast.success(`${moduleLabel} → ${value}`);
        }}
      >
        <option value="">Select provider</option>
        {options.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      {selectValue === CRM_PROVIDER_OTHER ? (
        <input
          className={cn(ticketFieldClass, "h-7 w-40 text-[11px]")}
          placeholder="Provider name…"
          value={customDraft}
          onChange={(e) => setCustomDraft(e.target.value)}
          onBlur={() => {
            const next = customDraft.trim();
            if (!next) {
              setModuleProvider(companyId, moduleKey, "");
              return;
            }
            setModuleProvider(companyId, moduleKey, next);
            toast.success(`${moduleLabel} → ${next}`);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      ) : null}
    </div>
  );
}
