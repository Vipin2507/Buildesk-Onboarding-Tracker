import { useCallback, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Eye, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CRM_BOOKING_AUTOMATION_TRIGGERS } from "@/data/crm-automation-defaults";
import { retryCrmAutomationLog } from "@/services/crm-automation";
import { useCrmAutomationStore } from "@/stores/useCrmAutomationStore";
import { useCompanyStore } from "@/stores/useCompanyStore";
import {
  AUTOMATION_TRIGGERS,
  type AutomationLog,
  type AutomationLogStatus,
  type AutomationTrigger,
} from "@/types/automation";
import { formatDate } from "@/lib/utils";
import { useSessionFilterState } from "@/hooks/use-session-filter";
import { cn } from "@/lib/utils";

const TRIGGER_LABEL = Object.fromEntries(AUTOMATION_TRIGGERS.map((t) => [t.value, t.label])) as Record<
  AutomationTrigger,
  string
>;

const BOOKING_TRIGGER_SET = new Set<string>(CRM_BOOKING_AUTOMATION_TRIGGERS);

const AUTOMATION_LOG_FILTER_DEFAULTS: {
  statusFilter: "all" | AutomationLogStatus;
  channelFilter: "all" | "email" | "whatsapp";
  scopeFilter: "all" | "bookings" | "tickets";
} = {
  statusFilter: "all",
  channelFilter: "all",
  scopeFilter: "all",
};

function statusTone(status: AutomationLogStatus) {
  if (status === "success") return "success" as const;
  if (status === "failed") return "danger" as const;
  return "warning" as const;
}

export function AutomationLogsPanel() {
  const logs = useCrmAutomationStore((s) => s.logs);
  const companies = useCompanyStore((s) => s.companies);
  const [payloadLog, setPayloadLog] = useState<AutomationLog | null>(null);
  const [listFilters, setListFilters] = useSessionFilterState(
    "crm.automation.logs",
    AUTOMATION_LOG_FILTER_DEFAULTS,
  );
  const { statusFilter, channelFilter, scopeFilter } = listFilters;
  const setStatusFilter = useCallback(
    (value: "all" | AutomationLogStatus) => setListFilters({ statusFilter: value }),
    [setListFilters],
  );
  const setChannelFilter = useCallback(
    (value: "all" | "email" | "whatsapp") => setListFilters({ channelFilter: value }),
    [setListFilters],
  );
  const setScopeFilter = useCallback(
    (value: "all" | "bookings" | "tickets") => setListFilters({ scopeFilter: value }),
    [setListFilters],
  );
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (channelFilter !== "all" && l.channel !== channelFilter) return false;
      if (scopeFilter === "bookings" && !BOOKING_TRIGGER_SET.has(l.trigger)) return false;
      if (scopeFilter === "tickets" && BOOKING_TRIGGER_SET.has(l.trigger)) return false;
      return true;
    });
  }, [logs, statusFilter, channelFilter, scopeFilter]);

  async function handleRetry(log: AutomationLog) {
    setRetryingId(log.id);
    try {
      const result = await retryCrmAutomationLog(log.id);
      if (result?.status === "success") toast.success("Notification sent on retry");
      else toast.error(result?.errorMessage ?? "Retry failed");
    } finally {
      setRetryingId(null);
    }
  }

  async function retryAllFailed() {
    const failed = logs.filter((l) => l.status === "failed");
    if (failed.length === 0) {
      toast.message("No failed logs to retry");
      return;
    }
    for (const log of failed) {
      await handleRetry(log);
    }
  }

  const columns: {
    key: string;
    header: string;
    sortable?: boolean;
    render: (l: AutomationLog) => ReactNode;
  }[] = [
    {
      key: "attemptedAt",
      header: "Time",
      sortable: true,
      render: (l) => formatDate(l.attemptedAt),
    },
    {
      key: "ticketNumber",
      header: "Reference",
      render: (l) => l.ticketNumber ?? "—",
    },
    {
      key: "companyId",
      header: "Company",
      render: (l) => companies.find((c) => c.id === l.companyId)?.name ?? "—",
    },
    { key: "channel", header: "Channel", render: (l) => l.channel },
    {
      key: "trigger",
      header: "Trigger",
      render: (l) => TRIGGER_LABEL[l.trigger] ?? l.trigger,
    },
    {
      key: "status",
      header: "Status",
      render: (l) => (
        <motion.span
          key={`${l.id}-${l.status}`}
          initial={{ scale: 0.92, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          <Pill tone={statusTone(l.status)}>{l.status}</Pill>
        </motion.span>
      ),
    },
    {
      key: "summary",
      header: "Summary",
      render: (l) => (
        <span className="line-clamp-1 text-muted-foreground">
          {l.errorMessage ?? l.responseSummary ?? "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground">Automation logs</h2>
          <p className="text-[10px] text-muted-foreground">Every webhook attempt with retry support.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void retryAllFailed()} className="h-7 gap-1 px-2.5 text-xs">
          <RefreshCw className="h-3.5 w-3.5" /> Retry all failed
        </Button>
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5">
        <select
          className="h-8 rounded-md border bg-background px-2 text-xs"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
        >
          <option value="all">All statuses</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="retrying">Retrying</option>
        </select>
        <select
          className="h-8 rounded-md border bg-background px-2 text-xs"
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value as typeof channelFilter)}
        >
          <option value="all">All channels</option>
          <option value="email">Email</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
        <select
          className="h-8 rounded-md border bg-background px-2 text-xs"
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value as typeof scopeFilter)}
        >
          <option value="all">All types</option>
          <option value="bookings">Meetings</option>
          <option value="tickets">Tickets</option>
        </select>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        getRowId={(l) => l.id}
        searchKeys={["ticketNumber", "trigger", "channel", "errorMessage"]}
        actions={(l) => (
          <>
            <Button size="icon" variant="ghost" title="View payload" onClick={() => setPayloadLog(l)}>
              <Eye className="h-4 w-4" />
            </Button>
            {l.status === "failed" ? (
              <Button
                size="icon"
                variant="ghost"
                disabled={retryingId === l.id}
                onClick={() => void handleRetry(l)}
              >
                <RefreshCw className={cn("h-4 w-4", retryingId === l.id && "animate-spin")} />
              </Button>
            ) : null}
          </>
        )}
      />

      <Dialog open={Boolean(payloadLog)} onOpenChange={(o) => !o && setPayloadLog(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Webhook payload</DialogTitle>
          </DialogHeader>
          {payloadLog ? (
            <div className="space-y-3 text-sm">
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">Request</div>
                <pre className="overflow-auto rounded-lg border bg-muted/40 p-3 text-xs">
                  {JSON.stringify(payloadLog.requestPayload, null, 2)}
                </pre>
              </div>
              {payloadLog.responseSummary ? (
                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">Response</div>
                  <pre className="overflow-auto rounded-lg border bg-muted/40 p-3 text-xs">
                    {payloadLog.responseSummary}
                  </pre>
                </div>
              ) : null}
              {payloadLog.errorMessage ? (
                <div className="text-destructive">{payloadLog.errorMessage}</div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
