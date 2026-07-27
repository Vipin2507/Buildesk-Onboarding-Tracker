import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bolt, FileText, List, Settings2, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";

import {
  AutomationStatsRow,
  ChannelStatusCard,
  HealthCheckCard,
} from "@/components/automation/automation-overview";
import { AutomationLogsPanel } from "@/components/automation/automation-logs-panel";
import { AutomationRulesPanel } from "@/components/automation/automation-rules-panel";
import { AutomationWebhookSettings } from "@/components/automation/automation-webhook-settings";
import { PageHeader, PageWrap } from "@/components/page-header";
import { usePermissions } from "@/hooks/use-permissions";
import { checkHealth } from "@/services/automation";
import { useAutomationStore } from "@/stores/useAutomationStore";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "rules", label: "Rules", icon: FileText },
  { id: "logs", label: "Logs", icon: List },
  { id: "settings", label: "Webhooks", icon: Settings2 },
] as const;

type TabId = (typeof TABS)[number]["id"];

export const Route = createFileRoute("/automation")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: TABS.some((t) => t.id === search.tab) ? (search.tab as TabId) : ("overview" as TabId),
  }),
  component: AutomationPage,
});

function AutomationPage() {
  const { isAdmin } = usePermissions();
  const navigate = useNavigate({ from: "/automation" });
  const search = Route.useSearch();
  const tab = search.tab;

  const endpoints = useAutomationStore((s) => s.endpoints);
  const healthCheck = useAutomationStore((s) => s.healthCheck);
  const logs = useAutomationStore((s) => s.logs);
  const setEndpointEnabled = useAutomationStore((s) => s.setEndpointEnabled);
  const ensureDefaults = useAutomationStore((s) => s.ensureDefaults);

  const [checking, setChecking] = useState(false);
  const [statsRange, setStatsRange] = useState<"24h" | "7d" | "30d">("7d");

  useEffect(() => {
    ensureDefaults();
  }, [ensureDefaults]);

  useEffect(() => {
    if (!isAdmin) return;
    void runHealthCheck();
  }, [isAdmin]);

  async function runHealthCheck() {
    setChecking(true);
    try {
      await checkHealth();
      toast.success("Health check completed");
    } catch {
      toast.error("Health check failed");
    } finally {
      setChecking(false);
    }
  }

  const stats = useMemo(() => {
    const now = Date.now();
    const inRange = (ms: number) => logs.filter((l) => now - new Date(l.attemptedAt).getTime() <= ms);
    const l24 = inRange(86400000);
    const l7 = inRange(7 * 86400000);
    const l30 = inRange(30 * 86400000);
    const calcRate = (items: typeof logs) => {
      if (items.length === 0) return 100;
      const ok = items.filter((l) => l.status === "success").length;
      return Math.round((ok / items.length) * 100);
    };
    return {
      sent24h: l24.length,
      sent7d: l7.length,
      sent30d: l30.length,
      successRate: calcRate(l7),
      failedCount: logs.filter((l) => l.status === "failed").length,
    };
  }, [logs]);

  if (!isAdmin) {
    return (
      <PageWrap>
        <PageHeader title="Automation" subtitle="Admin access required." />
        <p className="text-sm text-muted-foreground">Ask an administrator to manage ticket automation.</p>
      </PageWrap>
    );
  }

  return (
    <PageWrap>
      <PageHeader
        title="Automation"
        subtitle="n8n-powered email & WhatsApp notifications for support tickets — provider-agnostic webhooks."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            <Bolt className="h-3.5 w-3.5" /> Admin
          </span>
        }
      />

      <div className="card-soft mb-4 -mx-1 flex gap-1 overflow-x-auto px-1 py-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => void navigate({ search: { tab: id } })}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {tab === "overview" ? (
          <div className="space-y-4">
            <AutomationStatsRow
              {...stats}
              range={statsRange}
              onRangeChange={setStatsRange}
            />
            <div className="grid gap-3 lg:grid-cols-2">
              {endpoints.map((endpoint) => (
                <ChannelStatusCard
                  key={endpoint.channel}
                  endpoint={endpoint}
                  checking={checking}
                  onTest={() => void runHealthCheck()}
                  onToggle={(enabled) => setEndpointEnabled(endpoint.channel, enabled)}
                />
              ))}
              <HealthCheckCard config={healthCheck} checking={checking} onTest={() => void runHealthCheck()} />
            </div>
          </div>
        ) : null}

        {tab === "rules" ? <AutomationRulesPanel /> : null}
        {tab === "logs" ? <AutomationLogsPanel /> : null}
        {tab === "settings" ? <AutomationWebhookSettings /> : null}
      </motion.div>
    </PageWrap>
  );
}
