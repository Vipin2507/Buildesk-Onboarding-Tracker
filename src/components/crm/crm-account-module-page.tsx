import { useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  Link2,
  Rocket,
  TrendingUp,
  Upload,
} from "lucide-react";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { CrmAccountIntegrationsPanel } from "@/components/crm/crm-account-integrations-panel";
import { CrmCpApplicationWorkflow } from "@/components/crm/crm-cp-application-workflow";
import { CrmMasterChecklistDetail } from "@/components/crm/crm-master-checklist-detail";
import { CrmMigrationChecklistDetail } from "@/components/crm/crm-migration-checklist-detail";
import { CrmModuleProviderSelect } from "@/components/crm/crm-module-provider-select";
import { CrmModuleWorkflowSteps } from "@/components/crm/crm-module-workflow-steps";
import { CrmReportsChecklist } from "@/components/crm/crm-reports-checklist";
import { CrmTrainingChecklist } from "@/components/crm/crm-training-checklist";
import {
  DesignTicketPageHeader,
  DesignTicketTabNav,
  TICKET_EASE,
} from "@/components/design-ticket/design-ticket-shared";
import { PageWrap } from "@/components/page-header";
import { ProgressBar } from "@/components/progress-bar";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  calcIntegrationsTabProgress,
  calcProductModuleProgress,
  calcReportsTabProgress,
  calcSalesCrmModuleProgress,
  calcTrainingTabProgress,
  isModuleGoLiveReady,
  moduleRequiresProvider,
} from "@/data/crm-onboarding-defaults";
import { calcChecklistProgress } from "@/lib/checklist";
import {
  parseCrmSalesCrmSection,
  type CrmSalesCrmSectionId,
} from "@/lib/crm-route-search";
import { cn } from "@/lib/utils";
import { useCrmAccountStore, useCrmOnboardingStore } from "@/stores";
import type { CrmProductModule, CrmProductModuleKey } from "@/types/crm-onboarding";

const TAB_MOTION = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.22, ease: TICKET_EASE },
};

const SALES_CRM_SECTIONS = [
  { id: "integrations", label: "Integrations", icon: Link2 },
  { id: "masters", label: "Masters", icon: ClipboardList },
  { id: "migration", label: "Migration", icon: Upload },
  { id: "training", label: "Training", icon: GraduationCap },
  { id: "reports", label: "Reports", icon: TrendingUp },
  { id: "golive", label: "Go-Live", icon: Rocket },
] as const;

type Props = {
  accountId: string;
  moduleKey: CrmProductModuleKey;
  section?: string;
};

export function CrmAccountModulePage({ accountId, moduleKey, section: sectionParam }: Props) {
  const navigate = useNavigate();
  const account = useCrmAccountStore((s) => s.getById(accountId));
  const record = useCrmOnboardingStore((s) => s.getByCompanyId(accountId));

  const module = record?.productModules.find((m) => m.key === moduleKey);
  const isSalesCrm = moduleKey === "sales-crm";
  const section = isSalesCrm ? parseCrmSalesCrmSection(sectionParam) : null;

  const progress = useMemo(() => {
    if (!record || !module) return 0;
    return calcProductModuleProgress(module, record);
  }, [module, record]);

  const moduleReady = useMemo(() => {
    if (!record || !module) return false;
    return isModuleGoLiveReady(module, record);
  }, [module, record]);

  const salesSectionProgress = useMemo(() => {
    if (!record) return {} as Record<CrmSalesCrmSectionId, number>;
    return {
      integrations: calcIntegrationsTabProgress(record),
      masters: calcChecklistProgress(record.masterChecklist),
      migration: calcChecklistProgress(record.migrationChecklist),
      training: calcTrainingTabProgress(record),
      reports: calcReportsTabProgress(record),
      golive: calcSalesCrmModuleProgress(record),
    };
  }, [record]);

  if (!account || !record || !module) {
    return null;
  }

  function setSalesSection(next: CrmSalesCrmSectionId) {
    void navigate({
      to: "/crm/accounts/$accountId/modules/$moduleKey",
      params: { accountId, moduleKey: "sales-crm" },
      search: next === "integrations" ? {} : { section: next },
      replace: true,
    });
  }

  return (
    <PageWrap compact>
      <Breadcrumbs
        items={[
          { label: "Accounts", to: "/crm/accounts" },
          {
            label: account.name,
            to: "/crm/accounts/$accountId",
            params: { accountId },
            search: { tab: "modules" },
          },
          { label: module.label },
        ]}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: TICKET_EASE }}
      >
        <DesignTicketPageHeader
          compact
          title={module.label}
          subtitle={
            isSalesCrm
              ? "Integrations, masters, migration, training, reports & module go-live"
              : "Complete workflow steps and mark this module go-live ready"
          }
          actions={
            <div className="flex flex-wrap items-center gap-1.5">
              <Pill tone={moduleReady ? "success" : progress > 0 ? "info" : "muted"}>
                {moduleReady ? "Go-live ready" : `${progress}%`}
              </Pill>
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" asChild>
                <Link
                  to="/crm/accounts/$accountId"
                  params={{ accountId }}
                  search={{ tab: "modules" }}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to modules
                </Link>
              </Button>
            </div>
          }
        />

        <div className="card-soft mb-3 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Module completion
              </div>
              <div className="mt-0.5 text-xl font-semibold tabular-nums">{progress}%</div>
            </div>
            {moduleReady ? (
              <div className="flex items-center gap-1.5 text-xs text-success">
                <CheckCircle2 className="h-4 w-4" />
                Ready for account go-live sync
              </div>
            ) : null}
          </div>
          <ProgressBar value={progress} className="mt-2 h-2" />
        </div>

        {isSalesCrm ? (
          <>
            <DesignTicketTabNav
              compact
              tabs={SALES_CRM_SECTIONS.map((s) => ({
                id: s.id,
                label: s.label,
                icon: s.icon,
                badge:
                  salesSectionProgress[s.id] >= 100 ? undefined : salesSectionProgress[s.id],
              }))}
              activeId={section ?? "integrations"}
              onChange={(id) => setSalesSection(id as CrmSalesCrmSectionId)}
            />

            <AnimatePresence mode="wait">
              <motion.div key={section} {...TAB_MOTION} className="min-w-0 pt-2">
                {section === "integrations" ? (
                  <CrmAccountIntegrationsPanel companyId={accountId} />
                ) : null}
                {section === "masters" ? (
                  <CrmMasterChecklistDetail companyId={accountId} />
                ) : null}
                {section === "migration" ? (
                  <CrmMigrationChecklistDetail companyId={accountId} />
                ) : null}
                {section === "training" ? (
                  <CrmTrainingChecklist companyId={accountId} />
                ) : null}
                {section === "reports" ? (
                  <CrmReportsChecklist companyId={accountId} />
                ) : null}
                {section === "golive" ? (
                  <SalesCrmModuleGoLivePanel
                    progress={progress}
                    sectionProgress={salesSectionProgress}
                  />
                ) : null}
              </motion.div>
            </AnimatePresence>
          </>
        ) : (
          <CoreModulePageBody
            accountId={accountId}
            module={module}
            progress={progress}
            moduleReady={moduleReady}
          />
        )}
      </motion.div>
    </PageWrap>
  );
}

