import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  Boxes,
  Database,
  ListChecks,
  Pencil,
  Plus,
  ShieldAlert,
  Table2,
  Trash2,
  Layers,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import { CrmMasterDataControl } from "@/components/crm/crm-master-data-control";
import {
  DesignTicketPageHeader,
  TICKET_EASE,
} from "@/components/design-ticket/design-ticket-shared";
import { ConfirmDeleteDialog, EntityFormModal } from "@/components/entity-form-modal";
import { PageWrap } from "@/components/page-header";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAuthStore, useCrmMasterStore } from "@/stores";
import type { CrmMasterFieldDef, CrmMasterPicklist } from "@/types/crm-master";
import type { FieldValueType } from "@/types/master";

export const Route = createFileRoute("/crm/master")({
  component: CrmMasterPage,
});

const SECTIONS = [
  { id: "overview", label: "Overview", icon: Database },
  { id: "account-fields", label: "Account Fields", icon: Building2 },
  { id: "project-fields", label: "Project Fields", icon: Boxes },
  { id: "picklists", label: "Picklists", icon: ListChecks },
  { id: "modules", label: "Modules", icon: Layers },
  { id: "data-control", label: "Data Control", icon: Table2 },
  { id: "danger", label: "Reset & Safety", icon: ShieldAlert },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const FIELD_TYPES: FieldValueType[] = [
  "text",
  "email",
  "phone",
  "number",
  "date",
  "textarea",
  "select",
  "boolean",
];

function CrmMasterPage() {
  const user = useAuthStore((s) => s.user);
  const [section, setSection] = useState<SectionId>("overview");

  if (user?.role !== "Admin") {
    return (
      <PageWrap compact>
        <DesignTicketPageHeader
          compact
          title="CRM Master Config"
          subtitle="Central control plane for CRM masters and account data."
        />
        <div className="card-soft mx-auto max-w-lg p-5 text-center">
          <ShieldAlert className="mx-auto mb-2 h-8 w-8 text-destructive" />
          <h3 className="text-sm font-semibold">Admin access required</h3>
          <p className="mt-1.5 text-xs text-muted-foreground">
            CRM Master Config controls field catalogs, picklists, modules, and Data Control.
            Only Admins can view or change it.
          </p>
          <Button asChild size="sm" className="mt-3 h-7 text-xs" variant="outline">
            <Link to="/crm">Back to CRM Dashboard</Link>
          </Button>
        </div>
      </PageWrap>
    );
  }

  return (
    <PageWrap compact>
      <DesignTicketPageHeader
        compact
        title="CRM Master Config"
        subtitle="Fields, picklists, modules, and Data Control for CRM accounts — parallel to ERP Master."
      />

      <div className="grid gap-3 lg:grid-cols-[200px_1fr]">
        <aside className="card-soft flex h-fit max-w-full gap-0.5 overflow-x-auto p-1.5 lg:sticky lg:top-16 lg:block lg:max-h-[calc(100vh-5rem)] lg:space-y-0.5 lg:overflow-y-auto">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                className={cn(
                  "flex min-h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors lg:w-full",
                  section === s.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">{s.label}</span>
              </button>
            );
          })}
        </aside>

        <AnimatePresence mode="wait">
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: TICKET_EASE }}
            className="min-w-0"
          >
            {section === "overview" ? <OverviewPanel onNavigate={setSection} /> : null}
            {section === "account-fields" ? <FieldsPanel entity="account" /> : null}
            {section === "project-fields" ? <FieldsPanel entity="project" /> : null}
            {section === "picklists" ? <PicklistsPanel /> : null}
            {section === "modules" ? <ModulesPanel /> : null}
            {section === "data-control" ? <CrmMasterDataControl /> : null}
            {section === "danger" ? <DangerPanel /> : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </PageWrap>
  );
}

