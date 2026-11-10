import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AutomationTemplateFormatToolbar } from "@/components/automation/automation-template-format-toolbar";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteCrmWinbackTemplate,
  listCrmWinbackTemplates,
  upsertCrmWinbackTemplate,
} from "@/lib/api";
import {
  CRM_WINBACK_DEFAULT_MESSAGE,
  CRM_WINBACK_TEMPLATE_VARIABLES,
  type CrmWinbackTemplate,
} from "@/types/crm-winback";

type Draft = {
  id?: string;
  name: string;
  category: string;
  body: string;
  active: boolean;
  sortOrder: string;
};

const CATEGORIES = ["Win-back", "Renewal", "Re-engage", "General"];

function emptyDraft(order: number): Draft {
  return {
    name: "",
    category: "Win-back",
    body: CRM_WINBACK_DEFAULT_MESSAGE,
    active: true,
    sortOrder: String(order),
  };
}

export function CrmWinbackTemplatesPanel() {
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [templates, setTemplates] = useState<CrmWinbackTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(1));
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCrmWinbackTemplates({ data: { includeInactive: true } });
      setTemplates(res.templates);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q),
    );
  }, [templates, query]);

  function openCreate() {
    setDraft(emptyDraft(templates.length + 1));
    setEditorOpen(true);
  }

  function openEdit(t: CrmWinbackTemplate) {
    setDraft({
      id: t.id,
      name: t.name,
      category: t.category,
      body: t.body,
      active: t.active,
      sortOrder: String(t.sortOrder),
    });
    setEditorOpen(true);
  }

  function insertVariable(key: string) {
    const el = bodyRef.current;
    const token = `{{${key}}}`;
    const start = el?.selectionStart ?? draft.body.length;
    const end = el?.selectionEnd ?? draft.body.length;
    const next = draft.body.slice(0, start) + token + draft.body.slice(end);
    setDraft((d) => ({ ...d, body: next }));
    requestAnimationFrame(() => {
      el?.focus();
      const pos = start + token.length;
      el?.setSelectionRange(pos, pos);
    });
  }

  async function save() {
    if (!draft.name.trim() || !draft.body.trim()) {
      toast.error("Name and message are required");
      return;
    }
    setSaving(true);
    try {
      await upsertCrmWinbackTemplate({
        data: {
          id: draft.id,
          name: draft.name.trim(),
          category: draft.category.trim() || "General",
          body: draft.body.trim(),
          active: draft.active,
          sortOrder: Math.max(1, Number(draft.sortOrder) || 1),
        },
      });
      toast.success(draft.id ? "Template updated" : "Template created");
      setEditorOpen(false);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save template");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteCrmWinbackTemplate({ data: { id } });
      toast.success("Template deleted");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--wb-neutral-900)" }}>
            Templates
          </h2>
          <p className="crm-winback-muted text-[11px]">
            Create reusable Win-back messages with variables and WhatsApp formatting.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates…"
            className="h-8 w-44 text-xs"
          />
          <Button size="sm" className="crm-winback-btn-primary h-8 gap-1 text-xs" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            New template
          </Button>
        </div>
      </div>

      {loading && templates.length === 0 ? (
        <p className="crm-winback-muted px-1 py-10 text-center text-sm">Loading templates…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={templates.length === 0 ? "No templates yet" : "No matches"}
          description={
            templates.length === 0
              ? "Create your first Win-back template to reuse in campaigns."
              : "Try another search."
          }
          actionLabel={templates.length === 0 ? "New template" : undefined}
          onAction={templates.length === 0 ? openCreate : undefined}
        />
      ) : (
        <div className="crm-winback-table-shell divide-y divide-[color:var(--wb-neutral-200)]">
          {filtered.map((tpl) => (
            <div key={tpl.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold" style={{ color: "var(--wb-neutral-900)" }}>
                    {tpl.name}
                  </span>
                  <span className="crm-winback-pill" data-tone={tpl.active ? "success" : "neutral"}>
                    {tpl.active ? "Active" : "Inactive"}
                  </span>
                  <span className="crm-winback-pill" data-tone="primary">
                    {tpl.category}
                  </span>
                </div>
                <p className="crm-winback-muted mt-1.5 line-clamp-3 whitespace-pre-wrap text-[11px] leading-relaxed">
                  {tpl.body}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="crm-winback-btn-ghost h-8 gap-1 px-2.5 text-[11px]"
                  onClick={() => openEdit(tpl)}
                >
                  <Pencil className="h-3 w-3" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 px-2.5 text-[11px]"
                  style={{ borderColor: "var(--wb-error-200)", color: "var(--wb-error-700)" }}
                  onClick={() => void remove(tpl.id)}
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editorOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-center sm:p-6">
          <div className="crm-winback-modal flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl">
            <div className="border-b border-[color:var(--wb-primary-200)] px-5 py-4">
              <h3 className="crm-winback-title text-[1.05rem]">
                {draft.id ? "Edit template" : "New template"}
              </h3>
              <p className="crm-winback-subtitle mt-1">
                Variables and *bold* / _italic_ formatting work in WhatsApp sends.
              </p>
            </div>
            <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
              <label className="block space-y-1.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--wb-neutral-500)]">
                Name
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  className="h-10 text-sm font-normal normal-case tracking-normal"
                  placeholder="Closed renewal nudge"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--wb-neutral-500)]">
                  Category
                  <Input
                    value={draft.category}
                    onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                    list="wb-template-categories"
                    className="h-10 text-sm font-normal normal-case tracking-normal"
                  />
                  <datalist id="wb-template-categories">
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </label>
                <label className="block space-y-1.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--wb-neutral-500)]">
                  Sort order
                  <Input
                    type="number"
                    min={1}
                    value={draft.sortOrder}
                    onChange={(e) => setDraft((d) => ({ ...d, sortOrder: e.target.value }))}
                    className="h-10 text-sm font-normal normal-case tracking-normal"
                  />
                </label>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[color:var(--wb-neutral-200)] bg-[color:var(--wb-neutral-50)] px-3 py-2.5">
                <span className="text-xs font-medium" style={{ color: "var(--wb-neutral-700)" }}>
                  Active in campaign picker
                </span>
                <Switch
                  checked={draft.active}
                  onCheckedChange={(active) => setDraft((d) => ({ ...d, active }))}
                />
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--wb-neutral-500)]">
                    Message
                  </span>
                  <AutomationTemplateFormatToolbar
                    textareaRef={bodyRef}
                    value={draft.body}
                    onChange={(body) => setDraft((d) => ({ ...d, body }))}
                  />
                </div>
                <Textarea
                  ref={bodyRef}
                  value={draft.body}
                  onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                  className="min-h-[12rem] text-sm leading-relaxed"
                />
                <div className="flex flex-wrap gap-1.5">
                  {CRM_WINBACK_TEMPLATE_VARIABLES.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      className="rounded-full border border-[color:var(--wb-primary-200)] bg-[color:var(--wb-primary-50)] px-2.5 py-1 text-[10px] font-medium text-[color:var(--wb-primary-700)]"
                      onClick={() => insertVariable(v.key)}
                    >
                      {`{{${v.key}}}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[color:var(--wb-primary-200)] bg-[color:var(--wb-primary-50)] px-5 py-3.5">
              <Button
                size="sm"
                variant="outline"
                className="crm-winback-btn-ghost h-9 px-4 text-xs"
                onClick={() => setEditorOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="crm-winback-btn-primary h-9 gap-1.5 px-4 text-xs"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Save template
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
