import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Lock,
  MessageSquare,
  Package,
  Pencil,
  Plus,
  Rocket,
  Send,
  Ticket,
  TrendingUp,
  Upload,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  CrmAccountFormFields,
  crmAccountSchema,
  crmAccountToFormValues,
  normalizeCrmAccountForm,
  type CrmAccountFormValues,
} from "@/components/crm/crm-account-form";
import { CrmAccountPortalPanel } from "@/components/crm/crm-account-portal-panel";
import { CrmGoLiveChecklist } from "@/components/crm/crm-go-live-checklist";
import { CrmMasterChecklistDetail } from "@/components/crm/crm-master-checklist-detail";
import { CrmMigrationChecklistDetail } from "@/components/crm/crm-migration-checklist-detail";
import { CrmReportsChecklist } from "@/components/crm/crm-reports-checklist";
import { CrmTrainingChecklist } from "@/components/crm/crm-training-checklist";
import { DatePickerField } from "@/components/date-picker-field";
import {
  DesignTicketKpiGrid,
  DesignTicketPageHeader,
  DesignTicketSection,
  DesignTicketTabNav,
  TICKET_EASE,
  ticketFieldClass,
  ticketSelectClass,
  ticketTextareaClass,
} from "@/components/design-ticket/design-ticket-shared";
import { ConfirmDeleteDialog, EntityFormModal } from "@/components/entity-form-modal";
import { PageWrap } from "@/components/page-header";
import { Pill } from "@/components/status-pill";
import { ProgressBar } from "@/components/progress-bar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  CRM_COMM_ACTIONS,
  CRM_STAGE_LABELS,
  calcCrmOnboardingProgress,
  calcModuleWorkflowProgress,
  crmPendingActivityCount,
  moduleRequiresProvider,
} from "@/data/crm-onboarding-defaults";
import { calcChecklistProgress } from "@/lib/checklist";
import {
  CRM_PROVIDER_OTHER,
  isCustomCrmProvider,
  useCrmProviderOptions,
} from "@/lib/crm-providers";
import {
  crmAssigneeSelectPatch,
  crmAssigneeSelectValue,
  resolveCrmSalesManagerDefaults,
  withCrmSalesManagerOption,
} from "@/lib/crm-sales-manager-defaults";
import { resolveAssigneeLabel } from "@/lib/managers";
import { cn, formatDate } from "@/lib/utils";
import { isTicketOpen } from "@/lib/tickets";
import {
  useAuthStore,
  useCrmAccountStore,
  useCrmOnboardingStore,
  useEmployeeStore,
  useTicketStore,
  useUserStore,
} from "@/stores";
import type {
  CrmCommChannel,
  CrmImplementationStage,
  CrmProductModuleKey,
  CrmTrackerPriority,
} from "@/types/crm-onboarding";
import { nowIso } from "@/types/common";
import type { TicketPriority, TicketStatus, TicketType } from "@/types/ticket";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "modules", label: "Modules", icon: Package },
  { id: "masters", label: "Masters", icon: ClipboardList },
  { id: "migration", label: "Migration", icon: Upload },
  { id: "training", label: "Training", icon: GraduationCap },
  { id: "reports", label: "Reports", icon: TrendingUp },
  { id: "golive", label: "Go-Live", icon: Rocket },
  { id: "tracker", label: "Tracker", icon: CheckCircle2 },
  { id: "tickets", label: "Tickets", icon: Ticket },
  { id: "comms", label: "Comms", icon: MessageSquare },
] as const;

type TabId = (typeof TABS)[number]["id"];

const fieldClass = cn(ticketFieldClass, "h-8 text-xs");
const selectClass = cn(ticketSelectClass, "h-8 text-xs");
const areaClass = cn(ticketTextareaClass, "min-h-[72px] text-xs");

const TAB_MOTION = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.22, ease: TICKET_EASE },
};

