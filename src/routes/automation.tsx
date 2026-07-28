import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
import { AutomationTestPanel } from "@/components/automation/automation-test-panel";
import { PageWrap } from "@/components/page-header";
import {
  DesignTicketPageHeader,
  DesignTicketTabNav,
  TICKET_EASE,
} from "@/components/design-ticket/design-ticket-shared";
import { usePermissions } from "@/hooks/use-permissions";
import { checkHealth } from "@/services/automation";
import { useAutomationStore } from "@/stores/useAutomationStore";

const EASE = TICKET_EASE;

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
      <PageWrap compact>
        <DesignTicketPageHeader compact title="Automation" subtitle="Admin access required." />
        <p className="text-xs text-muted-foreground">Ask an administrator to manage ticket automation.</p>
      </PageWrap>
    );
  }

  return (
    <PageWrap compact>
      <DesignTicketPageHeader
        compact
        title="Automation"
        subtitle="Email via n8n webhooks · WhatsApp via WAHA — provider-agnostic configuration."
        actions={
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            <Bolt className="h-3 w-3" /> Admin
          </span>
        }
      />

      <DesignTicketTabNav
        compact
        tabs={TABS.map(({ id, label, icon }) => ({ id, label, icon }))}
        activeId={tab}
        onChange={(id) => void navigate({ search: { tab: id as TabId } })}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.28, ease: EASE }}
        >
        {tab === "overview" ? (
          <div className="space-y-3">
            <AutomationStatsRow
              {...stats}
              range={statsRange}
              onRangeChange={setStatsRange}
            />
            <AutomationTestPanel />
            <div className="grid gap-2 lg:grid-cols-2">
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
      </AnimatePresence>
    </PageWrap>
  );
}
