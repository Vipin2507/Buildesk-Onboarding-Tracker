import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  FileIcon,
  Image as ImageIcon,
  Loader2,
  Mic,
  Paperclip,
  Search,
  Send,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { DatePickerField } from "@/components/date-picker-field";
import { DesignTicketSelect } from "@/components/design-ticket/design-ticket-fields";
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

type PendingMedia = {
  file: File;
  previewUrl: string | null;
  kind: "image" | "video" | "voice" | "file";
};

function inferMediaKind(file: File): PendingMedia["kind"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "voice";
  return "file";
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const b64 = result.includes(",") ? result.split(",")[1]! : result;
      if (!b64) reject(new Error("Could not read file"));
      else resolve(b64);
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
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
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    return () => {
      if (pendingMedia?.previewUrl) URL.revokeObjectURL(pendingMedia.previewUrl);
    };
  }, [pendingMedia?.previewUrl]);

  const templateOptions = useMemo(
    () =>
      templates.map((t) => ({
        value: t.id,
        label: t.category ? `${t.name} · ${t.category}` : t.name,
      })),
    [templates],
  );

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

  function clearPendingMedia() {
    if (pendingMedia?.previewUrl) URL.revokeObjectURL(pendingMedia.previewUrl);
    setPendingMedia(null);
    if (mediaInputRef.current) mediaInputRef.current.value = "";
  }

  function onMediaPicked(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) {
      toast.error("File must be 12 MB or smaller");
      return;
    }
    if (pendingMedia?.previewUrl) URL.revokeObjectURL(pendingMedia.previewUrl);
    const kind = inferMediaKind(file);
    const previewUrl =
      kind === "image" || kind === "video" ? URL.createObjectURL(file) : null;
    setPendingMedia({ file, kind, previewUrl });
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
    if (!messageBody && !pendingMedia) {
      toast.error("Add a message or attachment");
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
      let media:
        | { filename: string; mimetype: string; dataBase64: string }
        | null = null;
      if (pendingMedia) {
        media = {
          filename: pendingMedia.file.name,
          mimetype: pendingMedia.file.type || "application/octet-stream",
          dataBase64: await fileToBase64(pendingMedia.file),
        };
      }
      const created = await createCrmWhatsappBroadcast({
        data: {
          accountIds: [...selectedIds],
          templateId: mode === "template" ? templateId || null : null,
          body: messageBody || null,
          scheduledAt,
          sendNow,
          media,
        },
      });
      toast.success(
        sendNow
          ? `Sent to ${created.sentCount} of ${created.accountCount} groups`
          : `Scheduled for ${formatWhen(created.scheduledAt)}`,
      );
      clearPendingMedia();
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
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-foreground">Recipients</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                  {selectedIds.size}/{linkedAccounts.length}
                </span>
              </div>
              <div className="flex gap-2 text-[10px] font-medium">
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
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                placeholder="Search by account or group…"
                className="h-9 rounded-lg border-border/80 bg-background pl-8 text-xs shadow-none"
              />
            </div>
            <div className="max-h-52 overflow-y-auto rounded-xl border border-border/80 bg-background">
              {filteredAccounts.length === 0 ? (
                <p className="px-3 py-8 text-center text-[11px] text-muted-foreground">
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
                        "flex w-full items-start gap-2.5 border-b border-border/40 px-3 py-2.5 text-left last:border-0 transition-colors",
                        on ? "bg-primary/[0.07]" : "hover:bg-muted/40",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/30 bg-background",
                        )}
                      >
                        {on ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-medium leading-snug text-foreground">
                          {a.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] leading-snug text-muted-foreground">
                          {a.whatsappGroupName || "WhatsApp group linked"}
                          {a.city ? ` · ${a.city}` : ""}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Message source */}
          <div className="space-y-2">
            <div className="flex rounded-lg border border-border/80 bg-muted/25 p-0.5">
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
              <div>
                <div className="mb-1 text-[10px] font-medium text-muted-foreground">Template</div>
                <DesignTicketSelect
                  value={templateId}
                  onChange={(id) => {
                    setTemplateId(id);
                    const t = templates.find((x) => x.id === id);
                    if (t) setBody(t.body);
                  }}
                  options={templateOptions}
                  placeholder={templates.length ? "Choose a template…" : "No active templates"}
                  disabled={templates.length === 0}
                  compact
                  className="h-9 rounded-lg border-border/80 text-xs shadow-none"
                />
              </div>
            ) : null}

            <div className="overflow-hidden rounded-xl border border-border/80 bg-background">
              {pendingMedia ? (
                <div className="flex items-center gap-2.5 border-b border-border/50 bg-muted/20 px-3 py-2">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background">
                    {pendingMedia.kind === "image" && pendingMedia.previewUrl ? (
                      <img
                        src={pendingMedia.previewUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : pendingMedia.kind === "video" && pendingMedia.previewUrl ? (
                      <video
                        src={pendingMedia.previewUrl}
                        className="h-full w-full object-cover"
                        muted
                      />
                    ) : pendingMedia.kind === "video" ? (
                      <Video className="h-4 w-4 text-muted-foreground" />
                    ) : pendingMedia.kind === "voice" ? (
                      <Mic className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <FileIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-medium">{pendingMedia.file.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {(pendingMedia.file.size / 1024).toFixed(0)} KB · used as caption below
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={clearPendingMedia}
                    aria-label="Remove attachment"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}

              <Textarea
                value={mode === "template" ? selectedTemplate?.body || body : body}
                onChange={(e) => {
                  setMode("custom");
                  setBody(e.target.value);
                }}
                rows={6}
                className="min-h-[120px] resize-y rounded-none border-0 bg-transparent px-3 py-2.5 text-xs leading-relaxed shadow-none focus-visible:ring-0"
                placeholder={
                  pendingMedia
                    ? "Add an optional caption…"
                    : "Hi {{clientName}},…"
                }
                disabled={mode === "template"}
              />

              <div className="flex items-center justify-between gap-2 border-t border-border/50 bg-muted/15 px-2 py-1.5">
                <div className="flex items-center gap-0.5">
                  <input
                    ref={mediaInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
                    onChange={(e) => {
                      onMediaPicked(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                    onClick={() => mediaInputRef.current?.click()}
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    Attach
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      if (mediaInputRef.current) {
                        mediaInputRef.current.accept = "image/*";
                        mediaInputRef.current.click();
                        mediaInputRef.current.accept =
                          "image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip";
                      }
                    }}
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    Photo
                  </Button>
                </div>
                {mode === "template" ? (
                  <span className="text-[10px] text-muted-foreground">
                    Switch to Custom to edit
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">Up to 12 MB</span>
                )}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-xl border border-border/80 bg-muted/10 px-3 py-2.5">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Preview{previewAccount ? ` · ${previewAccount.name}` : ""}
              {pendingMedia ? " · + media" : ""}
            </div>
            <div className="max-h-24 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-foreground/90">
              {previewBody || (pendingMedia ? "(media only — no caption)" : "—")}
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
              disabled={submitting || selectedIds.size === 0 || (!messageBody && !pendingMedia)}
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
                        {b.templateName || (b.hasMedia && !b.body.trim() ? "Media" : "Custom message")}
                      </span>
                      {b.hasMedia ? (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                          {b.mediaKind || "file"}
                        </span>
                      ) : null}
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
