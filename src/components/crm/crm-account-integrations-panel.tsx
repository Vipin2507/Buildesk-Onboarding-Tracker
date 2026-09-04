import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

import { CrmModuleProviderSelect } from "@/components/crm/crm-module-provider-select";
import { CrmModuleWorkflowSteps } from "@/components/crm/crm-module-workflow-steps";
import {
  DesignTicketSection,
  TICKET_EASE,
} from "@/components/design-ticket/design-ticket-shared";
import { Pill } from "@/components/status-pill";
import { Switch } from "@/components/ui/switch";
import {
  calcModuleWorkflowProgress,
  isCrmIntegrationModule,
  moduleRequiresProvider,
} from "@/data/crm-onboarding-defaults";
import { useCrmOnboardingStore } from "@/stores";
import type { CrmProductModuleKey } from "@/types/crm-onboarding";

type Props = {
  companyId: string;
};

export function CrmAccountIntegrationsPanel({ companyId }: Props) {
  const record = useCrmOnboardingStore((s) => s.getByCompanyId(companyId))!;
  const setEnabled = useCrmOnboardingStore((s) => s.setProductModuleEnabled);

  const inScope = (key: CrmProductModuleKey) => isCrmIntegrationModule(key);

  const enabled = record.productModules.filter((m) => m.enabled && inScope(m.key));
  const available = record.productModules.filter((m) => !m.enabled && inScope(m.key));
  const needsProvider = enabled.filter((m) => moduleRequiresProvider(m.key) && !m.provider).length;

  return (
    <div className="space-y-2.5">
      <DesignTicketSection
        compact
        title="Opted integrations & workflow"
        action={
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {enabled.length} opted
            {needsProvider > 0 ? ` · ${needsProvider} need provider` : ""}
          </span>
        }
      >
        <p className="mb-2 text-[10px] text-muted-foreground">
          Channel and lead integrations for Sales CRM. Select a provider where required, then
          complete workflow steps.
        </p>

        {enabled.length === 0 ? (
          <div className="rounded-lg border border-dashed px-3 py-8 text-center text-xs text-muted-foreground">
            No integrations opted yet. Toggle an integration below to start tracking its workflow.
          </div>
        ) : (
          <div className="space-y-1.5">
            <AnimatePresence initial={false}>
              {enabled.map((m) => {
                const requiresProvider = moduleRequiresProvider(m.key);
                const pct = calcModuleWorkflowProgress(m);
                const steps = m.workflow ?? [];
                return (
                  <motion.div
                    key={m.key}
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
                          {m.label}
                          {requiresProvider ? (
                            <Pill
                              tone={m.provider ? "success" : "warning"}
                              className="max-w-[12rem] truncate"
                            >
                              {m.provider ?? "Provider pending"}
                            </Pill>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {requiresProvider ? (
                          <CrmModuleProviderSelect
                            companyId={companyId}
                            moduleKey={m.key}
                            moduleLabel={m.label}
                            provider={m.provider}
                          />
                        ) : null}
                        <Switch
                          size="sm"
                          checked={m.enabled}
                          onCheckedChange={(v) => {
                            setEnabled(companyId, m.key, v === true);
                            toast.success(v ? `${m.label} opted` : `${m.label} removed`);
                          }}
                        />
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
              })}
            </AnimatePresence>
          </div>
        )}
      </DesignTicketSection>

      <DesignTicketSection compact title="Available integrations">
        <p className="mb-2 text-[10px] text-muted-foreground">
          Toggle to opt an integration in for this customer.
        </p>
        {available.length === 0 ? (
          <div className="rounded-lg border border-dashed px-3 py-6 text-center text-[11px] text-muted-foreground">
            All integrations are opted in.
          </div>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((m) => (
              <label
                key={m.key}
                className="card-soft flex cursor-pointer items-center justify-between gap-2 p-2.5 text-xs transition-colors"
              >
                <span className="min-w-0 truncate font-medium">
                  {m.label}
                  {moduleRequiresProvider(m.key) ? (
                    <span className="ml-1 text-[10px] text-muted-foreground">· provider</span>
                  ) : null}
                </span>
                <Switch
                  size="sm"
                  checked={m.enabled}
                  onCheckedChange={(v) => {
                    setEnabled(companyId, m.key, v === true);
                    toast.success(v ? `${m.label} opted` : `${m.label} removed`);
                  }}
                />
              </label>
            ))}
          </div>
        )}
      </DesignTicketSection>
    </div>
  );
}
