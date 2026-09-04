import { useEffect, useState, type ReactNode } from "react";

import { AppLoadingScreen } from "@/components/app-loading-screen";

import {
  getIntegrationsBundle,
  getLaborBundle,
  getVendorBundle,
  listActivity,
  listAllAttachments,
  listAllChecklist,
  listAllNotes,
  listAllOtherCharges,
  listAllProgress,
  listAllUploads,
  listAllCustomerAppConfigs,
  listCompanies,
  listDocuments,
  listEmployees,
  listProjects,
  listPostSalesProjects,
  listTickets,
  listTicketActivities,
  listTraining,
  listUsers,
  listNotifications,
  getAppConfig,
  setAppConfig,
  listFollowUpTasks,
  listErpFollowUpTasks,
  listClientVisits,
  listModuleSubscriptions,
  listModuleSubscriptionEvents,
  listCrmEvents,
  ensureCompanyPortals,
  listCrmAccounts,
  listCrmOnboardingRecords,
  upsertCrmOnboardingRecord,
  listDesignTickets,
  listChatSessions,
  listBookingAppointments,
  listBookingEventTypes,
  listBookingAvailability,
  listBookingBlocks,
} from "@/lib/api";
import { wireConfigPersistence } from "@/lib/config-persistence";
import { mapTicket, mapTicketActivity } from "@/lib/tickets";
import {
  useActivityStore,
  useAuthStore,
  useCompanyStore,
  useDocumentStore,
  useEmployeeStore,
  useIntegrationStore,
  useLaborStore,
  useNotesAttachmentsStore,
  useNotificationStore,
  useOnboardingStore,
  usePostSalesStore,
  useProjectProgressStore,
  useProjectStore,
  useTicketStore,
  useTrainingStore,
  useUserStore,
  useVendorStore,
  useMasterStore,
  useSettingsStore,
  useCrmTaskStore,
  useErpTaskStore,
  useClientVisitStore,
  useCrmEventStore,
  useCrmAccountStore,
  useCrmOnboardingStore,
} from "@/stores";
import { useCompanyPortalStore } from "@/stores/useCompanyPortalStore";
import { useDesignTicketStore } from "@/stores/useDesignTicketStore";
import { useChatStore } from "@/stores/useChatStore";
import { useBookingStore } from "@/stores/useBookingStore";
import { hydrateAutomationFromServer, useAutomationStore } from "@/stores/useAutomationStore";
import {
  hydrateCrmAutomationFromServer,
  useCrmAutomationStore,
} from "@/stores/useCrmAutomationStore";
import { hydrateCrmSettingsFromServer } from "@/stores/useCrmSettingsStore";
import { hydrateCrmMasterFromServer, useCrmMasterStore } from "@/stores/useCrmMasterStore";
import type { CrmOnboardingRecord } from "@/types/crm-onboarding";

function readLegacyCrmOnboarding(): CrmOnboardingRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("buildesk-crm-onboarding-v1");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as {
      state?: { records?: CrmOnboardingRecord[] };
      records?: CrmOnboardingRecord[];
    };
    const records = parsed.state?.records ?? parsed.records;
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

/**
 * After session hydrate, pull authoritative data from SQLite into Zustand caches
 * so existing screens work against the server-backed dataset.
 */
