import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CheckSquare,
  ClipboardList,
  HelpCircle,
  LayoutDashboard,
  MessageSquare,
  Package,
  Pencil,
  Plus,
  Rocket,
  Send,
  Ticket,
  TrendingUp,
  Calendar,
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
import { CrmAccountQueriesPanel } from "@/components/crm/crm-account-queries-panel";
import { CrmAccountMeetingsPanel } from "@/components/crm/crm-account-meetings-panel";
import { CrmAccountModulesOverview } from "@/components/crm/crm-account-modules-overview";
import { CrmAccountModulesTab } from "@/components/crm/crm-account-modules-tab";
import { CrmAccountPortalPanel } from "@/components/crm/crm-account-portal-panel";
import { CrmAccountTasksPanel } from "@/components/crm/crm-account-tasks-panel";
import { CrmGoLiveChecklist } from "@/components/crm/crm-go-live-checklist";
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
import {
  CRM_COMM_ACTIONS,
  CRM_STAGE_LABELS,
  calcCrmOnboardingProgress,
  createCrmOnboardingRecord,
  crmPendingActivityCount,
  isCrmIntegrationModule,
} from "@/data/crm-onboarding-defaults";
import { calcChecklistProgress } from "@/lib/checklist";
import { resolveCrmMigrationCatalog } from "@/lib/crm-migration-catalog";
import { resolveCrmTrainingCatalogForCompany } from "@/lib/crm-training-catalog";
import { cn, formatDate } from "@/lib/utils";
import { isTicketOpen } from "@/lib/tickets";
import {
  useAuthStore,
  useBookingStore,
  useCrmAccountQueryStore,
  useCrmAccountStore,
  useCrmOnboardingStore,
  useCrmTaskStore,
  useDesignTicketStats,
  useTicketStore,
} from "@/stores";

import type {
  CrmCommChannel,
} from "@/types/crm-onboarding";
import type { CrmAccount } from "@/types/crm-account";
import { nowIso } from "@/types/common";
import type { TicketPriority, TicketStatus, TicketType } from "@/types/ticket";
import type { FollowUpTaskStatus } from "@/types";

