import { Link } from "@tanstack/react-router";

import { DOCUMENTATION_CHECKLIST_SECTIONS, ONBOARDING_WORK_SECTIONS } from "@/data/constants";
import { useAuthStore, useOnboardingStore, useProjectStore } from "@/stores";

type CompanyRow = {
  id: string;
  name: string;
  computedStatus: string;
  isLive?: boolean;
};

type QueueItem = {
  id: string;
  label: string;
  section: string;
  projectId: string;
  companyName: string;
};

function pendingItems(companies: CompanyRow[], sections: readonly string[]): QueueItem[] {
  const projects = useProjectStore.getState().projects;
  const checklist = useOnboardingStore.getState().checklistItems;
  const activeIds = new Set(
    companies
      .filter((company) => company.computedStatus !== "completed" && !company.isLive)
      .map((company) => company.id),
  );
  const companyName = new Map(companies.map((company) => [company.id, company.name]));
  const projectCompany = new Map(projects.map((project) => [project.id, project.companyId]));
  const allowed = new Set(sections);

  return checklist
    .filter((item) => !item.notApplicable && !item.live && allowed.has(item.section))
    .map((item) => {
      const companyId = projectCompany.get(item.projectId);
      if (!companyId || !activeIds.has(companyId)) return null;
      return {
        id: item.id,
        label: item.label,
        section: item.section,
        projectId: item.projectId,
        companyName: companyName.get(companyId) ?? "Company",
      };
    })
    .filter((item): item is QueueItem => Boolean(item))
    .sort((a, b) => a.companyName.localeCompare(b.companyName) || a.label.localeCompare(b.label));
}

function Queue({ title, owner, items }: { title: string; owner: string; items: QueueItem[] }) {
  const shown = items.slice(0, 8);
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold">{title}</h2>
          <p className="text-[11px] text-muted-foreground">
            {owner} · {items.length} pending on active companies
          </p>
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">Nothing pending in this queue.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {shown.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{item.companyName}</div>
                <div className="truncate text-xs text-muted-foreground">{item.label}</div>
              </div>
              <Link
                to="/projects/$projectId"
                params={{ projectId: item.projectId }}
                search={{ tab: "onboarding" }}
                className="shrink-0 text-xs font-semibold text-primary"
              >
                Update
              </Link>
            </li>
          ))}
        </ul>
      )}
      {items.length > shown.length ? (
        <p className="pt-2 text-[11px] text-muted-foreground">
          {items.length - shown.length} more on the project checklists.
        </p>
      ) : null}
    </section>
  );
}

export function DashboardWorkQueues({ companies }: { companies: CompanyRow[] }) {
  const user = useAuthStore((s) => s.user);
  useOnboardingStore((s) => s.checklistItems);
  useProjectStore((s) => s.projects);
  const docs = pendingItems(companies, DOCUMENTATION_CHECKLIST_SECTIONS);
  const onboarding = pendingItems(companies, ONBOARDING_WORK_SECTIONS);
  const docsFirst = (user?.name ?? "").toLowerCase().includes("gaurav");
  const documentation = (
    <Queue title="Documentation" owner="Gaurav’s queue, visible to the whole team" items={docs} />
  );
  const onboardingQueue = (
    <Queue
      title="Onboarding"
      owner="Anurag’s queue, visible to the whole team"
      items={onboarding}
    />
  );

  return (
    <div className="grid gap-2.5 lg:grid-cols-2">
      {docsFirst ? documentation : onboardingQueue}
      {docsFirst ? onboardingQueue : documentation}
    </div>
  );
}
