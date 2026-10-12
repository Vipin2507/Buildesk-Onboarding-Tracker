import { useMemo, useRef, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AutomationTemplateFormatToolbar } from "@/components/automation/automation-template-format-toolbar";
import { ConfirmDeleteDialog, EntityFormModal } from "@/components/entity-form-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { flushCrmMasterConfigPersistence } from "@/lib/config-persistence";
import {
  CRM_WHATSAPP_TEMPLATE_VARIABLES,
  listCrmWhatsappTemplateVarsInBody,
} from "@/lib/crm-whatsapp-templates";
import {
  getCrmMasterWhatsappTemplates,
  useCrmMasterStore,
} from "@/stores/useCrmMasterStore";
import type { CrmWhatsappTemplateDef } from "@/types/crm-master";

type Draft = {
  id: string;
  name: string;
  category: string;
  body: string;
  active: boolean;
  order: string;
};

function emptyDraft(order: number): Draft {
  return {
    id: "",
    name: "",
    category: "Check-in",
    body: "Hi {{clientName}},\n\n",
    active: true,
    order: String(order),
  };
}

function templateToDraft(t: CrmWhatsappTemplateDef): Draft {
  return {
    id: t.id,
    name: t.name,
    category: t.category,
    body: t.body,
    active: t.active,
    order: String(t.order),
  };
}

function slugifyId(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function draftToTemplate(
  draft: Draft,
  existing: CrmWhatsappTemplateDef[],
): CrmWhatsappTemplateDef | null {
  const name = draft.name.trim();
  const body = draft.body.trim();
  if (!name) {
    toast.error("Name is required");
    return null;
  }
  if (!body) {
    toast.error("Template body is required");
    return null;
  }
  const id =
    draft.id.trim() ||
    `wa-tpl-${slugifyId(name) || "custom"}-${existing.length + 1}`;
  return {
    id,
    name,
    category: draft.category.trim() || "General",
    body,
    active: draft.active,
    order: Math.max(1, Number(draft.order) || existing.length + 1),
  };
}

const CATEGORY_SUGGESTIONS = [
  "Check-in",
  "Onboarding",
  "Training",
  "Renewal",
  "Support",
  "General",
];

export function CrmMasterWhatsappTemplatesPanel() {
  const whatsappTemplates = useCrmMasterStore((s) => s.whatsappTemplates);
  const setWhatsappTemplates = useCrmMasterStore((s) => s.setWhatsappTemplates);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const templates = useMemo(
    () => getCrmMasterWhatsappTemplates(),
    [whatsappTemplates],
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(1));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setDraft(emptyDraft(templates.length + 1));
    setModalOpen(true);
  }

  function openEdit(t: CrmWhatsappTemplateDef) {
    setEditingId(t.id);
    setDraft(templateToDraft(t));
    setModalOpen(true);
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

  function saveDraft() {
    const nextTemplate = draftToTemplate(draft, templates);
    if (!nextTemplate) return;

    let next: CrmWhatsappTemplateDef[];
    if (editingId) {
      next = templates.map((t) => (t.id === editingId ? nextTemplate : t));
    } else {
      if (templates.some((t) => t.id === nextTemplate.id)) {
        toast.error("A template with this id already exists");
        return;
      }
      next = [...templates, nextTemplate];
    }

    setWhatsappTemplates(next);
    flushCrmMasterConfigPersistence();
    toast.success(editingId ? "Template updated" : "Template added");
    setModalOpen(false);
  }

  function confirmDelete() {
    if (!deleteId) return;
    setWhatsappTemplates(templates.filter((t) => t.id !== deleteId));
    flushCrmMasterConfigPersistence();
    toast.success("Template removed");
    setDeleteId(null);
  }

  const usedVars = listCrmWhatsappTemplateVarsInBody(draft.body);

  return (
    <div className="space-y-3">
      <div className="card-soft space-y-3 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">WhatsApp templates</h3>
            <p className="text-[10px] text-muted-foreground">
              Templates for the account WhatsApp chat composer. Use *bold*, _italic_, and{" "}
              {"{{variables}}"} — they fill from the account when staff pick “Use template”.
            </p>
          </div>
          <Button type="button" size="sm" className="h-8 gap-1 text-xs" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            Add template
          </Button>
        </div>

        <div className="divide-y rounded-md border">
          {templates.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-2 px-2.5 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-medium text-foreground">{t.name}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                    {t.category}
                  </span>
                  {!t.active ? (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-700 dark:text-amber-400">
                      Hidden
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-[10px] text-muted-foreground">
                  {t.body}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground"
                aria-label={`Edit ${t.name}`}
                onClick={() => openEdit(t)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                aria-label={`Delete ${t.name}`}
                onClick={() => setDeleteId(t.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {templates.length === 0 ? (
            <p className="py-3 text-center text-[10px] text-muted-foreground">
              No templates. Add one, or reset Master to restore defaults.
            </p>
          ) : null}
        </div>
      </div>

      <EntityFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingId ? "Edit WhatsApp template" : "Add WhatsApp template"}
        submitLabel={editingId ? "Save changes" : "Add template"}
        onSubmit={saveDraft}
        contentClassName="max-w-lg"
      >
        <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
          <div>
            <Label htmlFor="wa-tpl-name">Name</Label>
            <Input
              id="wa-tpl-name"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              className="mt-1 h-8 text-xs"
              placeholder="CRM & Usage check-in"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="wa-tpl-category">Category</Label>
              <input
                id="wa-tpl-category"
                list="wa-tpl-category-options"
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-xs"
              />
              <datalist id="wa-tpl-category-options">
                {CATEGORY_SUGGESTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <Label htmlFor="wa-tpl-order">Order</Label>
              <Input
                id="wa-tpl-order"
                value={draft.order}
                onChange={(e) => setDraft((d) => ({ ...d, order: e.target.value }))}
                className="mt-1 h-8 text-xs"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-2">
            <div>
              <div className="text-xs font-medium">Active in chat</div>
              <p className="text-[10px] text-muted-foreground">
                Inactive templates stay in Master but are hidden from “Use template”.
              </p>
            </div>
            <Switch
              checked={draft.active}
              onCheckedChange={(active) => setDraft((d) => ({ ...d, active }))}
            />
          </div>
          <div>
            <Label htmlFor="wa-tpl-body">Body</Label>
            <div className="mt-1 space-y-1.5">
              <AutomationTemplateFormatToolbar
                textareaRef={bodyRef}
                value={draft.body}
                onChange={(value) => setDraft((d) => ({ ...d, body: value }))}
              />
              <Textarea
                id="wa-tpl-body"
                ref={bodyRef}
                value={draft.body}
                onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                rows={10}
                className="text-xs"
                placeholder={"Hi {{clientName}},\n\n…"}
              />
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium text-muted-foreground">Insert variable</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {CRM_WHATSAPP_TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  className="rounded border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-foreground hover:bg-muted"
                  title={v.label}
                  onClick={() => insertVariable(v.key)}
                >
                  {`{{${v.key}}}`}
                </button>
              ))}
            </div>
            {usedVars.length ? (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Used: {usedVars.map((k) => `{{${k}}}`).join(", ")}
              </p>
            ) : null}
          </div>
        </div>
      </EntityFormModal>

      <ConfirmDeleteDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Delete WhatsApp template?"
        description="This removes the template from Master. Account chats will no longer list it."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