function OverviewPanel({ onNavigate }: { onNavigate: (id: SectionId) => void }) {
  const platform = useCrmMasterStore((s) => s.platform);
  const accountFields = useCrmMasterStore((s) => s.accountFields);
  const projectFields = useCrmMasterStore((s) => s.projectFields);
  const picklists = useCrmMasterStore((s) => s.picklists);
  const modules = useCrmMasterStore((s) => s.modules);

  const cards = [
    {
      label: "Account Fields",
      value: accountFields.filter((f) => f.enabled).length,
      total: accountFields.length,
      to: "account-fields" as const,
    },
    {
      label: "Project Fields",
      value: projectFields.filter((f) => f.enabled).length,
      total: projectFields.length,
      to: "project-fields" as const,
    },
    {
      label: "Picklists",
      value: picklists.length,
      total: picklists.reduce((n, p) => n + p.values.length, 0),
      to: "picklists" as const,
      suffix: "values",
    },
    {
      label: "Modules",
      value: modules.filter((m) => m.enabled).length,
      total: modules.length,
      to: "modules" as const,
    },
    {
      label: "Data Control",
      value: "Edit",
      total: "CRM accounts",
      to: "data-control" as const,
    },
  ];

  return (
    <div className="space-y-2.5">
      <div className="card-soft p-3">
        <h3 className="text-sm font-semibold">{platform.productName}</h3>
        <p className="text-xs text-muted-foreground">{platform.productTagline}</p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
          <Pill tone="accent">{platform.defaultTimezone}</Pill>
          <Pill>{platform.defaultCurrency}</Pill>
          <Pill>{platform.supportEmail}</Pill>
        </div>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => onNavigate(c.to)}
            className="card-soft p-2.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="text-[10px] text-muted-foreground">{c.label}</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums">{c.value}</div>
            <div className="text-[10px] text-muted-foreground">
              {typeof c.total === "number"
                ? `of ${c.total} ${c.suffix || "defined"} · click to manage`
                : `${c.total} · click to manage`}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function FieldsPanel({ entity }: { entity: "account" | "project" }) {
  const fields = useCrmMasterStore((s) =>
    entity === "account" ? s.accountFields : s.projectFields,
  );
  const addField = useCrmMasterStore((s) =>
    entity === "account" ? s.addAccountField : s.addProjectField,
  );
  const updateField = useCrmMasterStore((s) =>
    entity === "account" ? s.updateAccountField : s.updateProjectField,
  );
  const deleteField = useCrmMasterStore((s) =>
    entity === "account" ? s.deleteAccountField : s.deleteProjectField,
  );

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CrmMasterFieldDef | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    key: "",
    label: "",
    type: "text" as FieldValueType,
    group: "Basics",
    required: false,
    enabled: true,
    options: "",
  });

  function openCreate() {
    setEditing(null);
    setForm({
      key: "",
      label: "",
      type: "text",
      group: "Basics",
      required: false,
      enabled: true,
      options: "",
    });
    setOpen(true);
  }

  function openEdit(f: CrmMasterFieldDef) {
    setEditing(f);
    setForm({
      key: f.key,
      label: f.label,
      type: f.type,
      group: f.group,
      required: f.required,
      enabled: f.enabled,
      options: (f.options ?? []).join(", "),
    });
    setOpen(true);
  }

  function save() {
    if (form.label.trim().length < 2 || form.key.trim().length < 2) {
      toast.error("Key and label are required");
      return;
    }
    const payload = {
      key: form.key.trim(),
      label: form.label.trim(),
      type: form.type,
      group: form.group.trim() || "Basics",
      required: form.required,
      enabled: form.enabled,
      order: editing?.order ?? fields.length + 1,
      options:
        form.type === "select"
          ? form.options
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean)
          : undefined,
    };
    if (editing) {
      updateField(editing.id, payload);
      toast.success("Field updated");
    } else {
      addField(payload);
      toast.success("Field added");
    }
    setOpen(false);
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">
            {entity === "account" ? "Account fields" : "Project fields"}
          </h3>
          <p className="text-[10px] text-muted-foreground">
            Catalog used by CRM forms and master data entry.
          </p>
        </div>
        <Button size="sm" className="h-7 gap-1 text-xs bg-primary" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          Add field
        </Button>
      </div>
      <div className="space-y-1.5">
        {fields
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((f) => (
            <div key={f.id} className="card-soft flex items-center justify-between gap-2 p-2.5">
              <div className="min-w-0">
                <div className="text-xs font-medium">{f.label}</div>
                <div className="text-[10px] text-muted-foreground">
                  {f.key} · {f.type} · {f.group}
                  {f.required ? " · required" : ""}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Switch
                  size="sm"
                  checked={f.enabled}
                  onCheckedChange={(v) => updateField(f.id, { enabled: v === true })}
                />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(f)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setDeleteId(f.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
      </div>

      <EntityFormModal
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit field" : "Add field"}
        submitLabel={editing ? "Save" : "Create"}
        onSubmit={save}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium">Key</label>
            <input
              className="mt-1 h-8 w-full rounded-md border bg-background px-2.5 text-xs"
              value={form.key}
              onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Label</label>
            <input
              className="mt-1 h-8 w-full rounded-md border bg-background px-2.5 text-xs"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Type</label>
            <select
              className="mt-1 h-8 w-full rounded-md border bg-background px-2.5 text-xs"
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({ ...f, type: e.target.value as FieldValueType }))
              }
            >
              {FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Group</label>
            <input
              className="mt-1 h-8 w-full rounded-md border bg-background px-2.5 text-xs"
              value={form.group}
              onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}
            />
          </div>
          {form.type === "select" ? (
            <div className="sm:col-span-2">
              <label className="text-xs font-medium">Options (comma-separated)</label>
              <input
                className="mt-1 h-8 w-full rounded-md border bg-background px-2.5 text-xs"
                value={form.options}
                onChange={(e) => setForm((f) => ({ ...f, options: e.target.value }))}
              />
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-xs">
            <Switch
              size="sm"
              checked={form.required}
              onCheckedChange={(v) => setForm((f) => ({ ...f, required: v === true }))}
            />
            Required
          </label>
          <label className="flex items-center gap-2 text-xs">
            <Switch
              size="sm"
              checked={form.enabled}
              onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v === true }))}
            />
            Enabled
          </label>
        </div>
      </EntityFormModal>

      <ConfirmDeleteDialog
        open={Boolean(deleteId)}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete field?"
        description="This removes the field definition from CRM Master Config."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteId) deleteField(deleteId);
          setDeleteId(null);
          toast.success("Field deleted");
        }}
      />
    </div>
  );
}