function SalesCrmModuleGoLivePanel({
  progress,
  sectionProgress,
}: {
  progress: number;
  sectionProgress: Record<CrmSalesCrmSectionId, number>;
}) {
  const ready = progress >= 100;

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {SALES_CRM_SECTIONS.filter((s) => s.id !== "golive").map((s) => {
          const pct = sectionProgress[s.id];
          return (
            <div key={s.id} className="card-soft p-2.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium">{s.label}</span>
                <Pill tone={pct >= 100 ? "success" : "muted"} className="text-[9px]">
                  {pct}%
                </Pill>
              </div>
              <ProgressBar value={pct} className="mt-2 h-1.5" />
            </div>
          );
        })}
      </div>

      <div
        className={cn(
          "card-soft border p-3",
          ready ? "border-success/40 bg-success/5" : "border-border",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">Sales CRM module go-live</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {ready
                ? "All Sales CRM sections are complete. Account go-live checklist rows sync automatically."
                : "Complete integrations, masters, migration, training, and reports to mark this module ready."}
            </p>
          </div>
          {ready ? (
            <Pill tone="success" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Module ready
            </Pill>
          ) : (
            <span className="text-sm font-semibold tabular-nums text-muted-foreground">
              {progress}%
            </span>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-dashed bg-muted/20 p-2 text-[10px] text-muted-foreground">
        Account-level go-live verification, sign-off, and handover sync automatically on the
        account Go-Live tab when these sections reach 100%.
      </div>
    </div>
  );
}

function CoreModulePageBody({
  accountId,
  module,
  progress,
  moduleReady,
}: {
  accountId: string;
  module: CrmProductModule;
  progress: number;
  moduleReady: boolean;
}) {
  const steps = module.workflow ?? [];

  return (
    <div className="space-y-3">
      <div className="card-soft p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold">{module.label} workflow</div>
            {moduleRequiresProvider(module.key) ? (
              <div className="mt-2">
                <CrmModuleProviderSelect
                  companyId={accountId}
                  moduleKey={module.key}
                  moduleLabel={module.label}
                  provider={module.provider}
                />
              </div>
            ) : null}
          </div>
          <Pill tone={moduleReady ? "success" : "info"}>{progress}%</Pill>
        </div>

        {module.key === "cp-application" ? (
          <CrmCpApplicationWorkflow
            companyId={accountId}
            moduleLabel={module.label}
            steps={steps}
            progress={progress}
            className="mt-3"
          />
        ) : (
          <CrmModuleWorkflowSteps
            companyId={accountId}
            moduleKey={module.key}
            moduleLabel={module.label}
            steps={steps}
            progress={progress}
            className="mt-3"
          />
        )}
      </div>

      <div
        className={cn(
          "card-soft border p-3",
          moduleReady ? "border-success/40 bg-success/5" : "border-border",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <Rocket className="h-4 w-4 text-primary" />
              Module go-live
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {moduleReady
                ? "Workflow complete — this module contributes to account go-live readiness."
                : "Complete all workflow steps including the go-live step to mark this module ready."}
            </p>
          </div>
          {moduleReady ? (
            <Pill tone="success">
              <CheckCircle2 className="mr-1 inline h-3 w-3" />
              Ready
            </Pill>
          ) : null}
        </div>
        <ProgressBar value={progress} className="mt-2 h-1.5" />
      </div>
    </div>
  );
}
