import { Link } from "@tanstack/react-router";
import { useMemo } from "react";

import { DOCUMENTATION_CHECKLIST_SECTIONS, ONBOARDING_WORK_SECTIONS } from "@/data/constants";
import { useAuthStore, useOnboardingStore, useProjectStore } from "@/stores";

type CompanyRow = {
  id: string;
  name: string;
  computedStatus: string;
  isLive?: boolean;
};

type CompanyGap = {
  companyId: string;
  companyName: string;
  projectId: string;
  pending: string[];
  done: number;
  total: number;
};

function gapsFor(companies: CompanyRow[], sections: readonly string[]): CompanyGap[] {
  const projects = useProjectStore.getState().projects;
  const checklist = useOnboardingStore.getState().checklistItems;
  const active = companies.filter(
    (company) => company.computedStatus !== "completed" && !company.isLive,
  );
  const names = new Map(active.map((company) => [company.id, company.name]));
  const projectCompany = new Map(projects.map((project) => [project.id, project.companyId]));
  const primaryProject = new Map<string, string>();
  for (const project of projects) {
    if (names.has(project.companyId) && !primaryProject.has(project.companyId)) {
      primaryProject.set(project.companyId, project.id);
    }
  }
  const allowed = new Set(sections);
  const byCompany = new Map<string, { pending: Set<string>; done: number; total: number }>();

  for (const item of checklist) {
    if (!allowed.has(item.section)) continue;
    const companyId = projectCompany.get(item.projectId);
    if (!companyId || !names.has(companyId)) continue;
    const bucket = byCompany.get(companyId) ?? { pending: new Set<string>(), done: 0, total: 0 };
    bucket.total += 1;
    if (item.notApplicable || item.live) bucket.done += 1;
    else bucket.pending.add(item.label);
    byCompany.set(companyId, bucket);
  }

  return [...byCompany.entries()]
    .filter(([, bucket]) => bucket.pending.size > 0)
    .map(([companyId, bucket]) => ({
      companyId,
      companyName: names.get(companyId) ?? "Company",
      projectId: primaryProject.get(companyId) ?? "",
      pending: [...bucket.pending].sort((a, b) => a.localeCompare(b)),
      done: bucket.done,
      total: bucket.total,
    }))
    .sort(
      (a, b) => b.pending.length - a.pending.length || a.companyName.localeCompare(b.companyName),
    );
}

function commonGaps(rows: CompanyGap[]): { label: string; companies: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const label of row.pending) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, companies]) => ({ label, companies }))
    .sort((a, b) => b.companies - a.companies || a.label.localeCompare(b.label))
    .slice(0, 3);
}

function Queue({ title, owner, rows }: { title: string; owner: string; rows: CompanyGap[] }) {
  const shown = rows.slice(0, 6);
  const blockers = commonGaps(rows);
  const openSteps = rows.reduce((sum, row) => sum + row.pending.length, 0);

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">{title}</h2>
          <p className="text-[11px] text-muted-foreground">{owner}</p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold leading-none">{rows.length}</div>
          <div className="text-[10px] text-muted-foreground">companies</div>
        </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {openSteps} open steps
        {blockers.length > 0
          ? ` · most companies are still missing ${blockers
              .map((item) => `${item.label} (${item.companies})`)
              .join(", ")}`
          : ""}
      </p>

      {shown.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">Nothing pending in this queue.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border/60">
          {shown.map((row) => (
            <li key={row.companyId} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{row.companyName}</div>
                <div className="text-[11px] text-muted-foreground">
                  {row.done} of {row.total} done · {row.pending.length} still open
                </div>
                <div className="mt-0.5 line-clamp-2 text-xs text-foreground/80">
                  {row.pending.slice(0, 3).join(" · ")}
                  {row.pending.length > 3 ? ` · +${row.pending.length - 3} more` : ""}
                </div>
              </div>
              {row.projectId ? (
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: row.projectId }}
                  search={{ tab: "onboarding" }}
                  className="shrink-0 pt-0.5 text-xs font-semibold text-primary"
                >
                  Open
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {rows.length > shown.length ? (
        <p className="pt-2 text-[11px] text-muted-foreground">
          {rows.length - shown.length} more companies, ordered by how much is still open.
        </p>
      ) : null}
    </section>
  );
}

export function DashboardWorkQueues({ companies }: { companies: CompanyRow[] }) {
  const user = useAuthStore((s) => s.user);
  const checklist = useOnboardingStore((s) => s.checklistItems);
  const projects = useProjectStore((s) => s.projects);
  const docsFirst = (user?.name ?? "").toLowerCase().includes("gaurav");

  const docs = useMemo(
    () => gapsFor(companies, DOCUMENTATION_CHECKLIST_SECTIONS),
    [companies, checklist, projects],
  );
  const onboarding = useMemo(
    () => gapsFor(companies, ONBOARDING_WORK_SECTIONS),
    [companies, checklist, projects],
  );

  const documentation = (
    <Queue title="Documentation" owner="Gaurav’s queue, visible to the whole team" rows={docs} />
  );
  const onboardingQueue = (
    <Queue title="Onboarding" owner="Anurag’s queue, visible to the whole team" rows={onboarding} />
  );

  return (
    <div className="grid gap-2.5 lg:grid-cols-2">
      {docsFirst ? documentation : onboardingQueue}
      {docsFirst ? onboardingQueue : documentation}
    </div>
  );
}
