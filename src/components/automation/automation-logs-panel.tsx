import { useMemo, useState, type ReactNode } from "react";
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
import { retryAutomationLog } from "@/services/automation";
import { useAutomationStore } from "@/stores/useAutomationStore";
import { useCompanyStore } from "@/stores/useCompanyStore";
import type { AutomationLog, AutomationLogStatus } from "@/types/automation";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

function statusTone(status: AutomationLogStatus) {
  if (status === "success") return "success" as const;
  if (status === "failed") return "danger" as const;
  return "warning" as const;
}

export function AutomationLogsPanel() {
  const logs = useAutomationStore((s) => s.logs);
  const companies = useCompanyStore((s) => s.companies);
  const [payloadLog, setPayloadLog] = useState<AutomationLog | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | AutomationLogStatus>("all");
  const [channelFilter, setChannelFilter] = useState<"all" | "email" | "whatsapp">("all");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (channelFilter !== "all" && l.channel !== channelFilter) return false;
      return true;
    });
  }, [logs, statusFilter, channelFilter]);

  async function handleRetry(log: AutomationLog) {
    setRetryingId(log.id);
    try {
      const result = await retryAutomationLog(log.id);
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
      header: "Ticket",
      render: (l) => l.ticketNumber ?? "—",
    },
    {
      key: "companyId",
      header: "Company",
      render: (l) => companies.find((c) => c.id === l.companyId)?.name ?? "—",
    },
    { key: "channel", header: "Channel", render: (l) => l.channel },
    { key: "trigger", header: "Trigger", render: (l) => l.trigger },
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
