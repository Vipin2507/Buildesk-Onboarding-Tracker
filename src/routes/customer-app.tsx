import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader, PageWrap } from "@/components/page-header";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Smartphone, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnboardingStore, useProjectStore } from "@/stores";

export const Route = createFileRoute("/customer-app")({
  component: CustomerApp,
});

function CustomerApp() {
  const projects = useProjectStore((s) => s.projects);
  const projectId = projects[0]?.id ?? "";
  const configs = useOnboardingStore((s) => s.customerAppConfigs);
  const config = useMemo(() => configs.find((c) => c.projectId === projectId), [configs, projectId]);
  const updateConfig = useOnboardingStore((s) => s.updateCustomerAppConfig);
  const [mode, setMode] = useState(config?.mode ?? "whitelabel");

  if (!config) return <PageWrap><PageHeader title="Customer Application" subtitle="Create a project first." /></PageWrap>;

  return (
    <PageWrap>
      <PageHeader title="Customer Application" subtitle={`Configure app for ${projects[0]?.name}`} />
      <div className="card-soft mb-4 inline-flex rounded-full border bg-card p-1">
        {[{ k: "buildesk", label: "Buildesk App" }, { k: "whitelabel", label: "White Label App" }].map((t) => (
          <button key={t.k} onClick={() => { setMode(t.k as "buildesk" | "whitelabel"); updateConfig(projectId, { mode: t.k as "buildesk" | "whitelabel" }); toast.success("Mode updated"); }}
            className={cn("rounded-full px-4 py-1.5 text-sm font-medium", mode === t.k ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{t.label}</button>
        ))}
      </div>
      <div className="card-soft grid gap-4 p-5 md:grid-cols-2">
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
              onChange={(e) => { updateConfig(projectId, { [f.key]: e.target.value }); }}
              onBlur={() => toast.success("Config saved")}
            />
          </div>
        ))}
      </div>
      <div className="card-soft mt-4 flex items-center gap-4 p-5">
        <Smartphone className="h-10 w-10 text-primary" />
        <div>
          <div className="font-medium">Publish status: <Pill tone={config.publishStatus === "published" ? "success" : "warning"}>{config.publishStatus}</Pill></div>
          <Button className="mt-2" size="sm" onClick={() => { updateConfig(projectId, { publishStatus: "published" }); toast.success("App published"); }}>Mark Published</Button>
        </div>
      </div>
    </PageWrap>
  );
}
