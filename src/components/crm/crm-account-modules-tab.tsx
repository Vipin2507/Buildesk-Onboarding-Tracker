import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Package } from "lucide-react";
import { toast } from "sonner";

import { CrmModuleProviderSelect } from "@/components/crm/crm-module-provider-select";
import { CrmModuleWorkflowSteps } from "@/components/crm/crm-module-workflow-steps";
import {
  DesignTicketSection,
  TICKET_EASE,
} from "@/components/design-ticket/design-ticket-shared";
import { ProgressBar } from "@/components/progress-bar";
import { Pill } from "@/components/status-pill";
import { Switch } from "@/components/ui/switch";
import {
  calcProductModuleProgress,
  calcSalesCrmModuleProgress,
  isCrmCoreModule,
  moduleHasWorkflow,
  moduleRequiresProvider,
} from "@/data/crm-onboarding-defaults";
import { calcChecklistProgress } from "@/lib/checklist";
import { getCrmMasterProductModuleCatalog } from "@/stores/useCrmMasterStore";
import { useCrmOnboardingStore } from "@/stores";
import type { CrmOnboardingRecord, CrmProductModule, CrmProductModuleKey } from "@/types/crm-onboarding";

type Props = {
  companyId: string;
};

function SalesCrmModuleCard({
  module: m,
  record,
  onToggle,
}: {
  companyId: string;
  module: CrmProductModule;
  record: CrmOnboardingRecord;
  onToggle: (enabled: boolean) => void;
}) {
  const pct = calcSalesCrmModuleProgress(record);
  const sections = [
    { label: "Masters", value: calcChecklistProgress(record.masterChecklist) },
    { label: "Migration", value: calcChecklistProgress(record.migrationChecklist) },
    {
      label: "Training",
      value: Math.round(
        (() => {
          const applicable = record.trainingSessions.filter((s) => !s.notApplicable);
          if (applicable.length === 0) return 100;
          const done = applicable.filter((s) => s.completed || (s.sessionCount ?? 0) > 0).length;
          return (done / applicable.length) * 100;
        })(),
      ),
    },
    {
      label: "Reports",
      value: Math.round(
        (() => {
          const applicable = record.reportChecklist.filter((r) => !r.notApplicable);
          if (applicable.length === 0) return 100;
          const done = applicable.filter((r) => r.status === "explained").length;
          return (done / applicable.length) * 100;
        })(),
      ),
    },
  ];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: TICKET_EASE }}
      className="card-soft border-primary/30 bg-primary/5 p-2.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <Package className="h-3.5 w-3.5 shrink-0 text-primary" />
            {m.label}
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">
            Track via Masters, Migration, Training & Reports tabs · {pct}%
          </div>
        </div>
        <Switch size="sm" checked={m.enabled} onCheckedChange={(v) => onToggle(v === true)} />
      </div>
      <ProgressBar value={pct} className="mt-2 h-1.5" />
      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {sections.map((s) => (
          <div key={s.label} className="rounded-md border bg-background/60 px-2 py-1.5">
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="font-medium tabular-nums">{s.value}%</span>
            </div>
            <ProgressBar value={s.value} className="mt-1 h-1" />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function CoreModuleWorkflowCard({
  companyId,
  module: m,
  record,
  onToggle,
}: {
  companyId: string;
  module: CrmProductModule;
  record: CrmOnboardingRecord;
  onToggle: (enabled: boolean) => void;
}) {
  const pct = calcProductModuleProgress(m, record);
  const steps = m.workflow ?? [];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: TICKET_EASE }}
      className="card-soft border-primary/30 bg-primary/5 p-2.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <Package className="h-3.5 w-3.5 shrink-0 text-primary" />
            {m.label}
            {moduleRequiresProvider(m.key) && !m.provider ? (
              <Pill tone="warning" className="text-[10px]">
                Provider pending
              </Pill>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {moduleRequiresProvider(m.key) ? (
            <CrmModuleProviderSelect
              companyId={companyId}
              moduleKey={m.key}
              moduleLabel={m.label}
              provider={m.provider}
            />
          ) : null}
          <Switch size="sm" checked={m.enabled} onCheckedChange={(v) => onToggle(v === true)} />
        </div>
      </div>

      <CrmModuleWorkflowSteps
        companyId={companyId}
        moduleKey={m.key}
        moduleLabel={m.label}
        steps={steps}
        progress={pct}
        className="mt-2"
      />
    </motion.div>
  );
}

export function CrmAccountModulesTab({ companyId }: Props) {
  const record = useCrmOnboardingStore((s) => s.getByCompanyId(companyId))!;
  const setEnabled = useCrmOnboardingStore((s) => s.setProductModuleEnabled);

  const catalogKeys = useMemo(
    () => new Set(getCrmMasterProductModuleCatalog().map((m) => m.key)),
    [],
  );

  const inScope = (key: CrmProductModuleKey) => isCrmCoreModule(key) && catalogKeys.has(key);

  const enabled = record.productModules.filter((m) => m.enabled && inScope(m.key));
  const available = record.productModules.filter((m) => !m.enabled && inScope(m.key));

  function toggleModule(key: CrmProductModuleKey, label: string, enabled: boolean) {
    setEnabled(companyId, key, enabled);
    toast.success(enabled ? `${label} subscribed` : `${label} removed`);
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
          Core CRM product modules for this account. Complete each module&apos;s workflow steps to
          track onboarding progress. Sales CRM uses the Masters, Migration, Training, and Reports
          tabs.
        </p>

        {enabled.length === 0 ? (
          <div className="rounded-lg border border-dashed px-3 py-8 text-center text-xs text-muted-foreground">
            No modules subscribed yet.
            {available.length > 0 ? " Enable modules from Available modules below." : null}
          </div>
        ) : (
          <div className="space-y-1.5">
            <AnimatePresence initial={false}>
              {enabled.map((m) =>
                m.key === "sales-crm" ? (
                  <SalesCrmModuleCard
                    key={m.key}
                    companyId={companyId}
                    module={m}
                    record={record}
                    onToggle={(v) => toggleModule(m.key, m.label, v)}
                  />
                ) : moduleHasWorkflow(m.key) ? (
                  <CoreModuleWorkflowCard
                    key={m.key}
                    companyId={companyId}
                    module={m}
                    record={record}
                    onToggle={(v) => toggleModule(m.key, m.label, v)}
                  />
                ) : (
                  <motion.div
                    key={m.key}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.22, ease: TICKET_EASE }}
                    className="card-soft flex items-center justify-between gap-2 p-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Package className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium">{m.label}</div>
                        <Pill tone="success" className="mt-0.5 text-[10px]">
                          Subscribed
                        </Pill>
                      </div>
                    </div>
                    <Switch
                      size="sm"
                      checked={m.enabled}
                      onCheckedChange={(v) => toggleModule(m.key, m.label, v === true)}
                    />
                  </motion.div>
                ),
              )}
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
