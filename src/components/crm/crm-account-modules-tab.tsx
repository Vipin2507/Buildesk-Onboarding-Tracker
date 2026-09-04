import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Package } from "lucide-react";
import { toast } from "sonner";

import {
  DesignTicketSection,
  TICKET_EASE,
} from "@/components/design-ticket/design-ticket-shared";
import { ProgressBar } from "@/components/progress-bar";
import { Pill } from "@/components/status-pill";
import { Switch } from "@/components/ui/switch";
import {
  calcProductModuleProgress,
  isCrmCoreModule,
  isModuleGoLiveReady,
} from "@/data/crm-onboarding-defaults";
import { cn } from "@/lib/utils";
import { getCrmMasterProductModuleCatalog } from "@/stores/useCrmMasterStore";
import { useCrmOnboardingStore } from "@/stores";
import type { CrmOnboardingRecord, CrmProductModule, CrmProductModuleKey } from "@/types/crm-onboarding";

type Props = {
  companyId: string;
};

function ModuleSummaryCard({
  companyId,
  module: m,
  record,
  onOptOut,
}: {
  companyId: string;
  module: CrmProductModule;
  record: CrmOnboardingRecord;
  onOptOut: () => void;
}) {
  const pct = calcProductModuleProgress(m, record);
  const ready = isModuleGoLiveReady(m, record);
  const hint =
    m.key === "sales-crm"
      ? "Integrations · Masters · Migration · Training · Reports"
      : `${m.workflow?.filter((s) => s.done).length ?? 0}/${m.workflow?.length ?? 0} steps`;

  return (
    <div
      className={cn(
        "card-soft border p-3 transition-all",
        ready ? "border-success/30 bg-success/[0.03]" : "border-border",
      )}
    >
      <Link
        to="/crm/accounts/$accountId/modules/$moduleKey"
        params={{ accountId: companyId, moduleKey: m.key }}
        className="group block"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <Package className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">{m.label}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">{hint}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Pill tone={ready ? "success" : pct > 0 ? "info" : "muted"} className="text-[9px]">
              {ready ? "Ready" : `${pct}%`}
            </Pill>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </div>
        </div>
        <ProgressBar value={pct} className="mt-2.5 h-1.5" />
      </Link>
      <label
        className="mt-2.5 flex cursor-pointer items-center justify-between gap-2 border-t border-border/60 pt-2"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-[10px] font-medium text-muted-foreground">Opted in</span>
        <Switch
          size="sm"
          checked
          onCheckedChange={(v) => {
            if (v !== true) onOptOut();
          }}
        />
      </label>
    </div>
  );
}

export function CrmAccountModulesTab({ companyId }: Props) {
  const record = useCrmOnboardingStore((s) => s.getByCompanyId(companyId))!;
  const setEnabled = useCrmOnboardingStore((s) => s.setProductModuleEnabled);

  const catalogKeys = new Set(getCrmMasterProductModuleCatalog().map((m) => m.key));
  const inScope = (key: CrmProductModuleKey) => isCrmCoreModule(key) && catalogKeys.has(key);

  const enabled = record.productModules.filter((m) => m.enabled && inScope(m.key));
  const available = record.productModules.filter((m) => !m.enabled && inScope(m.key));

  function toggleModule(key: CrmProductModuleKey, label: string, next: boolean) {
    setEnabled(companyId, key, next);
    toast.success(next ? `${label} subscribed` : `${label} opted out`);
  }

  return (
    <div className="space-y-2.5">
      <DesignTicketSection
        compact
        title="Subscribed modules"
        action={
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {enabled.length} opted
          </span>
        }
      >
        <p className="mb-2 text-[10px] text-muted-foreground">
          Open a module to complete its workflow. Sales CRM includes integrations, masters,
          migration, training, reports, and module go-live on a dedicated page.
        </p>

        {enabled.length === 0 ? (
          <div className="rounded-lg border border-dashed px-3 py-8 text-center text-xs text-muted-foreground">
            No modules subscribed yet.
            {available.length > 0 ? " Enable modules from Available modules below." : null}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence initial={false}>
              {enabled.map((m) => (
                <motion.div
                  key={m.key}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22, ease: TICKET_EASE }}
                >
                  <ModuleSummaryCard
                    companyId={companyId}
                    module={m}
                    record={record}
                    onOptOut={() => toggleModule(m.key, m.label, false)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </DesignTicketSection>

      {available.length > 0 ? (
        <DesignTicketSection compact title="Available modules">
          <p className="mb-2 text-[10px] text-muted-foreground">
            Toggle to subscribe this account to a module.
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((m) => (
              <label
                key={m.key}
                className="card-soft flex cursor-pointer items-center justify-between gap-2 p-2.5 text-xs transition-colors hover:bg-muted/20"
              >
                <span className="min-w-0 truncate font-medium">{m.label}</span>
                <Switch
                  size="sm"
                  checked={m.enabled}
                  onCheckedChange={(v) => toggleModule(m.key, m.label, v === true)}
                />
              </label>
            ))}
          </div>
        </DesignTicketSection>
      ) : enabled.length > 0 ? (
        <p className="text-center text-[11px] text-muted-foreground">
          All catalog modules are subscribed for this account.
        </p>
      ) : null}
    </div>
  );
}
