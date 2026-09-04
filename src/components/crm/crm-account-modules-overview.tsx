import { Link } from "@tanstack/react-router";
import { ArrowRight, Package } from "lucide-react";

import { ProgressBar } from "@/components/progress-bar";
import { Pill } from "@/components/status-pill";
import { Switch } from "@/components/ui/switch";
import {
  calcIntegrationsTabProgress,
  calcProductModuleProgress,
  isCrmIntegrationModule,
  isModuleGoLiveReady,
} from "@/data/crm-onboarding-defaults";
import { cn } from "@/lib/utils";
import type { CrmOnboardingRecord, CrmProductModule, CrmProductModuleKey } from "@/types/crm-onboarding";

function ModuleProgressCard({
  companyId,
  module: m,
  record,
  onOptOut,
}: {
  companyId: string;
  module: CrmProductModule;
  record: CrmOnboardingRecord;
  onOptOut?: () => void;
}) {
  const pct = calcProductModuleProgress(m, record);
  const ready = isModuleGoLiveReady(m, record);
  const isSalesCrm = m.key === "sales-crm";
  const integrationCount = record.productModules.filter(
    (mod) => mod.enabled && isCrmIntegrationModule(mod.key),
  ).length;
  const integrationPct = isSalesCrm ? calcIntegrationsTabProgress(record) : 0;
  const stepHint = isSalesCrm
    ? `Integrations (${integrationCount} opted, ${integrationPct}%) · Masters · Migration · Training · Reports`
    : `${m.workflow?.filter((s) => s.done).length ?? 0}/${m.workflow?.length ?? 0} workflow steps complete`;

  return (
    <div
      className={cn(
        "card-soft flex flex-col gap-2 border p-3 transition-all",
        ready && "border-success/30",
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
              {m.label}
            </div>
            {!isSalesCrm && m.provider?.trim() ? (
              <div className="mt-1 text-xs text-muted-foreground">
                Provider: <span className="font-medium text-foreground">{m.provider}</span>
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Pill tone={ready ? "success" : pct > 0 ? "info" : "muted"} className="text-[10px]">
              {ready ? "Ready" : `${pct}%`}
            </Pill>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
          </div>
        </div>
        <ProgressBar value={pct} className="mt-2 h-1.5" />
        <div className="mt-1 text-[10px] text-muted-foreground">{stepHint}</div>
      </Link>
      {onOptOut ? (
        <label
          className="flex cursor-pointer items-center justify-between gap-2 border-t border-border/60 pt-2"
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
      ) : null}
    </div>
  );
}

type Props = {
  companyId: string;
  modules: CrmProductModule[];
  record: CrmOnboardingRecord;
  emptyModulesHint?: string;
  className?: string;
};

/** Dashboard overview — progress per subscribed core module (integrations live under Sales CRM). */
export function CrmAccountModulesOverview({
  companyId,
  modules,
  record,
  emptyModulesHint = "None selected yet.",
  className,
  onModuleOptOut,
}: Props & {
  onModuleOptOut?: (key: CrmProductModuleKey, label: string) => void;
}) {
  const core = modules.filter((m) => m.enabled && !isCrmIntegrationModule(m.key));

  return (
    <div className={cn("space-y-2", className)}>
      {core.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyModulesHint}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {core.map((m) => (
            <ModuleProgressCard
              key={m.key}
              companyId={companyId}
              module={m}
              record={record}
              onOptOut={
                onModuleOptOut ? () => onModuleOptOut(m.key, m.label) : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
