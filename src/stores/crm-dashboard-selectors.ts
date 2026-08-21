import { useMemo } from "react";

import {
  calcCrmOnboardingProgress,
  createCrmOnboardingRecord,
  CRM_PRODUCT_MODULES,
  CRM_STAGE_LABELS,
  ensureMasterDataFields,
} from "@/data/crm-onboarding-defaults";
import {
  getChecklistPhaseBucket,
  summarizeChecklistPhases,
  type ChecklistPhaseBucket,
} from "@/lib/checklist";
import { filterCrmAccountsForUser } from "@/lib/crm-account-access";
import { isCrmAccountEnded } from "@/lib/crm-account-status";
import { resolveCrmMigrationCatalog } from "@/lib/crm-migration-catalog";
import { resolveCrmTrainingCatalogForCompany } from "@/lib/crm-training-catalog";
import { isDesignTicketActive } from "@/stores/design-ticket-selectors";
import { isTicketOpen } from "@/lib/tickets";
import {
  useAuthStore,
  useBookingStore,
  useCrmAccountStore,
  useCrmEventStore,
  useCrmOnboardingStore,
  useDesignTicketStore,
  useTicketStore,
} from "@/stores";
import type { CrmAccount } from "@/types/crm-account";
import type { CrmImplementationStage, CrmOnboardingRecord } from "@/types/crm-onboarding";
import type { CrmDashboardActivityItem } from "@/components/crm/crm-dashboard-activity-feed";
import {
  buildCrmActivityFeed,
  type CrmActivityItem,
} from "@/lib/crm-activity-feed";

function toDashboardActivityItem(item: CrmActivityItem): CrmDashboardActivityItem {
  return {
    id: item.id,
    what: item.accountName ? `${item.accountName} · ${item.what}` : item.what,
    who: item.who,
    createdAt: item.createdAt,
    kind: item.kind,
    href: item.href,
    category: item.category,
    accountId: item.accountId,
    accountName: item.accountName,
  };
}

export type { CrmActivityItem } from "@/lib/crm-activity-feed";

export type CrmAccountStatusFilter = "all" | CrmAccount["status"];

export type CrmHealthBucket = "Healthy" | "Moderate" | "Critical";

export type CrmDashboardDrillDownFilter =
  | { type: "accounts"; status: CrmAccountStatusFilter }
  | { type: "masters"; phase: ChecklistPhaseBucket }
  | { type: "migrations" }
  | { type: "training" }
  | { type: "reports" }
  | { type: "tickets" }
  | { type: "overdue" }
  | { type: "priority"; level: "high" | "critical" }
  | { type: "health"; bucket: CrmHealthBucket }
  | { type: "stage"; stage: CrmImplementationStage }
  | { type: "modules"; key: string }
  | { type: "bookings"; scope: "pending" | "upcoming" }
  | { type: "support" }
  | { type: "progress"; bucket: "low" | "mid" | "high" };

export type CrmAccountRow = CrmAccount & {
  progress: number;
  stage: CrmImplementationStage;
  stageLabel: string;
  healthBucket: CrmHealthBucket;
  resolvedHealth: number;
  openTickets: number;
  pendingMasters: number;
  pendingMigrations: number;
  pendingTraining: number;
  /** Providers configured across opted integration modules. */
  providers: string[];
  overdue: boolean;
};

function healthBucketOf(score: number): CrmHealthBucket {
  if (score >= 75) return "Healthy";
  if (score >= 50) return "Moderate";
  return "Critical";
}