function PicklistsPanel() {
  const picklists = useCrmMasterStore((s) => s.picklists);
  const addPicklist = useCrmMasterStore((s) => s.addPicklist);
  const updatePicklist = useCrmMasterStore((s) => s.updatePicklist);
  const deletePicklist = useCrmMasterStore((s) => s.deletePicklist);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CrmMasterPicklist | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ key: "", label: "", description: "", values: "" });

  function openCreate() {
    setEditing(null);
    setForm({ key: "", label: "", description: "", values: "" });
    setOpen(true);
  }

  function openEdit(p: CrmMasterPicklist) {
    setEditing(p);
    setForm({
      key: p.key,
      label: p.label,
      description: p.description ?? "",
      values: p.values.join(", "),
    });
    setOpen(true);
  }

  function save() {
    if (form.label.trim().length < 2 || form.key.trim().length < 2) {
      toast.error("Key and label are required");
      return;
    }
    const values = form.values
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (editing) {
      updatePicklist(editing.id, {
        key: form.key.trim(),
        label: form.label.trim(),
        description: form.description.trim() || undefined,
        values,
      });
      toast.success("Picklist updated");
    } else {
      addPicklist({
        key: form.key.trim(),
        label: form.label.trim(),
        description: form.description.trim() || undefined,
        values,
      });
      toast.success("Picklist added");
    }
    setOpen(false);
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Picklists</h3>
          <p className="text-[10px] text-muted-foreground">
            Lead sources, statuses, follow-ups, roles, and other CRM dictionaries.
          </p>
        </div>
        <Button size="sm" className="h-7 gap-1 text-xs bg-primary" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          Add picklist
        </Button>
      </div>
      <div className="space-y-1.5">
        {picklists.map((p) => (
          <div key={p.id} className="card-soft p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-medium">{p.label}</div>
                <div className="text-[10px] text-muted-foreground">
                  {p.key}
                  {p.description ? ` · ${p.description}` : ""}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setDeleteId(p.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {p.values.map((v) => (
                <Pill key={v} tone="muted">
                  {v}
                </Pill>
              ))}
            </div>
          </div>
        ))}
      </div>

      <EntityFormModal
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit picklist" : "Add picklist"}
        submitLabel={editing ? "Save" : "Create"}
        onSubmit={save}
      >
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium">Key</label>
              <input
                className="mt-1 h-8 w-full rounded-md border bg-background px-2.5 text-xs"
                value={form.key}
                onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Label</label>
              <input
                className="mt-1 h-8 w-full rounded-md border bg-background px-2.5 text-xs"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Description</label>
            <input
              className="mt-1 h-8 w-full rounded-md border bg-background px-2.5 text-xs"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Values (comma-separated)</label>
            <textarea
              className="mt-1 min-h-20 w-full rounded-md border bg-background px-2.5 py-2 text-xs"
              value={form.values}
              onChange={(e) => setForm((f) => ({ ...f, values: e.target.value }))}
            />
          </div>
        </div>
      </EntityFormModal>

      <ConfirmDeleteDialog
        open={Boolean(deleteId)}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete picklist?"
        description="This removes the dictionary from CRM Master Config."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteId) deletePicklist(deleteId);
          setDeleteId(null);
          toast.success("Picklist deleted");
        }}
      />
    </div>
  );
}

