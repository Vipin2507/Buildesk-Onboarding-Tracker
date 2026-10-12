import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Search,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { DatePickerField } from "@/components/date-picker-field";
import { TimePickerField } from "@/components/time-picker-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { filterCrmAccountsForUser } from "@/lib/crm-account-access";
import { isCrmAccountEnded } from "@/lib/crm-account-status";
import { applyCrmWhatsappTemplate } from "@/lib/crm-whatsapp-templates";
import { cn } from "@/lib/utils";
import { format, isValid, parse } from "date-fns";
import {
  cancelCrmWhatsappBroadcast,
  createCrmWhatsappBroadcast,
  getCrmWhatsappBroadcast,
  listCrmWhatsappBroadcasts,
  runCrmWhatsappBroadcastNow,
} from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";
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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function todayYmd() {
  return format(new Date(), "yyyy-MM-dd");
}

function defaultScheduleParts() {
  const d = new Date(Date.now() + 60 * 60_000);
  // Snap to nearest 5 minutes like TimePickerField.
  const snapped = Math.ceil(d.getMinutes() / 5) * 5;
  if (snapped >= 60) {
    d.setHours(d.getHours() + 1, 0, 0, 0);
  } else {
    d.setMinutes(snapped, 0, 0);
  }
  return {
    date: format(d, "yyyy-MM-dd"),
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}

function schedulePartsToIso(dateYmd: string, timeHm: string): string | null {
  const date = parse(dateYmd.slice(0, 10), "yyyy-MM-dd", new Date());
  if (!isValid(date)) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(timeHm.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) return null;
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function formatScheduleSummary(dateYmd: string, timeHm: string) {
  const iso = schedulePartsToIso(dateYmd, timeHm);
  if (!iso) return null;
  return format(new Date(iso), "EEE, d MMM · h:mm a");
}

function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "d MMM yyyy · h:mm a");
  } catch {
    return iso;
  }
}

function StatusChip({ status }: { status: string }) {
  const tone =
    status === "completed" || status === "sent"
      ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
      : status === "pending"
        ? "bg-sky-500/12 text-sky-700 dark:text-sky-400"
        : status === "running"
          ? "bg-amber-500/12 text-amber-800 dark:text-amber-400"
          : status === "failed"
            ? "bg-destructive/12 text-destructive"
            : "bg-muted text-muted-foreground";
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide", tone)}>
      {status}
    </span>
  );
}

