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
  listCompanies,
  listDocuments,
  listEmployees,
  listProjects,
  listPostSalesProjects,
  listTickets,
  listTraining,
  listUsers,
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
        ] = await Promise.all([
          listCompanies(),
          listProjects({ data: {} }),
          listEmployees(),
          listUsers().catch(() => []),
          listTickets(),
          listTraining(),
          listActivity({ data: { limit: 100 } }),
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
        ]);

        if (cancelled) return;

        useCompanyStore.setState({ companies });
        useProjectStore.setState({ projects });
        useEmployeeStore.setState({ employees });
        if (users.length) useUserStore.setState({ users });
        useTicketStore.setState({ tickets: tickets as never });
        useTrainingStore.setState({ sessions: training as never });
        useActivityStore.setState({ activities: activity });
        usePostSalesStore.setState({ projects: postSales });
        useNotesAttachmentsStore.setState({ notes, attachments });
        useOnboardingStore.setState({
          checklistItems: checklist,
          otherCharges: charges,
          uploads: uploads as never,
        });
        useProjectProgressStore.setState({
          byProjectId: Object.fromEntries(progressRows.map((p) => [p.projectId, p])),
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
          useSettingsStore.setState((s) => ({ ...s, ...settings }));
        }

        setReady(true);
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setError(e instanceof Error ? e.message : "Failed to load server data");
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Syncing data from server…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <p className="text-xs text-muted-foreground">Showing cached data where available.</p>
        {children}
      </div>
    );
  }

  return <>{children}</>;
}
