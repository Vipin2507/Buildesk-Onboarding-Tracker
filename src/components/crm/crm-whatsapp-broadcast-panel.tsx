import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Megaphone,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isCrmAccountEnded } from "@/lib/crm-account-status";
import { applyCrmWhatsappTemplate } from "@/lib/crm-whatsapp-templates";
import { cn } from "@/lib/utils";
import {
  cancelCrmWhatsappBroadcast,
  createCrmWhatsappBroadcast,
  getCrmWhatsappBroadcast,
  listCrmWhatsappBroadcasts,
  runCrmWhatsappBroadcastNow,
} from "@/lib/api";
import { listActiveCrmWhatsappTemplates, useCrmMasterStore } from "@/stores/useCrmMasterStore";
import { useCrmAccountStore } from "@/stores/useCrmAccountStore";
import { useCrmAutomationStore } from "@/stores/useCrmAutomationStore";
import type {
  CrmWhatsappBroadcast,
  CrmWhatsappBroadcastDelivery,
} from "@/types/crm-whatsapp-broadcast";

function hasGroup(account: { whatsappGroupId?: string | null }) {
  return Boolean(account.whatsappGroupId?.trim());
}

function toLocalInputValue(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(value: string) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function statusTone(status: string) {
  switch (status) {
    case "completed":
    case "sent":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "pending":
      return "bg-sky-500/15 text-sky-700 dark:text-sky-400";
    case "running":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-400";
    case "failed":
      return "bg-destructive/15 text-destructive";
    case "cancelled":
    case "skipped":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function CrmWhatsappBroadcastPanel() {
  const accounts = useCrmAccountStore((s) => s.accounts);
  const waha = useCrmAutomationStore((s) => s.waha);
  const whatsappTemplates = useCrmMasterStore((s) => s.whatsappTemplates);
  const templates = useMemo(
    () => listActiveCrmWhatsappTemplates(),
    [whatsappTemplates],
  );

  const linkedAccounts = useMemo(
    () =>
      accounts
        .filter((a) => !isCrmAccountEnded(a.status) && hasGroup(a))
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [accounts],
  );

  const [accountSearch, setAccountSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [mode, setMode] = useState<"template" | "custom">("template");
  const [templateId, setTemplateId] = useState("");
  const [body, setBody] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduleLocal, setScheduleLocal] = useState(() => toLocalInputValue(new Date(Date.now() + 60 * 60_000)));
  const [submitting, setSubmitting] = useState(false);
  const [broadcasts, setBroadcasts] = useState<CrmWhatsappBroadcast[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<CrmWhatsappBroadcastDelivery[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (templates.length && !templateId) {
      setTemplateId(templates[0]!.id);
      setBody(templates[0]!.body);
    }
  }, [templates, templateId]);

  const filteredAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();
    if (!q) return linkedAccounts;
    return linkedAccounts.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.city?.toLowerCase().includes(q) ||
        a.whatsappGroupName?.toLowerCase().includes(q),
    );
  }, [linkedAccounts, accountSearch]);

  const selectedTemplate = templates.find((t) => t.id === templateId);
  const previewAccount = linkedAccounts.find((a) => selectedIds.has(a.id)) ?? linkedAccounts[0];
  const previewBody = applyCrmWhatsappTemplate(
    mode === "template" ? selectedTemplate?.body || body : body,
    previewAccount,
  );

  const refreshList = useCallback(async () => {
    setLoadingList(true);
    try {
      const rows = await listCrmWhatsappBroadcasts({ data: { limit: 40 } });
      setBroadcasts(rows);
    } catch {
      toast.error("Could not load broadcasts");
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    const hasActive = broadcasts.some((b) => b.status === "pending" || b.status === "running");
    if (!hasActive) return;
    const id = window.setInterval(() => void refreshList(), 8_000);
    return () => window.clearInterval(id);
  }, [broadcasts, refreshList]);

  function toggleAccount(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const a of filteredAccounts) next.add(a.id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function openDetail(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setDeliveries([]);
      return;
    }
    setExpandedId(id);
    setLoadingDetail(true);
    try {
      const detail = await getCrmWhatsappBroadcast({ data: { id } });
      setDeliveries(detail.deliveries);
    } catch {
      toast.error("Could not load delivery details");
      setExpandedId(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function onSubmit() {
    if (!waha.isEnabled) {
      toast.error("Enable WAHA in Automation → Webhooks first");
      return;
    }
    if (selectedIds.size === 0) {
      toast.error("Select at least one account with a linked WhatsApp group");
      return;
    }
    const messageBody =
      mode === "template" ? (selectedTemplate?.body || body).trim() : body.trim();
    if (!messageBody) {
      toast.error("Message body is empty");
      return;
    }

    let scheduledAt: string | null = null;
    const sendNow = scheduleMode === "now";
    if (!sendNow) {
      scheduledAt = localInputToIso(scheduleLocal);
      if (!scheduledAt) {
        toast.error("Pick a valid schedule time");
        return;
      }
      if (Date.parse(scheduledAt) <= Date.now()) {
        toast.error("Schedule time must be in the future");
        return;
      }
    }

    setSubmitting(true);
    try {
      const created = await createCrmWhatsappBroadcast({
        data: {
          accountIds: [...selectedIds],
          templateId: mode === "template" ? templateId || null : null,
          body: messageBody,
          scheduledAt,
          sendNow,
        },
      });
      toast.success(
        sendNow
          ? `Broadcast sent to ${created.sentCount} group${created.sentCount === 1 ? "" : "s"}`
          : `Scheduled for ${formatWhen(created.scheduledAt)}`,
      );
      await refreshList();
      if (created.status === "completed" || created.status === "failed" || created.status === "running") {
        setExpandedId(created.id);
        const detail = await getCrmWhatsappBroadcast({ data: { id: created.id } });
        setDeliveries(detail.deliveries);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Broadcast failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function onCancel(id: string) {
    try {
      await cancelCrmWhatsappBroadcast({ data: { id } });
      toast.success("Broadcast cancelled");
      await refreshList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cancel failed");
    }
  }

  async function onRunNow(id: string) {
    try {
      const res = await runCrmWhatsappBroadcastNow({ data: { id } });
      toast.success(`Sent ${res.sent} message${res.sent === 1 ? "" : "s"}`);
      await refreshList();
      if (expandedId === id) {
        const detail = await getCrmWhatsappBroadcast({ data: { id } });
        setDeliveries(detail.deliveries);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    }
  }

  return (
    <div className="space-y-3">
      <div className="card-soft space-y-3 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Megaphone className="h-4 w-4 text-primary" />
              WhatsApp group broadcast
            </h3>
            <p className="text-[10px] text-muted-foreground">
              Send or schedule a Master template / custom message to multiple account WhatsApp groups.
              Variables like {"{{clientName}}"} fill per account at send time.
            </p>
          </div>
          {!waha.isEnabled ? (
            <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-400">
              WAHA disabled
            </span>
          ) : null}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-xs">Accounts with groups ({selectedIds.size} selected)</Label>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="ghost" className="h-7 text-[10px]" onClick={selectAllFiltered}>
                  Select visible
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-7 text-[10px]" onClick={clearSelection}>
                  Clear
                </Button>
              </div>
            </div>
            <Input
              value={accountSearch}
              onChange={(e) => setAccountSearch(e.target.value)}
              placeholder="Search accounts…"
              className="h-8 text-xs"
            />
            <div className="max-h-56 divide-y overflow-y-auto rounded-md border">
              {filteredAccounts.length === 0 ? (
                <p className="px-2.5 py-4 text-center text-[10px] text-muted-foreground">
                  No linked groups. Use Accounts → Sync accounts first.
                </p>
              ) : (
                filteredAccounts.map((a) => {
                  const on = selectedIds.has(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAccount(a.id)}
                      className={cn(
                        "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-muted/60",
                        on && "bg-primary/5",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                          on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                        )}
                      >
                        {on ? <Check className="h-3 w-3" /> : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
                      <span className="max-w-[40%] truncate text-[10px] text-muted-foreground">
                        {a.whatsappGroupName || a.whatsappGroupId}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex gap-1 rounded-md border p-0.5">
              <button
                type="button"
                className={cn(
                  "flex-1 rounded px-2 py-1 text-[10px] font-medium",
                  mode === "template" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
                onClick={() => {
                  setMode("template");
                  if (selectedTemplate) setBody(selectedTemplate.body);
                }}
              >
                Use template
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 rounded px-2 py-1 text-[10px] font-medium",
                  mode === "custom" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
                onClick={() => setMode("custom")}
              >
                Custom message
              </button>
            </div>

            {mode === "template" ? (
              <div>
                <Label className="text-xs">Template</Label>
                <select
                  className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-xs"
                  value={templateId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setTemplateId(id);
                    const t = templates.find((x) => x.id === id);
                    if (t) setBody(t.body);
                  }}
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {t.category}
                    </option>
                  ))}
                </select>
                {templates.length === 0 ? (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    No active templates — add them in CRM Master → WhatsApp.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div>
              <Label className="text-xs">Message body</Label>
              <Textarea
                value={mode === "template" ? selectedTemplate?.body || body : body}
                onChange={(e) => {
                  setMode("custom");
                  setBody(e.target.value);
                }}
                rows={8}
                className="mt-1 text-xs"
                placeholder="Hi {{clientName}},…"
                disabled={mode === "template"}
              />
              {mode === "template" ? (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Edit in Master to change the template, or switch to Custom message.
                </p>
              ) : null}
            </div>

            <div>
              <Label className="text-xs">Preview {previewAccount ? `(${previewAccount.name})` : ""}</Label>
              <div className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/30 px-2.5 py-2 text-[11px] leading-relaxed text-foreground">
                {previewBody || "—"}
              </div>
            </div>

            <div className="flex gap-1 rounded-md border p-0.5">
              <button
                type="button"
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 rounded px-2 py-1.5 text-[10px] font-medium",
                  scheduleMode === "now" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
                onClick={() => setScheduleMode("now")}
              >
                <Send className="h-3 w-3" /> Send now
              </button>
              <button
                type="button"
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 rounded px-2 py-1.5 text-[10px] font-medium",
                  scheduleMode === "later" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
                onClick={() => setScheduleMode("later")}
              >
                <CalendarClock className="h-3 w-3" /> Schedule
              </button>
            </div>

            {scheduleMode === "later" ? (
              <div>
                <Label htmlFor="wa-broadcast-when" className="text-xs">
                  Send at
                </Label>
                <Input
                  id="wa-broadcast-when"
                  type="datetime-local"
                  value={scheduleLocal}
                  onChange={(e) => setScheduleLocal(e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>
            ) : null}

            <Button
              type="button"
              size="sm"
              className="h-8 w-full gap-1 text-xs"
              disabled={submitting || selectedIds.size === 0}
              onClick={() => void onSubmit()}
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : scheduleMode === "now" ? <Send className="h-3.5 w-3.5" /> : <CalendarClock className="h-3.5 w-3.5" />}
              {scheduleMode === "now"
                ? `Send to ${selectedIds.size} group${selectedIds.size === 1 ? "" : "s"}`
                : `Schedule for ${selectedIds.size} group${selectedIds.size === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      </div>

      <div className="card-soft space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Recent broadcasts</h3>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-[10px]"
            disabled={loadingList}
            onClick={() => void refreshList()}
          >
            {loadingList ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Refresh"}
          </Button>
        </div>
        <div className="divide-y rounded-md border">
          {broadcasts.length === 0 ? (
            <p className="px-2.5 py-4 text-center text-[10px] text-muted-foreground">
              No broadcasts yet.
            </p>
          ) : (
            broadcasts.map((b) => (
              <div key={b.id} className="px-2.5 py-2">
                <button
                  type="button"
                  className="flex w-full items-start gap-2 text-left"
                  onClick={() => void openDetail(b.id)}
                >
                  {expandedId === b.id ? (
                    <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-medium">
                        {b.templateName || "Custom message"}
                      </span>
                      <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase", statusTone(b.status))}>
                        {b.status}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {b.accountCount} accounts · sent {b.sentCount}
                      {b.failedCount ? ` · failed ${b.failedCount}` : ""}
                      {b.skippedCount ? ` · skipped ${b.skippedCount}` : ""}
                      {" · "}
                      {b.status === "pending" ? `scheduled ${formatWhen(b.scheduledAt)}` : formatWhen(b.finishedAt || b.startedAt || b.createdAt)}
                      {b.createdByName ? ` · ${b.createdByName}` : ""}
                    </div>
                  </div>
                </button>
                {b.status === "pending" ? (
                  <div className="mt-1.5 flex flex-wrap gap-1 pl-5">
                    <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => void onRunNow(b.id)}>
                      Send now
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 text-[10px] text-destructive" onClick={() => void onCancel(b.id)}>
                      <X className="h-3 w-3" /> Cancel
                    </Button>
                  </div>
                ) : null}
                {expandedId === b.id ? (
                  <div className="mt-2 space-y-1 pl-5">
                    {loadingDetail ? (
                      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                      </p>
                    ) : (
                      deliveries.map((d) => (
                        <div
                          key={d.id}
                          className="flex flex-wrap items-center gap-1.5 rounded border bg-muted/20 px-2 py-1 text-[10px]"
                        >
                          <span className="font-medium text-foreground">{d.accountName}</span>
                          <span className={cn("rounded px-1 py-0.5 font-semibold uppercase", statusTone(d.status))}>
                            {d.status}
                          </span>
                          {d.errorMessage ? (
                            <span className="text-destructive">{d.errorMessage}</span>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