export function CrmWhatsappBroadcastPanel() {
  const user = useAuthStore((s) => s.user);
  const accounts = useCrmAccountStore((s) => s.accounts);
  const waha = useCrmAutomationStore((s) => s.waha);
  const whatsappTemplates = useCrmMasterStore((s) => s.whatsappTemplates);
  const templates = useMemo(() => listActiveCrmWhatsappTemplates(), [whatsappTemplates]);

  const linkedAccounts = useMemo(() => {
    return filterCrmAccountsForUser(accounts, user)
      .filter((a) => !isCrmAccountEnded(a.status) && hasGroup(a))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [accounts, user]);

  const [accountSearch, setAccountSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [mode, setMode] = useState<"template" | "custom">("template");
  const [templateId, setTemplateId] = useState("");
  const [body, setBody] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduleDate, setScheduleDate] = useState(() => defaultScheduleParts().date);
  const [scheduleTime, setScheduleTime] = useState(() => defaultScheduleParts().time);
  const [submitting, setSubmitting] = useState(false);
  const [broadcasts, setBroadcasts] = useState<CrmWhatsappBroadcast[]>([]);
  const [listIsAdmin, setListIsAdmin] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [historyTab, setHistoryTab] = useState<"scheduled" | "recent">("scheduled");
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
  const messageBody = (mode === "template" ? selectedTemplate?.body || body : body).trim();
  const previewAccount = linkedAccounts.find((a) => selectedIds.has(a.id)) ?? linkedAccounts[0];
  const previewBody = applyCrmWhatsappTemplate(messageBody, previewAccount);

  const scheduled = useMemo(
    () => broadcasts.filter((b) => b.status === "pending" || b.status === "running"),
    [broadcasts],
  );
  const recent = useMemo(
    () => broadcasts.filter((b) => b.status !== "pending" && b.status !== "running"),
    [broadcasts],
  );
  const historyRows = historyTab === "scheduled" ? scheduled : recent;

  const refreshList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await listCrmWhatsappBroadcasts({ data: { limit: 50 } });
      setBroadcasts(res.broadcasts);
      setListIsAdmin(res.isAdmin);
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
    const id = window.setInterval(() => void refreshList(), 10_000);
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
      toast.error("WhatsApp is not connected. Ask an admin to enable WAHA.");
      return;
    }
    if (selectedIds.size === 0) {
      toast.error("Select at least one account");
      return;
    }
    if (!messageBody) {
      toast.error("Message is empty");
      return;
    }

    let scheduledAt: string | null = null;
    const sendNow = scheduleMode === "now";
    if (!sendNow) {
      scheduledAt = schedulePartsToIso(scheduleDate, scheduleTime);
      if (!scheduledAt) {
        toast.error("Pick a valid date and time");
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
          ? `Sent to ${created.sentCount} of ${created.accountCount} groups`
          : `Scheduled for ${formatWhen(created.scheduledAt)}`,
      );
      setHistoryTab(sendNow ? "recent" : "scheduled");
      await refreshList();
      setExpandedId(created.id);
      const detail = await getCrmWhatsappBroadcast({ data: { id: created.id } });
      setDeliveries(detail.deliveries);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Broadcast failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function onCancel(id: string) {
    try {
      await cancelCrmWhatsappBroadcast({ data: { id } });
      toast.success("Cancelled");
      await refreshList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cancel failed");
    }
  }

  async function onRunNow(id: string) {
    try {
      const res = await runCrmWhatsappBroadcastNow({ data: { id } });
      toast.success(`Sent ${res.sent} message${res.sent === 1 ? "" : "s"}`);
      setHistoryTab("recent");
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
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      {/* Compose */}
      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight">Compose</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Message WhatsApp groups linked to your accounts. Use {"{{clientName}}"} and other
            variables for personalization.
          </p>
        </div>

        <div className="space-y-4 p-4">
          {/* Recipients */}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-foreground">
                Recipients
                <span className="ml-1.5 tabular-nums text-muted-foreground">
                  {selectedIds.size} selected
                </span>
              </span>
              <div className="flex gap-2 text-[10px]">
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() =>
                    setSelectedIds(new Set(filteredAccounts.map((a) => a.id)))
                  }
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground hover:underline"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="relative mb-1.5">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                placeholder="Search accounts…"
                className="h-8 pl-8 text-xs"
              />
            </div>
            <div className="max-h-44 overflow-y-auto rounded-lg border bg-muted/20">
              {filteredAccounts.length === 0 ? (
                <p className="px-3 py-6 text-center text-[11px] text-muted-foreground">
                  No linked WhatsApp groups in your accounts.
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
                        "flex w-full items-center gap-2.5 border-b border-border/50 px-3 py-2 text-left last:border-0 transition-colors",
                        on ? "bg-primary/[0.06]" : "hover:bg-muted/50",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/35",
                        )}
                      >
                        {on ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-medium">{a.name}</span>
                      <span className="max-w-[38%] truncate text-[10px] text-muted-foreground">
                        {a.whatsappGroupName || "Group linked"}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Message source */}
          <div>
            <div className="mb-1.5 flex rounded-lg border bg-muted/30 p-0.5">
              {(
                [
                  ["template", "Template"],
                  ["custom", "Custom"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={cn(
                    "flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors",
                    mode === id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => {
                    setMode(id);
                    if (id === "template" && selectedTemplate) setBody(selectedTemplate.body);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "template" ? (
              <select
                className="mb-2 h-8 w-full rounded-md border bg-background px-2 text-xs"
                value={templateId}
                onChange={(e) => {
                  const id = e.target.value;
                  setTemplateId(id);
                  const t = templates.find((x) => x.id === id);
                  if (t) setBody(t.body);
                }}
              >
                {templates.length === 0 ? (
                  <option value="">No active templates</option>
                ) : (
                  templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))
                )}
              </select>
            ) : null}

            <Textarea
              value={mode === "template" ? selectedTemplate?.body || body : body}
              onChange={(e) => {
                setMode("custom");
                setBody(e.target.value);
              }}
              rows={7}
              className="resize-y text-xs leading-relaxed"
              placeholder="Hi {{clientName}},…"
              disabled={mode === "template"}
            />
            {mode === "template" ? (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Templates are managed in Master. Switch to Custom to edit this send only.
              </p>
            ) : null}
          </div>

          {/* Preview */}
          <div className="rounded-lg border bg-muted/15 px-3 py-2.5">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Preview{previewAccount ? ` · ${previewAccount.name}` : ""}
            </div>
            <div className="max-h-24 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-foreground/90">
              {previewBody || "—"}
            </div>
          </div>

          {/* When + send */}
          <div className="space-y-2.5">
            <div className="flex rounded-lg border bg-muted/30 p-0.5">
              <button
                type="button"
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors",
                  scheduleMode === "now"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setScheduleMode("now")}
              >
                <Send className="h-3 w-3" /> Send now
              </button>
              <button
                type="button"
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors",
                  scheduleMode === "later"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => {
                  setScheduleMode("later");
                  const next = defaultScheduleParts();
                  setScheduleDate(next.date);
                  setScheduleTime(next.time);
                }}
              >
                <CalendarClock className="h-3 w-3" /> Schedule
              </button>
            </div>

            {scheduleMode === "later" ? (
              <div className="space-y-2 rounded-lg border bg-muted/10 p-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="mb-1 text-[10px] font-medium text-muted-foreground">Date</div>
                    <DatePickerField
                      value={scheduleDate}
                      onChange={setScheduleDate}
                      min={todayYmd()}
                      yearsBack={0}
                      yearsForward={1}
                      compact
                      placeholder="Pick date"
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-[10px] font-medium text-muted-foreground">Time</div>
                    <TimePickerField
                      value={scheduleTime}
                      onChange={setScheduleTime}
                      min={scheduleDate === todayYmd() ? format(new Date(), "HH:mm") : undefined}
                      compact
                      placeholder="Pick time"
                    />
                  </div>
                </div>
                {formatScheduleSummary(scheduleDate, scheduleTime) ? (
                  <p className="text-[11px] text-muted-foreground">
                    Sends{" "}
                    <span className="font-medium text-foreground">
                      {formatScheduleSummary(scheduleDate, scheduleTime)}
                    </span>
                  </p>
                ) : null}
              </div>
            ) : null}

            <Button
              type="button"
              className="h-9 w-full gap-1.5 text-xs"
              disabled={submitting || selectedIds.size === 0 || !messageBody}
              onClick={() => void onSubmit()}
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : scheduleMode === "now" ? (
                <Send className="h-3.5 w-3.5" />
              ) : (
                <CalendarClock className="h-3.5 w-3.5" />
              )}
              {scheduleMode === "now" ? "Send now" : "Schedule broadcast"}
            </Button>
          </div>

          {!waha.isEnabled ? (
            <p className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-[10px] text-amber-900 dark:text-amber-200">
              WhatsApp delivery is offline. An admin must enable WAHA before messages can send.
            </p>
          ) : null}
        </div>
      </section>

      {/* Activity */}
      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex items-start justify-between gap-2 border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Activity</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {listIsAdmin
                ? "All team schedules and deliveries"
                : "Your sends and scheduled messages"}
            </p>
          </div>
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

        <div className="flex gap-1 border-b px-3 pt-2">
          {(
            [
              ["scheduled", `Scheduled (${scheduled.length})`],
              ["recent", `Recent (${recent.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={cn(
                "relative px-2.5 pb-2 text-[11px] font-medium transition-colors",
                historyTab === id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setHistoryTab(id)}
            >
              {label}
              {historyTab === id ? (
                <span className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-primary" />
              ) : null}
            </button>
          ))}
        </div>

        <div className="max-h-[min(520px,60vh)] overflow-y-auto">
          {historyRows.length === 0 ? (
            <p className="px-4 py-10 text-center text-[11px] text-muted-foreground">
              {historyTab === "scheduled" ? "Nothing scheduled." : "No recent broadcasts yet."}
            </p>
          ) : (
            historyRows.map((b) => (
              <div key={b.id} className="border-b border-border/60 last:border-0">
                <button
                  type="button"
                  className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-muted/40"
                  onClick={() => void openDetail(b.id)}
                >
                  {expandedId === b.id ? (
                    <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-xs font-medium">
                        {b.templateName || "Custom message"}
                      </span>
                      <StatusChip status={b.status} />
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {b.accountCount} groups
                      {b.status === "pending" || b.status === "running"
                        ? ` · ${formatWhen(b.scheduledAt)}`
                        : ` · sent ${b.sentCount}${b.failedCount ? ` · failed ${b.failedCount}` : ""}`}
                      {listIsAdmin && b.createdByName ? ` · ${b.createdByName}` : ""}
                    </p>
                  </div>
                </button>

                {b.status === "pending" ? (
                  <div className="flex gap-1.5 px-3 pb-2.5 pl-9">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px]"
                      onClick={() => void onRunNow(b.id)}
                    >
                      Send now
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 text-[10px] text-destructive"
                      onClick={() => void onCancel(b.id)}
                    >
                      <X className="h-3 w-3" /> Cancel
                    </Button>
                  </div>
                ) : null}

                {expandedId === b.id ? (
                  <div className="space-y-1 bg-muted/20 px-3 py-2 pl-9">
                    {loadingDetail ? (
                      <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                      </p>
                    ) : (
                      deliveries.map((d) => (
                        <div
                          key={d.id}
                          className="flex flex-wrap items-center gap-1.5 rounded-md border bg-background/80 px-2 py-1 text-[10px]"
                        >
                          <span className="font-medium">{d.accountName}</span>
                          <StatusChip status={d.status} />
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
      </section>
    </div>
  );
}