function resolveHealth(account: CrmAccount, progress: number, isLive: boolean, openTickets: number) {
  return (
    account.healthScore ??
    Math.min(100, Math.round(progress * 0.7 + (isLive ? 20 : 0) + Math.max(0, 10 - openTickets * 2)))
  );
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function recordFor(account: CrmAccount, records: CrmOnboardingRecord[]): CrmOnboardingRecord {
  const found = records.find((r) => r.companyId === account.id);
  if (found) {
    return { ...found, ...ensureMasterDataFields(found) };
  }
  return createCrmOnboardingRecord(
    account.id,
    account.companyType,
    resolveCrmMigrationCatalog(),
    resolveCrmTrainingCatalogForCompany(account.companyType),
  );
}

export function useCrmDashboardOverview() {
  const allAccounts = useCrmAccountStore((s) => s.accounts);
  const currentUser = useAuthStore((s) => s.user);
  const records = useCrmOnboardingStore((s) => s.records);
  const tickets = useTicketStore((s) => s.tickets);
  const crmEvents = useCrmEventStore((s) => s.events);
  const subscriptionEvents = useCrmEventStore((s) => s.subscriptionEvents);
  const designTickets = useDesignTicketStore((s) => s.tickets);
  const bookingAppointments = useBookingStore((s) => s.appointments);

  return useMemo(() => {
    // Admins see all; others only accounts where they are sales or support manager.
    const accounts = filterCrmAccountsForUser(allAccounts, currentUser);
    const accountIds = new Set(accounts.map((a) => a.id));
    const today = todayYmd();

    const rows: CrmAccountRow[] = accounts.map((account) => {
      const record = recordFor(account, records);
      const progress = calcCrmOnboardingProgress(record);
      const openTickets = tickets.filter(
        (t) => t.companyId === account.id && isTicketOpen(t),
      ).length;
      const isLive = account.status === "live";
      const resolvedHealth = resolveHealth(account, progress, isLive, openTickets);
      const overdue = Boolean(
        record.tracker.expectedCompletionDate &&
          record.tracker.expectedCompletionDate < today &&
          account.status !== "live" &&
          !isCrmAccountEnded(account.status),
      );

      return {
        ...account,
        progress,
        stage: record.tracker.stage,
        stageLabel: CRM_STAGE_LABELS[record.tracker.stage] ?? record.tracker.stage,
        healthBucket: healthBucketOf(resolvedHealth),
        resolvedHealth,
        openTickets,
        pendingMasters: record.masterChecklist.filter(
          (m) => !m.notApplicable && !(m.collected && m.uploaded && m.live),
        ).length,
        pendingMigrations: record.migrationChecklist.filter(
          (m) => !m.notApplicable && !(m.collected && m.uploaded && m.live),
        ).length,
        pendingTraining: record.trainingSessions.filter(
          (s) => !s.notApplicable && !s.completed && !(s.sessionCount > 0),
        ).length,
        providers: Array.from(
          new Set(
            record.productModules
              .filter((m) => m.enabled && m.provider)
              .map((m) => m.provider as string),
          ),
        ),
        overdue,
      };
    });

    const allMasters = accounts.flatMap((account) => recordFor(account, records).masterChecklist);
    const phaseStats = summarizeChecklistPhases(allMasters);

    const live = rows.filter((r) => r.status === "live").length;
    const onboarding = rows.filter((r) => r.status === "onboarding").length;
    const active = rows.filter((r) => r.status === "active").length;
    const closed = rows.filter(
      (r) => r.status === "closed" || r.status === "suspended" || r.status === "inactive" || (r.status as string) === "churned",
    ).length;
    const avgCompletion =
      rows.length === 0 ? 0 : Math.round(rows.reduce((s, r) => s + r.progress, 0) / rows.length);

    const openTickets = tickets.filter(
      (t) => accountIds.has(t.companyId) && isTicketOpen(t),
    ).length;

    const pendingMigrations = rows.reduce((s, r) => s + r.pendingMigrations, 0);
    const pendingTraining = rows.reduce((s, r) => s + r.pendingTraining, 0);
    const pendingReports = rows.reduce((s, r) => {
      const record = recordFor(r, records);
      return s + record.reportChecklist.filter((x) => !x.notApplicable && x.status !== "explained").length;
    }, 0);
    const overdueCount = rows.filter((r) => r.overdue).length;
    const highPriority = rows.filter((row) => {
      const record = recordFor(row, records);
      return record.tracker.priority === "high" || record.tracker.priority === "critical";
    }).length;

    const health = {
      Healthy: rows.filter((r) => r.healthBucket === "Healthy").length,
      Moderate: rows.filter((r) => r.healthBucket === "Moderate").length,
      Critical: rows.filter((r) => r.healthBucket === "Critical").length,
    };

    const moduleAdoption = CRM_PRODUCT_MODULES.map((mod) => {
      let opted = 0;
      for (const account of accounts) {
        const record = recordFor(account, records);
        if (record.productModules.find((m) => m.key === mod.key)?.enabled) opted += 1;
      }
      return {
        key: mod.key,
        name: mod.label.replace(/ Integration$/i, "").replace(/ Application$/i, ""),
        fullName: mod.label,
        opted,
      };
    })
      .filter((m) => m.opted > 0)
      .sort((a, b) => b.opted - a.opted)
      .slice(0, 8);

    const stageMix = Object.keys(CRM_STAGE_LABELS).map((stage) => ({
      stage: stage as CrmImplementationStage,
      label: CRM_STAGE_LABELS[stage]!,
      value: rows.filter((r) => r.stage === stage).length,
    }));

    const recentActivity = buildCrmActivityFeed({
      accounts,
      records,
      accountIds,
      crmEvents,
      subscriptionEvents,
      designTickets,
      bookingAppointments,
      tickets,
    })
      .slice(0, 10)
      .map(toDashboardActivityItem);

    const allActivity = buildCrmActivityFeed({
      accounts,
      records,
      accountIds,
      crmEvents,
      subscriptionEvents,
      designTickets,
      bookingAppointments,
      tickets,
    });

    const nowIso = new Date().toISOString().slice(0, 19);
    const pendingBookings = bookingAppointments.filter(
      (b) => accountIds.has(b.companyId) && b.status === "pending",
    ).length;
    const upcomingBookings = bookingAppointments.filter(
      (b) =>
        accountIds.has(b.companyId) &&
        (b.status === "confirmed" || b.status === "postponed") &&
        b.startsAt >= nowIso,
    ).length;
    const openSupportTickets = designTickets.filter(
      (t) => accountIds.has(t.companyId) && isDesignTicketActive(t.status),
    ).length;

    function resolveDrillDown(filter: CrmDashboardDrillDownFilter) {
      switch (filter.type) {
        case "accounts":
          return {
            kind: "accounts" as const,
            title: filter.status === "all" ? "All accounts" : `${filter.status} accounts`,
            accounts:
              filter.status === "all" ? rows : rows.filter((r) => r.status === filter.status),
          };
        case "masters":
          return {
            kind: "masters" as const,
            title: `Masters · ${filter.phase.replace(/_/g, " ")}`,
            accounts: rows.filter((row) => {
              const record = recordFor(row, records);
              return record.masterChecklist.some(
                (m) => getChecklistPhaseBucket(m) === filter.phase,
              );
            }),
            phase: filter.phase,
          };
        case "migrations":
          return {
            kind: "accounts" as const,
            title: "Pending migrations",
            accounts: rows.filter((r) => r.pendingMigrations > 0),
          };
        case "training":
          return {
            kind: "accounts" as const,
            title: "Pending training",
            accounts: rows.filter((r) => r.pendingTraining > 0),
          };
        case "reports":
          return {
            kind: "accounts" as const,
            title: "Reports pending explanation",
            accounts: rows.filter((row) => {
              const record = recordFor(row, records);
              return record.reportChecklist.some((x) => !x.notApplicable && x.status !== "explained");
            }),
          };
        case "tickets":
          return {
            kind: "accounts" as const,
            title: "Accounts with open tickets",
            accounts: rows.filter((r) => r.openTickets > 0),
          };
        case "overdue":
          return {
            kind: "accounts" as const,
            title: "Overdue implementations",
            accounts: rows.filter((r) => r.overdue),
          };
        case "priority":
          return {
            kind: "accounts" as const,
            title: `${filter.level} priority accounts`,
            accounts: rows.filter((row) => {
              const record = recordFor(row, records);
              return (
                record.tracker.priority === filter.level ||
                (filter.level === "high" && record.tracker.priority === "critical")
              );
            }),
          };
        case "health":
          return {
            kind: "accounts" as const,
            title: `${filter.bucket} accounts`,
            accounts: rows.filter((r) => r.healthBucket === filter.bucket),
          };
        case "stage":
          return {
            kind: "accounts" as const,
            title: CRM_STAGE_LABELS[filter.stage] ?? filter.stage,
            accounts: rows.filter((r) => r.stage === filter.stage),
          };
        case "modules":
          return {
            kind: "accounts" as const,
            title: `Module · ${CRM_PRODUCT_MODULES.find((m) => m.key === filter.key)?.label ?? filter.key}`,
            accounts: rows.filter((row) => {
              const record = recordFor(row, records);
              return record.productModules.some((m) => m.key === filter.key && m.enabled);
            }),
          };
        case "bookings":
          return {
            kind: "accounts" as const,
            title:
              filter.scope === "pending" ? "Accounts with pending bookings" : "Upcoming booked calls",
            accounts: rows.filter((row) => {
              const mine = bookingAppointments.filter((b) => b.companyId === row.id);
              if (filter.scope === "pending") return mine.some((b) => b.status === "pending");
              return mine.some(
                (b) =>
                  (b.status === "confirmed" || b.status === "postponed") && b.startsAt >= nowIso,
              );
            }),
          };
        case "support":
          return {
            kind: "accounts" as const,
            title: "Accounts with open portal tickets",
            accounts: rows.filter((row) =>
              designTickets.some(
                (t) => t.companyId === row.id && isDesignTicketActive(t.status),
              ),
            ),
          };
        case "progress":
          return {
            kind: "accounts" as const,
            title:
              filter.bucket === "low"
                ? "Low completion (<40%)"
                : filter.bucket === "mid"
                  ? "Mid completion (40–74%)"
                  : "High completion (75%+)",
            accounts: rows.filter((r) => {
              if (filter.bucket === "low") return r.progress < 40;
              if (filter.bucket === "mid") return r.progress >= 40 && r.progress < 75;
              return r.progress >= 75;
            }),
          };
      }
    }

    return {
      rows,
      phaseStats,
      kpis: {
        totalAccounts: rows.length,
        onboarding,
        live,
        active,
        closed,
        avgCompletion,
        pendingBookings,
        upcomingBookings,
        openSupportTickets,
      },
      pending: {
        overdue: overdueCount,
        mastersCollect: phaseStats.awaitingCollection,
        mastersUpload: phaseStats.awaitingUpload,
        mastersLive: phaseStats.awaitingLive,
        migrations: pendingMigrations,
        training: pendingTraining,
        reports: pendingReports,
        tickets: openTickets,
        highPriority,
        bookings: pendingBookings,
        support: openSupportTickets,
      },
      health,
      moduleAdoption,
      stageMix,
      recentActivity,
      allActivity,
      resolveDrillDown,
    };
  }, [
    allAccounts,
    bookingAppointments,
    crmEvents,
    currentUser,
    designTickets,
    records,
    subscriptionEvents,
    tickets,
  ]);
}

export type { CrmDashboardActivityItem };

export function crmDrillDownFilterKey(filter: CrmDashboardDrillDownFilter | null | undefined) {
  return filter ? JSON.stringify(filter) : "";
}
