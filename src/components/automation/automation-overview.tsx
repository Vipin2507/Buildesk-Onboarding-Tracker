import { motion } from "framer-motion";
import { Check, Loader2, Mail, MessageCircle, RefreshCw, X } from "lucide-react";

import { CountUp } from "@/components/count-up";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatRelativeTime } from "@/types/common";
import type { AutomationEndpoint, AutomationHealthConfig } from "@/types/automation";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

function StatusBadge({
  status,
  checking,
}: {
  status?: "healthy" | "unhealthy" | "unknown";
  checking?: boolean;
}) {
  const label = checking ? "Checking…" : status === "healthy" ? "Healthy" : status === "unhealthy" ? "Unhealthy" : "Unknown";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        checking && "animate-pulse border-primary/30 bg-primary/10 text-primary",
        !checking && status === "healthy" && "border-success/30 bg-success/10 text-success",
        !checking && status === "unhealthy" && "border-destructive/30 bg-destructive/10 text-destructive",
        !checking && status !== "healthy" && status !== "unhealthy" && "border-border bg-muted text-muted-foreground",
      )}
    >
      {checking ? <Loader2 className="h-3 w-3 animate-spin" /> : status === "healthy" ? <Check className="h-3 w-3" /> : status === "unhealthy" ? <X className="h-3 w-3" /> : null}
      {label}
    </span>
  );
}

export function ChannelStatusCard({
  endpoint,
  checking,
  onTest,
  onToggle,
}: {
  endpoint: AutomationEndpoint;
  checking: boolean;
  onTest: () => void;
  onToggle: (enabled: boolean) => void;
}) {
  const Icon = endpoint.channel === "email" ? Mail : MessageCircle;
  const check = endpoint.lastHealthCheck;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-soft p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold">{endpoint.label}</div>
            <div className="text-xs text-muted-foreground">
              {endpoint.provider === "waha"
                ? "WAHA · sendText API"
                : "n8n webhook · provider swappable"}
            </div>
          </div>
        </div>
        <StatusBadge status={check?.status} checking={checking} />
      </div>
      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        <div>
          Last checked: {check?.checkedAt ? formatRelativeTime(check.checkedAt) : "Never"}
        </div>
        {check?.latencyMs != null ? <div>Latency: {check.latencyMs}ms</div> : null}
        {check?.message ? <div>{check.message}</div> : null}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={endpoint.isEnabled} onCheckedChange={onToggle} size="sm" />
          Enabled
        </label>
        <Button size="sm" variant="outline" disabled={checking} onClick={onTest} className="gap-1.5">
          {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Test Connection
        </Button>
      </div>
    </motion.div>
  );
}

export function HealthCheckCard({
  config,
  checking,
  onTest,
}: {
  config: AutomationHealthConfig;
  checking: boolean;
  onTest: () => void;
}) {
  const check = config.lastHealthCheck;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05, ease: EASE }}
      className="card-soft p-4 lg:col-span-2"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{config.label}</div>
          <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{config.webhookUrl}</div>
        </div>
        <StatusBadge status={check?.status} checking={checking} />
      </div>
      {check?.rawResponse ? (
        <pre className="mt-3 max-h-24 overflow-auto rounded-lg border bg-muted/40 p-2 text-[11px] text-muted-foreground">
          {check.rawResponse}
        </pre>
      ) : null}
      <div className="mt-3">
        <Button size="sm" variant="outline" disabled={checking} onClick={onTest} className="gap-1.5">
          {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Run health check
        </Button>
      </div>
    </motion.div>
  );
}

export function AutomationStatsRow({
  sent24h,
  sent7d,
  sent30d,
  successRate,
  failedCount,
  range,
  onRangeChange,
}: {
  sent24h: number;
  sent7d: number;
  sent30d: number;
  successRate: number;
  failedCount: number;
  range: "24h" | "7d" | "30d";
  onRangeChange: (r: "24h" | "7d" | "30d") => void;
}) {
  const sent = range === "24h" ? sent24h : range === "7d" ? sent7d : sent30d;
  return (
    <div className="grid gap-2.5 sm:grid-cols-3">
      <div className="card-soft p-3">
        <div className="mb-2 flex gap-1">
          {(["24h", "7d", "30d"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onRangeChange(r)}
              className={cn(
                "rounded-md px-2 py-0.5 text-[10px] font-medium",
                range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="text-xs text-muted-foreground">Notifications sent</div>
        <div className="text-2xl font-semibold tabular-nums">
          <CountUp to={sent} />
        </div>
      </div>
      <div className="card-soft p-3">
        <div className="text-xs text-muted-foreground">Success rate</div>
        <div className="text-2xl font-semibold tabular-nums text-success">
          <CountUp to={successRate} format={(n) => `${Math.round(n)}%`} />
        </div>
      </div>
      <div className="card-soft p-3">
        <div className="text-xs text-muted-foreground">Failed (retry)</div>
        <div className="text-2xl font-semibold tabular-nums text-destructive">
          <CountUp to={failedCount} />
        </div>
      </div>
    </div>
  );
}
