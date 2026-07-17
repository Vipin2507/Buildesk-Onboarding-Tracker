import { useEffect, useState, type ReactNode } from "react";

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
  listTraining,
  listUsers,
  listNotifications,
  getAppConfig,
} from "@/lib/api";
import { wireConfigPersistence } from "@/lib/config-persistence";
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
} from "@/stores";

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
          notes,
          attachments,
          checklist,
          charges,
          uploads,
          progressRows,
          customerApps,
        ] = await Promise.all([
          listCompanies(),
          listProjects({ data: {} }),
          listEmployees(),
          listUsers()
            .then((u) => ({ ok: true as const, users: u }))
            .catch(() => ({ ok: false as const, users: [] as Awaited<ReturnType<typeof listUsers>> })),
          listTickets(),
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
          listAllNotes().catch(() => []),
          listAllAttachments().catch(() => []),
          listAllChecklist().catch(() => []),
          listAllOtherCharges().catch(() => []),
          listAllUploads().catch(() => []),
          listAllProgress().catch(() => []),
          listAllCustomerAppConfigs().catch(() => []),
        ]);

        if (cancelled) return;

        useCompanyStore.setState({ companies });
        useProjectStore.setState({ projects });
        useEmployeeStore.setState({ employees });
        // Always apply server users (including empty) so deletes stay deleted — never fall back to seed.
        if (users.ok) useUserStore.setState({ users: users.users });
        useTicketStore.setState({
          tickets: tickets.map((t) => ({
            ...t,
            type: t.type as never,
            priority: t.priority as never,
            status: t.status as never,
            developerId: t.developerId ?? "",
            companyId: t.companyId ?? "",
            projectId: t.projectId ?? "",
            description: t.description ?? "",
          })),
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
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Syncing data from server…
      </div>
    );
  }

  return <>{children}</>;
}