export function ServerDataBootstrap({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const [ready, setReady] = useState(!user);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    wireConfigPersistence();
  }, []);

  useEffect(() => {
    if (!user) {
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    setError(null);

    (async () => {
      try {
        const [
          companies,
          projects,
          employees,
          users,
          tickets,
          ticketActivities,
          training,
          activity,
          notifications,
          vendors,
          labor,
          documents,
          integrations,
          postSales,
          master,
          settings,
          automation,
          crmAutomation,
          crmSettings,
          crmMaster,
          notes,
          attachments,
          checklist,
          charges,
          uploads,
          progressRows,
          customerApps,
          followUpTasks,
          erpFollowUpTasks,
          clientVisits,
          moduleSubscriptions,
          subscriptionEvents,
          crmEvents,
          portalAccess,
          crmAccounts,
          crmOnboarding,
          designTickets,
          chatSessions,
          bookingEventTypes,
          bookingAppointments,
          bookingAvailability,
          bookingBlocks,
        ] = await Promise.all([
          listCompanies(),
          listProjects({ data: {} }),
          listEmployees(),
          listUsers()
            .then((u) => ({ ok: true as const, users: u }))
            .catch(() => ({ ok: false as const, users: [] as Awaited<ReturnType<typeof listUsers>> })),
          listTickets(),
          listTicketActivities({ data: { } }).catch(() => []),
          listTraining(),
          listActivity({ data: { limit: 100 } }),
          listNotifications({ data: { limit: 80 } }).catch(() => []),
          getVendorBundle(),
          getLaborBundle(),
          listDocuments(),
          getIntegrationsBundle(),
          listPostSalesProjects({ data: {} }),
          getAppConfig({ data: { key: "master" } }).catch(() => ({})),
          getAppConfig({ data: { key: "settings" } }).catch(() => ({})),
          getAppConfig({ data: { key: "automation" } }).catch(() => ({})),
          getAppConfig({ data: { key: "crm-automation" } }).catch(() => ({})),
          getAppConfig({ data: { key: "crm-settings" } }).catch(() => ({})),
          getAppConfig({ data: { key: "crm-master" } }).catch(() => ({})),
          listAllNotes().catch(() => []),
          listAllAttachments().catch(() => []),
          listAllChecklist().catch(() => []),
          listAllOtherCharges().catch(() => []),
          listAllUploads().catch(() => []),
          listAllProgress().catch(() => []),
          listAllCustomerAppConfigs().catch(() => []),
          listFollowUpTasks({ data: {} }).catch(() => []),
          listErpFollowUpTasks({ data: {} }).catch(() => []),
          listClientVisits({ data: {} }).catch(() => []),
          listModuleSubscriptions({ data: {} }).catch(() => []),
          listModuleSubscriptionEvents({ data: {} }).catch(() => []),
          listCrmEvents({ data: { limit: 200 } }).catch(() => []),
          ensureCompanyPortals().catch(() => []),
          listCrmAccounts().catch((err) => {
            console.warn("[bootstrap] listCrmAccounts failed", err);
            return null;
          }),
          listCrmOnboardingRecords().catch((err) => {
            console.warn("[bootstrap] listCrmOnboardingRecords failed", err);
            return null;
          }),
          listDesignTickets({ data: {} }).catch((err) => {
            console.warn("[bootstrap] listDesignTickets failed", err);
            return null;
          }),
          listChatSessions().catch((err) => {
            console.warn("[bootstrap] listChatSessions failed", err);
            return null;
          }),
          listBookingEventTypes({ data: {} }).catch((err) => {
            console.warn("[bootstrap] listBookingEventTypes failed", err);
            return null;
          }),
          listBookingAppointments({ data: {} }).catch((err) => {
            console.warn("[bootstrap] listBookingAppointments failed", err);
            return null;
          }),
          listBookingAvailability({ data: {} }).catch((err) => {
            console.warn("[bootstrap] listBookingAvailability failed", err);
            return null;
          }),
          listBookingBlocks({ data: {} }).catch((err) => {
            console.warn("[bootstrap] listBookingBlocks failed", err);
            return null;
          }),
        ]);

        if (cancelled) return;

        useCompanyStore.setState({ companies });
        useProjectStore.setState({ projects });
        useEmployeeStore.setState({ employees });
        // Always apply server users (including empty) so deletes stay deleted — never fall back to seed.
        if (users.ok) useUserStore.setState({ users: users.users });
        useTicketStore.setState({
          tickets: tickets.map((t) => mapTicket(t as Record<string, unknown>)),
          activities: ticketActivities.map((a) =>
            mapTicketActivity(a as Record<string, unknown>),
          ),
        });
        useTrainingStore.setState({ sessions: training as never });
        useActivityStore.setState({ activities: activity });
        useNotificationStore.setState({ notifications });
        usePostSalesStore.setState({ projects: postSales });
        useNotesAttachmentsStore.setState({ notes, attachments });
        useOnboardingStore.setState({
          checklistItems: checklist.map((c) => ({
            ...c,
            notApplicable: c.notApplicable ?? false,
            source: c.source ?? "default",
            assigneeUserId: c.assigneeUserId ?? undefined,
            dueDate: c.dueDate ?? undefined,
          })),
          otherCharges: charges,
          uploads: uploads as never,
          customerAppConfigs: customerApps as never,
        });
        useProjectProgressStore.setState({
          byProjectId: Object.fromEntries(
            progressRows.map((p) => [
              p.projectId,
              {
                ...p,
                notApplicable: p.notApplicable ?? {},
              },
            ]),
          ),
        });
        useCrmTaskStore.setState({ tasks: followUpTasks });
        useErpTaskStore.setState({ tasks: erpFollowUpTasks });
        useClientVisitStore.setState({ visits: clientVisits });
        useCrmEventStore.setState({
          subscriptions: moduleSubscriptions,
          subscriptionEvents,
          events: crmEvents,
        });
        useCompanyPortalStore.getState().hydrateAccess(portalAccess);
        if (crmAccounts) {
          useCrmAccountStore.getState().hydrateAccounts(crmAccounts);
        }
        if (crmOnboarding) {
          if (crmOnboarding.length === 0) {
            // One-time: lift browser-local onboarding into SQLite so progress isn't lost.
            const local = readLegacyCrmOnboarding();
            if (local.length > 0) {
              useCrmOnboardingStore.getState().hydrateRecords(local);
              for (const record of local) {
                void upsertCrmOnboardingRecord({ data: record }).catch((err) => {
                  console.warn("[bootstrap] migrate crm onboarding failed", record.companyId, err);
                });
              }
              try {
                localStorage.removeItem("buildesk-crm-onboarding-v1");
              } catch {
                /* ignore */
              }
            } else {
              useCrmOnboardingStore.getState().hydrateRecords([]);
            }
          } else {
            useCrmOnboardingStore.getState().hydrateRecords(crmOnboarding);
            try {
              localStorage.removeItem("buildesk-crm-onboarding-v1");
            } catch {
              /* ignore */
            }
          }
        }
        if (designTickets) {
          useDesignTicketStore.getState().hydrateTickets(designTickets);
        }
        if (chatSessions) {
          useChatStore.getState().syncSessionsFromServer(chatSessions);
        }
        if (bookingEventTypes) {
          useBookingStore.getState().hydrateEventTypes(bookingEventTypes);
        }
        if (bookingAppointments) {
          useBookingStore.getState().hydrateAppointments(bookingAppointments);
        }
        if (bookingAvailability) {
          useBookingStore.getState().hydrateAvailability(bookingAvailability);
        }
        if (bookingBlocks) {
          useBookingStore.getState().hydrateBlocks(bookingBlocks);
        }
        useVendorStore.setState({
          materials: vendors.materials,
          suppliers: vendors.suppliers,
          contractors: vendors.contractors,
          purchaseOrders: vendors.purchaseOrders as never,
          workOrders: vendors.workOrders as never,
          boqs: vendors.boqs as never,
          approvalFlows: vendors.approvalFlows.map(
            (f: { id: string; name: string; stages: string[]; createdAt: string; updatedAt: string }) => ({
              id: f.id,
              name: f.name,
              stages: f.stages,
              createdAt: f.createdAt,
              updatedAt: f.updatedAt,
            }),
          ),
        });
        useLaborStore.setState({ labor: labor.labor, attendance: labor.attendance });
        useDocumentStore.setState({ templates: documents as never });
        useIntegrationStore.setState({
          integrations: integrations.integrations as never,
          triggers: integrations.triggers as never,
        });

        if (master && typeof master === "object" && Object.keys(master).length) {
          useMasterStore.setState((s) => ({ ...s, ...master }));
        }
        if (settings && typeof settings === "object" && Object.keys(settings).length > 1) {
          const { hydrateSettingsFromServer } = await import("@/stores/useSettingsStore");
          hydrateSettingsFromServer(settings as Record<string, unknown>);
        }
        if (crmSettings && typeof crmSettings === "object" && Object.keys(crmSettings).length > 0) {
          hydrateCrmSettingsFromServer(crmSettings as Record<string, unknown>);
        }
        if (crmMaster && typeof crmMaster === "object" && Object.keys(crmMaster).length > 0) {
          hydrateCrmMasterFromServer(crmMaster as Record<string, unknown>);
        } else if (user.role === "Admin") {
          // First-time setup: seed server from this admin's local master config.
          const { crmMasterSnapshot } = await import("@/stores/useCrmMasterStore");
          await setAppConfig({
            data: { key: "crm-master", value: crmMasterSnapshot() },
          }).catch(() => {});
        }
        if (automation && typeof automation === "object" && Object.keys(automation).length > 0) {
          hydrateAutomationFromServer(automation as Record<string, unknown>);
          // Older DB rows lack logs — push local logs up so the next refresh keeps them.
          if (
            !("logs" in (automation as object)) &&
            useAutomationStore.getState().logs.length > 0
          ) {
            const { flushAutomationConfigPersistence } = await import("@/lib/config-persistence");
            flushAutomationConfigPersistence();
          }
        } else {
          // Backfill server config so automation ON/OFF state survives deploys and device changes.
          const localAutomation = useAutomationStore.getState();
          await setAppConfig({
            data: {
              key: "automation",
              value: {
                settings: localAutomation.settings,
                endpoints: localAutomation.endpoints,
                waha: localAutomation.waha,
                healthCheck: localAutomation.healthCheck,
                rules: localAutomation.rules,
                logs: localAutomation.logs.slice(0, 500),
              },
            },
          }).catch(() => {});
        }

        if (crmAutomation && typeof crmAutomation === "object" && Object.keys(crmAutomation).length > 0) {
          hydrateCrmAutomationFromServer(crmAutomation as Record<string, unknown>);
          useCrmAutomationStore.getState().ensureDefaults();
          if (
            !("logs" in (crmAutomation as object)) &&
            useCrmAutomationStore.getState().logs.length > 0
          ) {
            const { flushAutomationConfigPersistence } = await import("@/lib/config-persistence");
            flushAutomationConfigPersistence();
          }
        } else {
          const localCrmAutomation = useCrmAutomationStore.getState();
          await setAppConfig({
            data: {
              key: "crm-automation",
              value: {
                settings: localCrmAutomation.settings,
                endpoints: localCrmAutomation.endpoints,
                waha: localCrmAutomation.waha,
                healthCheck: localCrmAutomation.healthCheck,
                rules: localCrmAutomation.rules,
                logs: localCrmAutomation.logs.slice(0, 500),
              },
            },
          }).catch(() => {});
        }

        setReady(true);
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setError(e instanceof Error ? e.message : "Failed to load server data");
          // Fail closed — do not mount the app on a hollow/empty Zustand cache.
          setReady(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm font-medium text-destructive">Could not load workspace data</p>
        <p className="max-w-sm text-xs text-muted-foreground">{error}</p>
        <button
          type="button"
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          onClick={() => {
            setError(null);
            setReady(false);
            // Trigger effect by forcing remount via state flip of user dependency —
            // re-run by briefly clearing ready and reloading.
            window.location.reload();
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!ready) {
    return (
      <AppLoadingScreen
        messages={[
          "Preparing your workspace…",
          "Loading accounts & projects…",
          "Syncing CRM & meetings…",
          "Almost ready…",
        ]}
      />
    );
  }

  return <>{children}</>;
}
