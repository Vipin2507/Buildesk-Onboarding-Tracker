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
import { resolveCrmMigrationCatalog } from "@/lib/crm-migration-catalog";
import { isTicketOpen } from "@/lib/tickets";
import {
  useAuthStore,
  useCrmAccountStore,
  useCrmOnboardingStore,
  useTicketStore,
} from "@/stores";
import type { CrmAccount } from "@/types/crm-account";
import type { CrmImplementationStage, CrmOnboardingRecord } from "@/types/crm-onboarding";

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
  | { type: "modules"; key: string };

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
  );
}

export function useCrmDashboardOverview() {
  const allAccounts = useCrmAccountStore((s) => s.accounts);
  const currentUser = useAuthStore((s) => s.user);
  const records = useCrmOnboardingStore((s) => s.records);
  const tickets = useTicketStore((s) => s.tickets);

  return useMemo(() => {
    // Admins see all; managers only accounts where they are the sales manager.
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
          account.status !== "closed" && (account.status as string) !== "churned",
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
      (r) => r.status === "closed" || (r.status as string) === "churned",
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
      return s + record.reportChecklist.filter((x) => x.status !== "explained").length;
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

    const recentActivity = buildRecentActivity(accounts, records);

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
              return record.reportChecklist.some((x) => x.status !== "explained");
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
      },
      health,
      moduleAdoption,
      stageMix,
      recentActivity,
      resolveDrillDown,
    };
  }, [allAccounts, currentUser, records, tickets]);
}

function buildRecentActivity(accounts: CrmAccount[], records: CrmOnboardingRecord[]) {
  const nameById = new Map(accounts.map((a) => [a.id, a.name]));
  const events: { id: string; what: string; who: string; createdAt: string; kind: string }[] = [];

  for (const account of accounts) {
    const record = recordFor(account, records);
    for (const c of record.commLog.slice(0, 3)) {
      events.push({
        id: c.id,
        what: c.summary,
        who: nameById.get(account.id) ?? "Account",
        createdAt: c.createdAt,
        kind: c.status === "failed" ? "danger" : "info",
      });
    }
    if (account.status === "live") {
      events.push({
        id: `live-${account.id}`,
        what: `${account.name} marked live`,
        who: account.accountManagerName || "System",
        createdAt: account.updatedAt,
        kind: "success",
      });
    }
  }

  return events
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);
}

export function crmDrillDownFilterKey(filter: CrmDashboardDrillDownFilter | null | undefined) {
  return filter ? JSON.stringify(filter) : "";
}