/** Account hub for the standalone CRM product (`companyId` in store = CRM account id). */
export function CrmOnboardingHub({
  accountId,
  accountName,
  progress,
}: {
  accountId: string;
  accountName: string;
  progress?: number;
}) {
  const account = useCrmAccountStore((s) => s.accounts.find((a) => a.id === accountId));
  const markLive = useCrmAccountStore((s) => s.markLive);
  const completeAllGoLiveItems = useCrmOnboardingStore((s) => s.completeAllGoLiveItems);
  const updateTracker = useCrmOnboardingStore((s) => s.updateTracker);
  const ensureForCompany = useCrmOnboardingStore((s) => s.ensureForCompany);
  const record = useCrmOnboardingStore((s) => s.getByCompanyId(accountId));
  const tickets = useTicketStore((s) => s.tickets);
  const currentUser = useAuthStore((s) => s.user);

  const [tab, setTab] = useState<TabId>("dashboard");
  const [confirmForceLive, setConfirmForceLive] = useState(false);

  useEffect(() => {
    ensureForCompany(accountId, account?.companyType);
  }, [accountId, account?.companyType, ensureForCompany]);

  const liveRecord = record ?? ensureForCompany(accountId, account?.companyType);
  const pct = calcCrmOnboardingProgress(liveRecord);
  const pending = crmPendingActivityCount(liveRecord);
  const openTickets = tickets.filter((t) => t.companyId === accountId && isTicketOpen(t)).length;
  const isLive = account?.status === "live";

  const kpis = [
    { id: "progress", label: "Completion", value: pct, icon: TrendingUp, tone: "text-primary" },
    { id: "pending", label: "Pending", value: pending, icon: ClipboardList, tone: "text-warning-foreground" },
    { id: "tickets", label: "Open tickets", value: openTickets, icon: Ticket },
    {
      id: "modules",
      label: "CRM modules",
      value: liveRecord.productModules.filter((m) => m.enabled).length,
      icon: Package,
      tone: "text-success",
    },
  ];

  if (!account) return null;

  return (
    <PageWrap compact>
      <Breadcrumbs
        items={[
          { label: "Accounts", to: "/crm/accounts" },
          { label: accountName },
        ]}
      />
      <DesignTicketPageHeader
        compact
        title="CRM Onboarding"
        subtitle={`${accountName} · ${account.companyType ?? "Account"} · ${account.usersPurchased ?? "—"} users · Implementation tracker`}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill tone={isLive ? "success" : "muted"}>{isLive ? "Live" : "Not Live"}</Pill>
            <span className="text-xs tabular-nums text-muted-foreground">{progress ?? pct}%</span>
            {!isLive ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs"
                  onClick={() => setTab("golive")}
                >
                  Go-Live checklist
                </Button>
                <Button
                  size="sm"
                  className="h-8 gap-1 bg-success text-xs text-white hover:bg-success/90"
                  onClick={() => setConfirmForceLive(true)}
                >
                  <Rocket className="h-3.5 w-3.5" />
                  Go Live & Complete
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      <div className="mb-3 min-w-0">
        <DesignTicketKpiGrid
          items={kpis.map((k) => ({
            ...k,
            onClick: () => {
              if (k.id === "tickets") setTab("tickets");
              else if (k.id === "modules") setTab("modules");
              else if (k.id === "pending") setTab("tracker");
              else setTab("dashboard");
            },
            active:
              (k.id === "tickets" && tab === "tickets") ||
              (k.id === "modules" && tab === "modules") ||
              (k.id === "pending" && tab === "tracker") ||
              (k.id === "progress" && tab === "dashboard"),
          }))}
          columns={4}
          size="compact"
        />
      </div>

      <DesignTicketTabNav
        compact
        tabs={TABS.map(({ id, label, icon }) => ({ id, label, icon }))}
        activeId={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      <AnimatePresence mode="wait">
        <motion.div key={tab} {...TAB_MOTION} className="min-w-0 pt-1">
          {tab === "dashboard" ? (
            <DashboardTab
              accountId={accountId}
              accountName={accountName}
              pct={pct}
              pending={pending}
              openTickets={openTickets}
              isLive={isLive}
            />
          ) : null}
          {tab === "modules" ? <ModulesTab companyId={accountId} /> : null}
          {tab === "masters" ? <MastersTab companyId={accountId} /> : null}
          {tab === "migration" ? <MigrationTab companyId={accountId} /> : null}
          {tab === "training" ? <TrainingTab companyId={accountId} /> : null}
          {tab === "reports" ? <ReportsTab companyId={accountId} /> : null}
          {tab === "golive" ? (
            <GoLiveTab
              companyId={accountId}
              accountName={accountName}
              isLive={isLive}
              who={currentUser?.name}
            />
          ) : null}
          {tab === "tracker" ? (
            <TrackerTab companyId={accountId} pct={pct} pending={pending} who={currentUser?.name} />
          ) : null}
          {tab === "tickets" ? <TicketsTab companyId={accountId} /> : null}
          {tab === "comms" ? <CommsTab companyId={accountId} /> : null}
        </motion.div>
      </AnimatePresence>

      <ConfirmDeleteDialog
        open={confirmForceLive}
        onOpenChange={setConfirmForceLive}
        title="Go Live & Complete account?"
        description={`This will complete remaining go-live checklist items and mark ${accountName} as Live immediately.`}
        confirmLabel="Go Live & Complete"
        confirmTone="default"
        onConfirm={() => {
          completeAllGoLiveItems(accountId);
          markLive(accountId, currentUser?.name);
          updateTracker(accountId, { stage: "customer_success", priority: "medium" }, currentUser?.name);
          toast.success(`${accountName} completed & marked Live`);
          setConfirmForceLive(false);
          setTab("golive");
        }}
      />
    </PageWrap>
  );
}

function DashboardTab({
  accountId,
  accountName,
  pct,
  pending,
  openTickets,
  isLive,
}: {
  accountId: string;
  accountName: string;
  pct: number;
  pending: number;
  openTickets: number;
  isLive: boolean;
}) {
  const account = useCrmAccountStore((s) => s.accounts.find((a) => a.id === accountId))!;
  const updateAccount = useCrmAccountStore((s) => s.updateAccount);
  const ensure = useCrmOnboardingStore((s) => s.ensureForCompany);
  const record = useCrmOnboardingStore((s) => s.getByCompanyId(accountId))!;
  const [editing, setEditing] = useState(false);

  const form = useForm<CrmAccountFormValues>({
    resolver: zodResolver(crmAccountSchema),
    defaultValues: crmAccountToFormValues(account),
  });

  useEffect(() => {
    if (editing) form.reset(crmAccountToFormValues(account));
  }, [editing, account, form]);

  const enabledMods = record.productModules.filter((m) => m.enabled);
  const trainApplicable = record.trainingSessions.filter((s) => !s.notApplicable);
  const trainPct = trainApplicable.length
    ? Math.round(
        (trainApplicable.filter((s) => s.completed || (s.sessionCount ?? 0) > 0).length /
          trainApplicable.length) *
          100,
      )
    : 0;
  const migPct = record.migrationChecklist.length
    ? calcChecklistProgress(record.migrationChecklist)
    : 0;

  const healthScore =
    account.healthScore ??
    Math.min(100, Math.round(pct * 0.7 + (isLive ? 20 : 0) + Math.max(0, 10 - openTickets * 2)));

  function saveAccount() {
    void form.handleSubmit((values) => {
      const data = normalizeCrmAccountForm(values);
      updateAccount(accountId, data);
      ensure(accountId, data.companyType);
      setEditing(false);
      toast.success("Account details updated");
    })();
  }

  return (
    <div className="space-y-2.5">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card-soft p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[10px] uppercase text-muted-foreground">Account</div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-[10px]"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
          </div>
          <div className="mt-1 text-sm font-semibold">{accountName}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {account.companyType ?? "—"} · {account.city}
            {account.state ? `, ${account.state}` : ""} · {account.region}
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">
            POC: {account.pocName || account.contact} · {account.pocMobile || account.phone}
          </div>
        </div>
        <div className="card-soft p-3">
          <div className="text-[10px] uppercase text-muted-foreground">License & payment</div>
          <div className="mt-1 text-sm font-semibold">
            {account.annualLicense ? "Annual license" : "Term license"}
          </div>
          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            <div>Users: {account.usersPurchased ?? "—"}</div>
            <div>
              Deal:{" "}
              {account.dealSize != null ? `₹${account.dealSize.toLocaleString("en-IN")}` : "—"}
            </div>
            <div>
              Received / Pending: ₹{(account.paymentReceived ?? 0).toLocaleString("en-IN")} / ₹
              {(account.pendingAmount ?? 0).toLocaleString("en-IN")}
            </div>
            <div>
              {account.startDate ? formatDate(account.startDate) : "—"} →{" "}
              {account.endDate ? formatDate(account.endDate) : "—"}
            </div>
          </div>
        </div>
        <div className="card-soft p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Health & stage</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{healthScore}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Stage: {CRM_STAGE_LABELS[record.tracker.stage] ?? record.tracker.stage}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Sales Manager: {account.salesManagerName || "—"}
          </div>
          <Pill className="mt-2" tone={isLive ? "success" : "warning"}>
            {isLive ? "Go-Live complete" : "Pre go-live"}
          </Pill>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Overall" value={`${pct}%`} bar={pct} />
        <StatCard label="Pending activities" value={String(pending)} />
        <StatCard label="Training" value={`${trainPct}%`} bar={trainPct} />
        <StatCard label="Data upload" value={`${migPct}%`} bar={migPct} />
      </div>

      <DesignTicketSection compact title="Purchased CRM modules">
        <div className="flex flex-wrap gap-1.5">
          {enabledMods.length === 0 ? (
            <span className="text-xs text-muted-foreground">None enabled yet — use Modules tab.</span>
          ) : (
            enabledMods.map((m) => (
              <Pill key={m.key} tone="accent">
                {m.label}
              </Pill>
            ))
          )}
        </div>
      </DesignTicketSection>

      <EntityFormModal
        open={editing}
        onOpenChange={setEditing}
        title="Edit account details"
        submitLabel="Save changes"
        onSubmit={saveAccount}
        contentClassName="max-w-3xl"
      >
        <CrmAccountFormFields form={form} />
      </EntityFormModal>
    </div>
  );
}

function StatCard({ label, value, bar }: { label: string; value: string; bar?: number }) {
  return (
    <div className="card-soft p-2.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
      {bar != null ? <ProgressBar value={bar} className="mt-2 h-1.5" /> : null}
    </div>
  );
}

function ModuleProviderSelect({
  companyId,
  moduleKey,
  moduleLabel,
  provider,
}: {
  companyId: string;
  moduleKey: CrmProductModuleKey;
  moduleLabel: string;
  provider?: string;
}) {
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

function ModulesTab({ companyId }: { companyId: string }) {
  const record = useCrmOnboardingStore((s) => s.getByCompanyId(companyId))!;
  const setEnabled = useCrmOnboardingStore((s) => s.setProductModuleEnabled);
  const toggleStep = useCrmOnboardingStore((s) => s.toggleModuleWorkflowStep);
  const setStepDate = useCrmOnboardingStore((s) => s.setModuleWorkflowStepDate);

  const todayYmd = new Date().toISOString().slice(0, 10);
  const [stepDialog, setStepDialog] = useState<{
    moduleKey: CrmProductModuleKey;
    stepKey: string;
    moduleLabel: string;
    stepLabel: string;
    mode: "complete" | "edit";
    canClear: boolean;
  } | null>(null);
  const [stepDateValue, setStepDateValue] = useState("");

  function confirmStepDialog() {
    if (!stepDialog || !stepDateValue) {
      toast.error("Pick a date for this step");
      return;
    }
    setStepDate(companyId, stepDialog.moduleKey, stepDialog.stepKey, stepDateValue);
    toast.success(
      stepDialog.mode === "edit"
        ? `${stepDialog.stepLabel} date updated`
        : `${stepDialog.stepLabel} completed`,
    );
    setStepDialog(null);
  }

  function clearStepDialog() {
    if (!stepDialog) return;
    toggleStep(companyId, stepDialog.moduleKey, stepDialog.stepKey, false);
    toast.success(`${stepDialog.stepLabel} cleared`);
    setStepDialog(null);
  }

  const enabled = record.productModules.filter((m) => m.enabled);
  const available = record.productModules.filter((m) => !m.enabled);
  const needsProvider = enabled.filter((m) => moduleRequiresProvider(m.key) && !m.provider).length;

  return (
    <>
    <div className="space-y-2.5">
      <DesignTicketSection
        compact
        title="Opted modules & workflow"
        action={
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {enabled.length} / {record.productModules.length} opted
            {needsProvider > 0 ? ` · ${needsProvider} need provider` : ""}
          </span>
        }
      >
        <p className="mb-2 text-[10px] text-muted-foreground">
          Opting a module seeds its implementation workflow so it can be tracked. Integration
          modules can be delivered via a provider.
        </p>

        {enabled.length === 0 ? (
          <div className="rounded-lg border border-dashed px-3 py-8 text-center text-xs text-muted-foreground">
            No modules opted yet. Toggle a module below to start tracking its workflow.
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
                            <Pill tone={m.provider ? "success" : "warning"}>
                              {m.provider ?? "Provider pending"}
                            </Pill>
                          ) : null}
                        </div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          {steps.filter((s) => s.done).length}/{steps.length} steps · {pct}%
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {requiresProvider ? (
                          <ModuleProviderSelect
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

                    <ProgressBar value={pct} className="mt-2 h-1.5" />

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {steps.map((step, idx) => {
                        const priorDone = steps.slice(0, idx).every((s) => s.done);
                        const laterDone = steps.slice(idx + 1).some((s) => s.done);
                        const isProviderStep =
                          requiresProvider && step.key === "provider_selected";
                        const locked = !step.done && !priorDone;
                        return (
                          <button
                            key={step.key}
                            type="button"
                            disabled={(locked || isProviderStep) && !step.done}
                            title={
                              isProviderStep
                                ? "Set via the provider selector above"
                                : locked
                                  ? "Complete prior steps first"
                                  : step.completedAt
                                    ? `Completed ${formatDate(step.completedAt)}`
                                    : undefined
                            }
                            onClick={() => {
                              if (isProviderStep) {
                                toast.info("Select the provider above to complete this step");
                                return;
                              }
                              if (locked) {
                                toast.error("Complete prior steps first", {
                                  description: "Steps unlock in order",
                                });
                                return;
                              }
                              setStepDialog({
                                moduleKey: m.key,
                                stepKey: step.key,
                                moduleLabel: m.label,
                                stepLabel: step.label,
                                mode: step.done ? "edit" : "complete",
                                canClear: step.done && !laterDone,
                              });
                              setStepDateValue(
                                (step.completedAt ?? todayYmd).slice(0, 10),
                              );
                            }}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                              step.done
                                ? "border-success bg-success text-white"
                                : locked
                                  ? "cursor-not-allowed border-input bg-muted/40 text-muted-foreground opacity-60"
                                  : "border-input bg-background hover:border-primary",
                            )}
                          >
                            <span className="inline-flex h-3.5 w-3.5 items-center justify-center">
                              {step.done ? (
                                <Check className="h-3 w-3" />
                              ) : locked ? (
                                <Lock className="h-2.5 w-2.5" />
                              ) : (
                                <span className="text-[9px] tabular-nums">{idx + 1}</span>
                              )}
                            </span>
                            <span className="truncate">{step.label}</span>
                            {step.done && step.completedAt ? (
                              <span className="text-[9px] font-normal opacity-90">
                                {formatDate(step.completedAt)}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </DesignTicketSection>

      <DesignTicketSection compact title="Available modules">
        <p className="mb-2 text-[10px] text-muted-foreground">
          Toggle to opt a module in for this customer.
        </p>
        {available.length === 0 ? (
          <div className="rounded-lg border border-dashed px-3 py-6 text-center text-[11px] text-muted-foreground">
            All modules are opted in.
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

      <EntityFormModal
        open={!!stepDialog}
        onOpenChange={(open) => {
          if (!open) setStepDialog(null);
        }}
        title={
          stepDialog
            ? stepDialog.mode === "edit"
              ? `Edit "${stepDialog.stepLabel}" date`
              : `Complete "${stepDialog.stepLabel}"`
            : "Workflow step"
        }
        submitLabel={stepDialog?.mode === "edit" ? "Save date" : "Confirm"}
        onSubmit={confirmStepDialog}
      >
        {stepDialog ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{stepDialog.moduleLabel}</span>
              {" · "}
              {stepDialog.stepLabel}
            </p>
            <label className="block text-xs font-medium">
              Completion date
              <DatePickerField
                modal
                className="mt-1"
                value={stepDateValue}
                onChange={(v) => setStepDateValue(v)}
              />
            </label>
            {stepDialog.canClear ? (
              <Button type="button" variant="outline" className="w-full" onClick={clearStepDialog}>
                Clear step
              </Button>
            ) : null}
          </div>
        ) : null}
      </EntityFormModal>
    </>
  );
}

function MastersTab({ companyId }: { companyId: string }) {
  return <CrmMasterChecklistDetail companyId={companyId} />;
}

function MigrationTab({ companyId }: { companyId: string }) {
  return <CrmMigrationChecklistDetail companyId={companyId} />;
}

function TrainingTab({ companyId }: { companyId: string }) {
  return <CrmTrainingChecklist companyId={companyId} />;
}

function ReportsTab({ companyId }: { companyId: string }) {
  return <CrmReportsChecklist companyId={companyId} />;
}

function GoLiveTab({
  companyId,
  accountName,
  isLive,
  who,
}: {
  companyId: string;
  accountName: string;
  isLive: boolean;
  who?: string;
}) {
  return (
    <CrmGoLiveChecklist
      companyId={companyId}
      accountName={accountName}
      isLive={isLive}
      who={who}
    />
  );
}

const TRACKER_STAGE_KEYS = Object.keys(CRM_STAGE_LABELS) as CrmImplementationStage[];

const TRACKER_PRIORITY_META: Record<
  CrmTrackerPriority,
  { label: string; tone: "muted" | "info" | "warning" | "danger" }
> = {
  low: { label: "Low", tone: "muted" },
  medium: { label: "Medium", tone: "info" },
  high: { label: "High", tone: "warning" },
  critical: { label: "Critical", tone: "danger" },
};

function TrackerTab({
  companyId,
  pct,
  pending,
  who,
}: {
  companyId: string;
  pct: number;
  pending: number;
  who?: string;
}) {
  const record = useCrmOnboardingStore((s) => s.getByCompanyId(companyId))!;
  const account = useCrmAccountStore((s) => s.getById(companyId));
  const updateTracker = useCrmOnboardingStore((s) => s.updateTracker);
  const users = useUserStore((s) => s.users);
  const employees = useEmployeeStore((s) => s.employees);
  const t = record.tracker;

  const salesManager = useMemo(
    () => resolveCrmSalesManagerDefaults(account, users),
    [account, users],
  );

  const assignees = useMemo(
    () =>
      withCrmSalesManagerOption(
        users.filter(
          (u) => u.active && (u.productScope === "crm" || !u.productScope || u.role === "Admin"),
        ),
        salesManager,
        users,
      ),
    [users, salesManager],
  );

  const currentIndex = Math.max(0, TRACKER_STAGE_KEYS.indexOf(t.stage));
  const stageCount = TRACKER_STAGE_KEYS.length;
  const stagePct = Math.round(((currentIndex + 1) / stageCount) * 100);
  const todayYmd = new Date().toISOString().slice(0, 10);
  const overdue = !!t.expectedCompletionDate && t.expectedCompletionDate < todayYmd && pct < 100;
  const priorityMeta = TRACKER_PRIORITY_META[t.priority];

  return (
    <div className="space-y-2.5">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Overall completion" value={`${pct}%`} bar={pct} />
        <div className="card-soft p-2.5">
          <div className="text-[10px] text-muted-foreground">Current stage</div>
          <div className="mt-0.5 truncate text-sm font-semibold">
            {CRM_STAGE_LABELS[t.stage]}
          </div>
          <div className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
            Step {currentIndex + 1} of {stageCount}
          </div>
          <ProgressBar value={stagePct} className="mt-1.5 h-1.5" />
        </div>
        <div className="card-soft p-2.5">
          <div className="text-[10px] text-muted-foreground">Expected completion</div>
          <div className="mt-0.5 text-sm font-semibold tabular-nums">
            {t.expectedCompletionDate ? formatDate(t.expectedCompletionDate) : "—"}
          </div>
          <div className="mt-1">
            <Pill tone={overdue ? "danger" : pct >= 100 ? "success" : "info"}>
              {pct >= 100 ? "Completed" : overdue ? "Overdue" : "On track"}
            </Pill>
          </div>
        </div>
        <div className="card-soft p-2.5">
          <div className="text-[10px] text-muted-foreground">Pending activities</div>
          <div className="mt-0.5 text-lg font-semibold tabular-nums">{pending}</div>
          <div className="mt-1">
            <Pill tone={priorityMeta.tone}>{priorityMeta.label} priority</Pill>
          </div>
        </div>
      </div>

      <DesignTicketSection
        compact
        title="Implementation stage"
        action={
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {stagePct}% through pipeline
          </span>
        }
      >
        <p className="mb-2 text-[10px] text-muted-foreground">
          Tap a stage to set the current position. Everything up to it is treated as done.
        </p>
        <ol className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {TRACKER_STAGE_KEYS.map((key, idx) => {
            const state = idx < currentIndex ? "done" : idx === currentIndex ? "current" : "upcoming";
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => updateTracker(companyId, { stage: key }, who)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors",
                    state === "current" && "border-primary bg-primary/10 font-medium",
                    state === "done" && "border-success/40 bg-success/5",
                    state === "upcoming" && "border-input bg-background hover:border-primary",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold tabular-nums",
                      state === "current" && "border-primary bg-primary text-white",
                      state === "done" && "border-success bg-success text-white",
                      state === "upcoming" && "border-muted-foreground/40 text-muted-foreground",
                    )}
                  >
                    {state === "done" ? <Check className="h-3 w-3" /> : idx + 1}
                  </span>
                  <span className="min-w-0 truncate">{CRM_STAGE_LABELS[key]}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </DesignTicketSection>

      <DesignTicketSection compact title="Tracker details">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-[10px] text-muted-foreground">
            Assigned executive
            <select
              className={cn(selectClass, "mt-1")}
              value={crmAssigneeSelectValue(t.assignedExecutiveId, salesManager.userId)}
              onChange={(e) =>
                updateTracker(
                  companyId,
                  {
                    assignedExecutiveId: crmAssigneeSelectPatch(
                      e.target.value,
                      salesManager.userId,
                    ),
                  },
                  who,
                )
              }
            >
              <option value="">Unassigned</option>
              {assignees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] text-muted-foreground">
            Expected completion
            <DatePickerField
              compact
              className="mt-1"
              value={t.expectedCompletionDate ?? ""}
              onChange={(v) => updateTracker(companyId, { expectedCompletionDate: v }, who)}
            />
          </label>
          <div className="text-[10px] text-muted-foreground sm:col-span-2">
            Priority
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(["low", "medium", "high", "critical"] as const).map((p) => {
                const active = t.priority === p;
                const meta = TRACKER_PRIORITY_META[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => updateTracker(companyId, { priority: p }, who)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
                      active
                        ? "border-primary bg-primary text-white"
                        : "border-input bg-background text-muted-foreground hover:border-primary",
                    )}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="text-[10px] text-muted-foreground sm:col-span-2">
            Delay reason
            <input
              className={cn(fieldClass, "mt-1")}
              value={t.delayReason ?? ""}
              onChange={(e) => updateTracker(companyId, { delayReason: e.target.value }, who)}
              placeholder="Optional — note any blocker or delay"
            />
          </label>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          {crmAssigneeSelectValue(t.assignedExecutiveId, salesManager.userId) ? (
            <span>
              Assigned:{" "}
              {resolveAssigneeLabel(
                crmAssigneeSelectValue(t.assignedExecutiveId, salesManager.userId),
                users,
                employees,
              )}
            </span>
          ) : null}
          {t.lastUpdatedBy ? <span>Last updated by {t.lastUpdatedBy}</span> : null}
        </div>
      </DesignTicketSection>
    </div>
  );
}

function TicketsTab({ companyId }: { companyId: string }) {
  const tickets = useTicketStore((s) => s.tickets);
  const addTicket = useTicketStore((s) => s.addTicket);
  const updateTicket = useTicketStore((s) => s.updateTicket);
  const currentUser = useAuthStore((s) => s.user);
  const companyTickets = useMemo(
    () => tickets.filter((t) => t.companyId === companyId),
    [tickets, companyId],
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("Medium");
  const [type, setType] = useState<TicketType>("Customization");

  const statuses: TicketStatus[] = [
    "Open",
    "In Progress",
    "Pending",
    "Resolved",
    "Closed",
  ];

  return (
    <div className="space-y-2.5">
      <CrmAccountPortalPanel accountId={companyId} />

      <DesignTicketSection compact title="Create internal ticket">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-[10px] text-muted-foreground sm:col-span-2">
            Title
            <input
              className={cn(fieldClass, "mt-1")}
              placeholder="Short summary of the issue…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="text-[10px] text-muted-foreground sm:col-span-2">
            Description
            <textarea
              className={cn(areaClass, "mt-1")}
              placeholder="Details, steps, expected outcome…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="text-[10px] text-muted-foreground">
            Type
            <select
              className={cn(selectClass, "mt-1")}
              value={type}
              onChange={(e) => setType(e.target.value as TicketType)}
            >
              {(
                [
                  "Bug",
                  "Feature Request",
                  "Customization",
                  "Enhancement",
                  "Requirement",
                  "Other",
                ] as const
              ).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] text-muted-foreground">
            Priority
            <select
              className={cn(selectClass, "mt-1")}
              value={priority}
              onChange={(e) => setPriority(e.target.value as TicketPriority)}
            >
              {(["Critical", "High", "Medium", "Low"] as const).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Button
          size="sm"
          className="mt-2 h-8 gap-1 bg-primary text-xs"
          onClick={() => {
            if (!title.trim()) {
              toast.error("Enter a title");
              return;
            }
            const today = nowIso().slice(0, 10);
            addTicket({
              companyId,
              projectId: "crm",
              title: `[CRM] ${title.trim()}`,
              description: description.trim() || "CRM implementation ticket",
              type,
              priority,
              status: "Open",
              raisedOn: today,
              eta: today,
              developerId: currentUser?.id ?? "",
              assignedUserId: currentUser?.id,
            });
            setTitle("");
            setDescription("");
            setPriority("Medium");
            setType("Customization");
            toast.success("Ticket created");
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Create ticket
        </Button>
      </DesignTicketSection>

      <DesignTicketSection
        compact
        title="Internal CRM tickets"
        action={
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {companyTickets.length} total ·{" "}
            <Link to="/crm/support" className="text-primary hover:underline">
              Support Desk
            </Link>
          </span>
        }
      >
        <div className="space-y-1.5">
          {companyTickets.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No tickets for this account yet.
            </p>
          ) : (
            companyTickets.slice(0, 40).map((t) => (
              <div key={t.id} className="card-soft space-y-2 p-2.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <Link
                    to="/crm/support/$ticketId"
                    params={{ ticketId: t.id }}
                    className="min-w-0 hover:opacity-90"
                  >
                    <div className="text-xs font-medium text-primary">{t.title}</div>
                    <div className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                      {t.description}
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {t.id.slice(0, 8)} · Raised {formatDate(t.raisedOn)} · {t.type}
                    </div>
                  </Link>
                  <div className="flex flex-wrap gap-1">
                    <Pill tone="accent">{t.priority}</Pill>
                    <Pill tone={isTicketOpen(t) ? "warning" : "success"}>{t.status}</Pill>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className={cn(selectClass, "w-auto min-w-[8rem]")}
                    value={t.status}
                    onChange={(e) => {
                      updateTicket(t.id, { status: e.target.value as TicketStatus });
                      toast.success("Ticket status updated");
                    }}
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <select
                    className={cn(selectClass, "w-auto min-w-[7rem]")}
                    value={t.priority}
                    onChange={(e) => {
                      updateTicket(t.id, { priority: e.target.value as TicketPriority });
                      toast.success("Priority updated");
                    }}
                  >
                    {(["Critical", "High", "Medium", "Low"] as const).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))
          )}
        </div>
      </DesignTicketSection>
    </div>
  );
}

function CommsTab({ companyId }: { companyId: string }) {
  const record = useCrmOnboardingStore((s) => s.getByCompanyId(companyId))!;
  const logComm = useCrmOnboardingStore((s) => s.logComm);
  const [channel, setChannel] = useState<CrmCommChannel>("email");
  const [note, setNote] = useState("");

  return (
    <div className="space-y-2.5">
      <DesignTicketSection compact title="Communication center">
        <p className="mb-2 text-[10px] text-muted-foreground">
          Log outreach by channel. Messages are recorded on this account for the implementation team.
        </p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {(["whatsapp", "sms", "email", "push"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChannel(c)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs capitalize transition-colors",
                channel === c
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <label className="mb-2 block text-[10px] text-muted-foreground">
          Optional note
          <textarea
            className={cn(areaClass, "mt-1")}
            placeholder="Context for this outreach…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {CRM_COMM_ACTIONS.map((a) => (
            <Button
              key={a.key}
              variant="outline"
              size="sm"
              className="h-8 justify-start gap-1.5 text-xs"
              onClick={() => {
                const summary = note.trim()
                  ? `${a.label} via ${channel}: ${note.trim()}`
                  : `${a.label} via ${channel}`;
                logComm(companyId, a.key, channel, summary, "logged");
                setNote("");
                toast.success(`${a.label} logged on ${channel}`);
              }}
            >
              <Send className="h-3 w-3" />
              {a.label}
            </Button>
          ))}
        </div>
      </DesignTicketSection>

      <DesignTicketSection
        compact
        title="Recent communications"
        action={
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {record.commLog.length} logged
          </span>
        }
      >
        <div className="space-y-1.5">
          {record.commLog.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No messages yet.</p>
          ) : (
            record.commLog.slice(0, 30).map((c) => (
              <div key={c.id} className="card-soft flex justify-between gap-2 p-2.5 text-xs">
                <div className="min-w-0">
                  <div className="font-medium">{c.summary}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatDate(c.createdAt)} · {c.channel} · {c.action.replace(/_/g, " ")}
                  </div>
                </div>
                <Pill tone={c.status === "failed" ? "danger" : "success"}>{c.status}</Pill>
              </div>
            ))
          )}
        </div>
      </DesignTicketSection>
    </div>
  );
}