const OPEN_TASK_STATUSES: FollowUpTaskStatus[] = ["open", "in_progress", "blocked"];

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "modules", label: "Modules", icon: Package },
  { id: "golive", label: "Go-Live", icon: Rocket },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "meetings", label: "Meetings", icon: Calendar },
  { id: "tickets", label: "Tickets", icon: Ticket },
  { id: "queries", label: "Queries", icon: HelpCircle },
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
  tab: controlledTab,
  onTabChange,
  initialQueryId,
}: {
  accountId: string;
  accountName: string;
  progress?: number;
  tab?: TabId;
  onTabChange?: (tab: TabId) => void;
  initialQueryId?: string;
}) {
  const account = useCrmAccountStore((s) => s.accounts.find((a) => a.id === accountId));
  const markLive = useCrmAccountStore((s) => s.markLive);
  const completeAllGoLiveItems = useCrmOnboardingStore((s) => s.completeAllGoLiveItems);
  const updateTracker = useCrmOnboardingStore((s) => s.updateTracker);
  const ensureForCompany = useCrmOnboardingStore((s) => s.ensureForCompany);
  const record = useCrmOnboardingStore((s) => s.getByCompanyId(accountId));
  const tickets = useTicketStore((s) => s.tickets);
  const tasks = useCrmTaskStore((s) => s.tasks);
  const designTicketStats = useDesignTicketStats(accountId);
  const pendingMeetings = useBookingStore(
    (s) => s.appointments.filter((a) => a.companyId === accountId && a.status === "pending").length,
  );
  const refreshAccountQueries = useCrmAccountQueryStore((s) => s.refreshCompanyQueries);
  const openQueries = useCrmAccountQueryStore((s) => s.openCountForCompany(accountId));
  const currentUser = useAuthStore((s) => s.user);

  const [internalTab, setInternalTab] = useState<TabId>("dashboard");
  const [confirmForceLive, setConfirmForceLive] = useState(false);
  const tab = controlledTab ?? internalTab;
  const setTab = (next: TabId) => {
    if (onTabChange) onTabChange(next);
    else setInternalTab(next);
  };

  useEffect(() => {
    ensureForCompany(accountId, account?.companyType);
  }, [accountId, account?.companyType, ensureForCompany]);

  useEffect(() => {
    void refreshAccountQueries(accountId).catch(() => {});
  }, [accountId, refreshAccountQueries]);

  const liveRecord = useMemo(() => {
    if (record) return record;
    return createCrmOnboardingRecord(
      accountId,
      account?.companyType,
      resolveCrmMigrationCatalog(),
      resolveCrmTrainingCatalogForCompany(account?.companyType),
    );
  }, [account?.companyType, accountId, record]);
  const pct = calcCrmOnboardingProgress(liveRecord);
  const pending = crmPendingActivityCount(liveRecord);
  const visibleTabs = TABS;

  const openTickets = tickets.filter((t) => t.companyId === accountId && isTicketOpen(t)).length;
  const openTasks = tasks.filter(
    (t) => t.companyId === accountId && OPEN_TASK_STATUSES.includes(t.status),
  ).length;
  const pendingPortalTickets = designTicketStats.open + designTicketStats.inProgress;
  const pendingTicketsTab = pendingPortalTickets + openTickets;

  const visibleTabsWithBadges = useMemo(
    () =>
      visibleTabs.map((t) => {
        let badge: number | undefined;
        if (t.id === "tasks") badge = openTasks;
        else if (t.id === "meetings") badge = pendingMeetings;
        else if (t.id === "tickets") badge = pendingTicketsTab;
        else if (t.id === "queries") badge = openQueries;
        return { ...t, badge };
      }),
    [visibleTabs, openTasks, pendingMeetings, pendingTicketsTab, openQueries],
  );

  const isLive = account?.status === "live";

  const kpis = [
    { id: "progress", label: "Completion", value: pct, icon: TrendingUp, tone: "text-primary" },
    { id: "pending", label: "Pending", value: pending, icon: ClipboardList, tone: "text-warning-foreground" },
    { id: "tasks", label: "Open tasks", value: openTasks, icon: CheckSquare, tone: "text-primary" },
    { id: "tickets", label: "Open tickets", value: openTickets, icon: Ticket },
    {
      id: "modules",
      label: "Modules",
      value: liveRecord.productModules.filter((m) => m.enabled && !isCrmIntegrationModule(m.key)).length,
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
              else if (k.id === "tasks") setTab("tasks");
              else if (k.id === "modules") setTab("modules");
              else if (k.id === "pending") setTab("modules");
              else setTab("dashboard");
            },
            active:
              (k.id === "tickets" && tab === "tickets") ||
              (k.id === "tasks" && tab === "tasks") ||
              (k.id === "modules" && tab === "modules") ||
              (k.id === "pending" && tab === "modules") ||
              (k.id === "progress" && tab === "dashboard"),
          }))}
          columns={5}
          size="compact"
        />
      </div>

      <DesignTicketTabNav
        compact
        tabs={visibleTabsWithBadges.map(({ id, label, icon, badge }) => ({ id, label, icon, badge }))}
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
              onOpenTasks={() => setTab("tasks")}
              onOpenModules={() => setTab("modules")}
            />
          ) : null}
          {tab === "modules" ? <CrmAccountModulesTab companyId={accountId} /> : null}
          {tab === "golive" ? (
            <GoLiveTab
              companyId={accountId}
              accountName={accountName}
              accountStatus={account.status}
              who={currentUser?.name}
            />
          ) : null}
          {tab === "tasks" ? <CrmAccountTasksPanel accountId={accountId} /> : null}
          {tab === "meetings" ? <MeetingsTab companyId={accountId} /> : null}
          {tab === "tickets" ? <TicketsTab companyId={accountId} /> : null}
          {tab === "queries" ? (
            <QueriesTab companyId={accountId} initialQueryId={initialQueryId} />
          ) : null}
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
          updateTracker(
            accountId,
            { stage: "customer_success", priority: "medium" },
            currentUser?.name,
          );
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
  onOpenTasks,
  onOpenModules,
}: {
  accountId: string;
  accountName: string;
  pct: number;
  pending: number;
  openTickets: number;
  isLive: boolean;
  onOpenTasks: () => void;
  onOpenModules: () => void;
}) {
  const account = useCrmAccountStore((s) => s.accounts.find((a) => a.id === accountId))!;
  const updateAccount = useCrmAccountStore((s) => s.updateAccount);
  const ensure = useCrmOnboardingStore((s) => s.ensureForCompany);
  const setModuleEnabled = useCrmOnboardingStore((s) => s.setProductModuleEnabled);
  const record = useCrmOnboardingStore((s) => s.getByCompanyId(accountId))!;
  const [editing, setEditing] = useState(false);

  const form = useForm<CrmAccountFormValues>({
    resolver: zodResolver(crmAccountSchema),
    defaultValues: crmAccountToFormValues(account),
  });

  useEffect(() => {
    if (editing) form.reset(crmAccountToFormValues(account));
  }, [editing, account, form]);
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
          <div className="mt-0.5 text-xs text-muted-foreground">
            Support Manager 1: {account.supportManager1 || "—"}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Support Manager 2: {account.supportManager2 || "—"}
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

      <DesignTicketSection
        compact
        title="Modules"
        action={
          <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={onOpenModules}>
            Manage modules
          </Button>
        }
      >
        <CrmAccountModulesOverview
          companyId={accountId}
          modules={record.productModules}
          record={record}
          emptyModulesHint="No modules selected — open the Modules tab to subscribe."
          onModuleOptOut={(key, label) => {
            setModuleEnabled(accountId, key, false);
            toast.success(`${label} opted out`);
          }}
        />
      </DesignTicketSection>

      <CrmAccountTasksPanel accountId={accountId} compact onViewAll={onOpenTasks} />

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

function GoLiveTab({
  companyId,
  accountName,
  accountStatus,
  who,
}: {
  companyId: string;
  accountName: string;
  accountStatus: CrmAccount["status"];
  who?: string;
}) {
  return (
    <CrmGoLiveChecklist
      companyId={companyId}
      accountName={accountName}
      accountStatus={accountStatus}
      who={who}
    />
  );
}

function MeetingsTab({ companyId }: { companyId: string }) {
  return <CrmAccountMeetingsPanel accountId={companyId} />;
}

function QueriesTab({
  companyId,
  initialQueryId,
}: {
  companyId: string;
  initialQueryId?: string;
}) {
  return <CrmAccountQueriesPanel accountId={companyId} initialQueryId={initialQueryId} />;
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
  const currentUser = useAuthStore((s) => s.user);
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
                logComm(companyId, a.key, channel, summary, "logged", currentUser?.name);
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