function ModulesPanel() {
  const modules = useCrmMasterStore((s) => s.modules);
  const updateModule = useCrmMasterStore((s) => s.updateModule);

  return (
    <div className="space-y-2.5">
      <div>
        <h3 className="text-sm font-semibold">CRM modules</h3>
        <p className="text-[10px] text-muted-foreground">
          Enable or disable product modules available during account onboarding.
        </p>
      </div>
      <div className="space-y-1.5">
        {modules
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((m) => (
            <div key={m.id} className="card-soft flex items-center justify-between gap-2 p-2.5">
              <div className="min-w-0">
                <div className="text-xs font-medium">{m.label}</div>
                <div className="text-[10px] text-muted-foreground">{m.description}</div>
              </div>
              <Switch
                size="sm"
                checked={m.enabled}
                onCheckedChange={(v) => updateModule(m.id, { enabled: v === true })}
              />
            </div>
          ))}
      </div>
    </div>
  );
}

function DangerPanel() {
  const resetAll = useCrmMasterStore((s) => s.resetAll);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2.5">
      <div className="card-soft border-destructive/30 p-3">
        <h3 className="text-sm font-semibold text-destructive">Reset CRM Master Config</h3>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Restores seeded account fields, project fields, picklists, and modules. Does not delete
          CRM accounts or onboarding checklists.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-3 h-8 gap-1 text-xs text-destructive"
          onClick={() => setOpen(true)}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset to seed defaults
        </Button>
      </div>
      <ConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        title="Reset CRM Master Config?"
        description="All field catalogs, picklists, and module toggles will revert to seed defaults."
        confirmLabel="Reset"
        onConfirm={() => {
          resetAll();
          setOpen(false);
          toast.success("CRM Master Config reset");
        }}
      />
    </div>
  );
}
