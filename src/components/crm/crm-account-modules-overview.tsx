import { Link2, Package } from "lucide-react";

import { ProgressBar } from "@/components/progress-bar";
import { Pill } from "@/components/status-pill";
import {
  calcModuleWorkflowProgress,
  isCrmIntegrationModule,
} from "@/data/crm-onboarding-defaults";
import { cn } from "@/lib/utils";
import type { CrmProductModule } from "@/types/crm-onboarding";

function CoreModuleCard({ module: m }: { module: CrmProductModule }) {
  return (
    <div className="card-soft flex items-center gap-2 p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Package className="h-4 w-4" />
      </div>
      <div className="min-w-0 text-sm font-semibold leading-snug">{m.label}</div>
    </div>
  );
}

function IntegrationModuleCard({ module: m }: { module: CrmProductModule }) {
  const pct = calcModuleWorkflowProgress(m);
  const steps = m.workflow ?? [];

  return (
    <div className="card-soft flex flex-col gap-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-snug">{m.label}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Provider:{" "}
            <span className="font-medium text-foreground">{m.provider?.trim() || "Not set"}</span>
          </div>
        </div>
        <Pill tone={pct >= 100 ? "success" : pct > 0 ? "info" : "muted"} className="shrink-0 text-[10px]">
          {pct}%
        </Pill>
      </div>
      <ProgressBar value={pct} className="h-1.5" />
      <div className="text-[10px] text-muted-foreground">
        {steps.filter((s) => s.done).length}/{steps.length} workflow steps complete
      </div>
    </div>
  );
}

type Props = {
  modules: CrmProductModule[];
  emptyModulesHint?: string;
  emptyIntegrationsHint?: string;
  className?: string;
};

/** Dashboard overview — core modules are display-only; integrations show setup progress. */
export function CrmAccountModulesOverview({
  modules,
  emptyModulesHint = "None selected yet.",
  emptyIntegrationsHint = "None selected yet.",
  className,
}: Props) {
  const enabled = modules.filter((m) => m.enabled);
  const core = enabled.filter((m) => !isCrmIntegrationModule(m.key));
  const integrations = enabled.filter((m) => isCrmIntegrationModule(m.key));

  return (
    <div className={cn("space-y-4", className)}>
      <section className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <Package className="h-3.5 w-3.5 text-primary" />
          Modules
          <span className="font-normal text-muted-foreground">({core.length})</span>
        </div>
        {core.length === 0 ? (
          <p className="text-xs text-muted-foreground">{emptyModulesHint}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {core.map((m) => (
              <CoreModuleCard key={m.key} module={m} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <Link2 className="h-3.5 w-3.5 text-primary" />
          Integrations
          <span className="font-normal text-muted-foreground">({integrations.length})</span>
        </div>
        {integrations.length === 0 ? (
          <p className="text-xs text-muted-foreground">{emptyIntegrationsHint}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {integrations.map((m) => (
              <IntegrationModuleCard key={m.key} module={m} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
