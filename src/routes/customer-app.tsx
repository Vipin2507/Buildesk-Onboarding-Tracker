import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { PageHeader, PageWrap } from "@/components/page-header";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Smartphone, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompanyStore, useOnboardingStore, useProjectStore } from "@/stores";

const searchSchema = z.object({
  companyId: z.string().optional(),
  projectId: z.string().optional(),
});

export const Route = createFileRoute("/customer-app")({
  validateSearch: (search) => searchSchema.parse(search),
  component: CustomerApp,
});

function CustomerApp() {
  const { companyId, projectId: projectIdSearch } = Route.useSearch();
  const companies = useCompanyStore((s) => s.companies);
  const allProjects = useProjectStore((s) => s.projects);
  const projects = useMemo(() => {
    if (companyId) return allProjects.filter((p) => p.companyId === companyId);
    return allProjects;
  }, [allProjects, companyId]);
  const [selectedProjectId, setSelectedProjectId] = useState(
    projectIdSearch || projects[0]?.id || "",
  );
  const projectId = selectedProjectId || projects[0]?.id || "";
  const project = projects.find((p) => p.id === projectId) ?? projects[0];
  const company = companies.find((c) => c.id === (companyId || project?.companyId));

  const configs = useOnboardingStore((s) => s.customerAppConfigs);
  const config = useMemo(() => configs.find((c) => c.projectId === projectId), [configs, projectId]);
  const updateConfig = useOnboardingStore((s) => s.updateCustomerAppConfig);
  const [mode, setMode] = useState(config?.mode ?? "whitelabel");

  if (projects.length === 0) {
    return (
      <PageWrap>
        <PageHeader
          title="Customer Application"
          subtitle={
            company
              ? `No projects for ${company.name} yet.`
              : "Create a project first, or open this page from a company module hub."
          }
        />
      </PageWrap>
    );
  }

  if (!config) {
    return (
      <PageWrap>
        <PageHeader
          title="Customer Application"
          subtitle={`Select a project to configure. Config for ${project?.name ?? "this project"} will appear after bootstrap.`}
        />
        <select
          className="mt-2 h-9 rounded-md border px-3 text-sm"
          value={projectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </PageWrap>
    );
  }

  return (
    <PageWrap>
      <PageHeader
        title="Customer Application"
        subtitle={`Configure app for ${project?.name ?? "project"}${company ? ` · ${company.name}` : ""}`}
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="text-xs font-medium">
          Project
          <select
            className="mt-1 block h-9 min-w-[12rem] rounded-md border px-3 text-sm"
            value={projectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              const next = configs.find((c) => c.projectId === e.target.value);
              if (next) setMode(next.mode);
            }}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="card-soft mb-4 flex w-full rounded-xl border bg-card p-1 sm:inline-flex sm:w-auto sm:rounded-full">
        {[
          { k: "buildesk", label: "Buildesk App" },
          { k: "whitelabel", label: "White Label App" },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => {
              setMode(t.k as "buildesk" | "whitelabel");
              updateConfig(projectId, { mode: t.k as "buildesk" | "whitelabel" });
              toast.success("Mode updated");
            }}
            className={cn(
              "min-h-10 flex-1 rounded-lg px-4 py-2 text-sm font-medium sm:flex-none sm:rounded-full sm:py-1.5",
              mode === t.k ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="card-soft grid gap-4 p-4 sm:p-5 md:grid-cols-2">
        {[
          { key: "appName", label: "App Name" },
          { key: "primaryColor", label: "Primary Color" },
          { key: "supportEmail", label: "Support Email" },
          { key: "supportPhone", label: "Support Phone" },
        ].map((f) => (
          <div key={f.key}>
            <div className="text-xs text-muted-foreground">{f.label}</div>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={(config as Record<string, string>)[f.key] ?? ""}
              onChange={(e) => {
                updateConfig(projectId, { [f.key]: e.target.value });
              }}
              onBlur={() => toast.success("Config saved")}
            />
          </div>
        ))}
        <div className="md:col-span-2">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Smartphone className="h-4 w-4" /> Publish status
          </div>
          <Pill tone={config.publishStatus === "published" ? "success" : "muted"}>
            {config.publishStatus}
          </Pill>
          <Button
            className="ml-3"
            size="sm"
            variant="outline"
            onClick={() => {
              updateConfig(projectId, { publishStatus: "published" });
              toast.success("Marked published");
            }}
          >
            <Check className="mr-1 h-3.5 w-3.5" /> Publish
          </Button>
        </div>
      </div>
      {companyId ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Scoped from company module.{" "}
          <Link
            to="/companies/$companyId/modules/$moduleKey"
            params={{ companyId, moduleKey: "customer-app" }}
            className="text-primary underline"
          >
            Back to module hub
          </Link>
        </p>
      ) : null}
    </PageWrap>
  );
}
