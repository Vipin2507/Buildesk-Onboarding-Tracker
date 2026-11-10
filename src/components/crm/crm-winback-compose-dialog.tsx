import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileIcon,
  ImageIcon,
  Loader2,
  Mic,
  Paperclip,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AutomationTemplateFormatToolbar } from "@/components/automation/automation-template-format-toolbar";
import {
  DesignTicketFilterField,
  DesignTicketSelect,
} from "@/components/design-ticket/design-ticket-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createCrmWinbackCampaign,
  listCrmWinbackTemplates,
} from "@/lib/api";
import { CRM_WINBACK_WAVE_LIMIT } from "@/lib/crm-winback-limits";
import {
  CRM_WINBACK_DEFAULT_MESSAGE,
  CRM_WINBACK_TEMPLATE_VARIABLES,
  type CrmWinbackTemplate,
} from "@/types/crm-winback";

type PendingMedia = {
  file: File;
  kind: "image" | "video" | "voice" | "file";
  previewUrl?: string;
  dataBase64: string;
};

function inferKind(mime: string): PendingMedia["kind"] {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "voice";
  return "file";
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1]! : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export function CrmWinbackComposeDialog({
  open,
  eligibleCount,
  contactIds,
  onClose,
  onCreated,
}: {
  open: boolean;
  eligibleCount: number;
  contactIds: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useState<CrmWinbackTemplate[]>([]);
  const [templateId, setTemplateId] = useState("custom");
  const [campaignName, setCampaignName] = useState("");
  const [body, setBody] = useState(CRM_WINBACK_DEFAULT_MESSAGE);
  const [sendNow, setSendNow] = useState(true);
  const [scheduleLocal, setScheduleLocal] = useState("");
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    void listCrmWinbackTemplates({ data: {} })
      .then((res) => setTemplates(res.templates))
      .catch(() => setTemplates([]));
  }, [open]);

  useEffect(() => {
    return () => {
      if (pendingMedia?.previewUrl) URL.revokeObjectURL(pendingMedia.previewUrl);
    };
  }, [pendingMedia]);

  const templateOptions = useMemo(
    () => [
      { value: "custom", label: "Custom message" },
      ...templates.map((t) => ({ value: t.id, label: `${t.name} · ${t.category}` })),
    ],
    [templates],
  );

  function clearPendingMedia() {
    setPendingMedia((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }

  async function onMediaPicked(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Media must be 25 MB or less");
      return;
    }
    try {
      const dataBase64 = await fileToBase64(file);
      const kind = inferKind(file.type || "");
      const previewUrl =
        kind === "image" || kind === "video" ? URL.createObjectURL(file) : undefined;
      clearPendingMedia();
      setPendingMedia({ file, kind, previewUrl, dataBase64 });
    } catch {
      toast.error("Could not attach media");
    }
  }

  function insertVariable(key: string) {
    const el = bodyRef.current;
    const token = `{{${key}}}`;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    setTemplateId("custom");
    requestAnimationFrame(() => {
      el?.focus();
      const pos = start + token.length;
      el?.setSelectionRange(pos, pos);
    });
  }

  async function submit() {
    if (contactIds.length === 0) {
      toast.error("Select at least one contact");
      return;
    }
    if (!campaignName.trim()) {
      toast.error("Campaign name is required");
      return;
    }
    if (!body.trim() && !pendingMedia) {
      toast.error("Add a message or attach media");
      return;
    }
    setSubmitting(true);
    try {
      const scheduledAt =
        !sendNow && scheduleLocal ? new Date(scheduleLocal).toISOString() : undefined;
      await createCrmWinbackCampaign({
        data: {
          name: campaignName.trim(),
          body: body.trim(),
          contactIds,
          sendNow,
          scheduledAt,
          waveSize: CRM_WINBACK_WAVE_LIMIT,
          media: pendingMedia
            ? {
                filename: pendingMedia.file.name,
                mimetype: pendingMedia.file.type || "application/octet-stream",
                dataBase64: pendingMedia.dataBase64,
              }
            : undefined,
        },
      });
      toast.success(sendNow ? "Campaign started" : "Campaign scheduled");
      onCreated();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create campaign");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-center sm:p-6">
      <div className="crm-winback-modal flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[color:var(--wb-primary-200)] px-5 py-4">
          <div>
            <h3 className="crm-winback-title text-[1.05rem]">New Win-back campaign</h3>
            <p className="crm-winback-subtitle mt-1">
              {eligibleCount} recipients · WhatsApp · waves of {CRM_WINBACK_WAVE_LIMIT}
              {pendingMedia ? " · + media" : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="crm-winback-muted rounded-md p-1 hover:bg-[color:var(--wb-primary-100)]" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <label className="block space-y-1.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--wb-neutral-500)]">
            Campaign name
            <Input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              className="h-10 text-sm font-normal normal-case tracking-normal"
              placeholder="Mar 2026 closed renewals"
            />
          </label>

          <DesignTicketFilterField label="Template" compact>
            <DesignTicketSelect
              compact
              value={templateId}
              onChange={(id) => {
                setTemplateId(id);
                if (id === "custom") return;
                const tpl = templates.find((t) => t.id === id);
                if (tpl) setBody(tpl.body);
              }}
              options={templateOptions}
            />
          </DesignTicketFilterField>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--wb-neutral-500)]">
                Message
              </span>
              <AutomationTemplateFormatToolbar
                textareaRef={bodyRef}
                value={body}
                onChange={(next) => {
                  setBody(next);
                  setTemplateId("custom");
                }}
              />
            </div>

            <div className="overflow-hidden rounded-xl border border-[color:var(--wb-neutral-200)] bg-white shadow-sm dark:bg-[color:var(--wb-neutral-50)]">
              {pendingMedia ? (
                <div className="flex items-center gap-2.5 border-b border-[color:var(--wb-neutral-200)] bg-[color:var(--wb-primary-50)] px-3 py-2.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white">
                    {pendingMedia.kind === "image" && pendingMedia.previewUrl ? (
                      <img src={pendingMedia.previewUrl} alt="" className="h-full w-full object-cover" />
                    ) : pendingMedia.kind === "video" && pendingMedia.previewUrl ? (
                      <video src={pendingMedia.previewUrl} className="h-full w-full object-cover" muted />
                    ) : pendingMedia.kind === "video" ? (
                      <Video className="h-4 w-4 text-[color:var(--wb-neutral-500)]" />
                    ) : pendingMedia.kind === "voice" ? (
                      <Mic className="h-4 w-4 text-[color:var(--wb-neutral-500)]" />
                    ) : (
                      <FileIcon className="h-4 w-4 text-[color:var(--wb-neutral-500)]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{pendingMedia.file.name}</div>
                    <div className="crm-winback-muted text-[10px]">
                      {(pendingMedia.file.size / 1024).toFixed(0)} KB · used as caption below
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-full p-1 text-[color:var(--wb-neutral-500)] hover:bg-white"
                    onClick={clearPendingMedia}
                    aria-label="Remove attachment"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}

              <Textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  setTemplateId("custom");
                }}
                className="min-h-[11rem] resize-y rounded-none border-0 bg-transparent px-3.5 py-3 text-sm leading-relaxed shadow-none focus-visible:ring-0"
                placeholder={
                  pendingMedia
                    ? "Add an optional caption…"
                    : "Hi {{contactPerson}},…"
                }
              />

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--wb-neutral-200)] bg-[color:var(--wb-neutral-50)] px-2.5 py-2">
                <div className="flex items-center gap-0.5">
                  <input
                    ref={mediaInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
                    onChange={(e) => {
                      void onMediaPicked(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1 px-2 text-[11px]"
                    onClick={() => mediaInputRef.current?.click()}
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    Attach
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1 px-2 text-[11px]"
                    onClick={() => {
                      if (!mediaInputRef.current) return;
                      mediaInputRef.current.accept = "image/*";
                      mediaInputRef.current.click();
                      mediaInputRef.current.accept =
                        "image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip";
                    }}
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    Photo
                  </Button>
                </div>
                <span className="crm-winback-muted text-[10px]">Up to 25 MB · *bold* _italic_</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {CRM_WINBACK_TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  className="rounded-full border border-[color:var(--wb-primary-200)] bg-[color:var(--wb-primary-50)] px-2.5 py-1 text-[10px] font-medium text-[color:var(--wb-primary-700)] hover:bg-[color:var(--wb-primary-100)]"
                  onClick={() => insertVariable(v.key)}
                >
                  {`{{${v.key}}}`}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[color:var(--wb-neutral-200)] bg-[color:var(--wb-neutral-50)] p-3">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--wb-neutral-500)]">
              Schedule
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sendNow}
                  onChange={(e) => setSendNow(e.target.checked)}
                  className="accent-[color:var(--wb-primary-600)]"
                />
                Send first wave now
              </label>
              {!sendNow ? (
                <Input
                  type="datetime-local"
                  value={scheduleLocal}
                  onChange={(e) => setScheduleLocal(e.target.value)}
                  className="h-9 w-auto text-xs"
                />
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[color:var(--wb-primary-200)] bg-[color:var(--wb-primary-50)] px-5 py-3.5">
          <Button
            size="sm"
            variant="outline"
            className="crm-winback-btn-ghost h-9 px-4 text-xs"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="crm-winback-btn-primary h-9 gap-1.5 px-4 text-xs"
            disabled={submitting}
            onClick={() => void submit()}
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {sendNow ? "Start campaign" : "Schedule campaign"}
          </Button>
        </div>
      </div>
    </div>
  );
}
