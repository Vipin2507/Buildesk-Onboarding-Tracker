import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  Boxes,
  Copy,
  Database,
  FileText,
  Layers,
  ListChecks,
  Package,
  Pencil,
  Plug,
  Plus,
  RotateCcw,
  Settings2,
  ShieldAlert,
  Table2,
  Trash2,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { createFileRoute, Link } from "@tanstack/react-router";

import { PageHeader, PageWrap } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Pill } from "@/components/status-pill";
import { ConfirmDeleteDialog, EntityFormModal } from "@/components/entity-form-modal";
import { DataControlPanel } from "@/components/master-data-control";
import {
  useCurrentUser,
  useMasterStore,
  type MasterResetSection,
} from "@/stores";
import type {
  FieldValueType,
  MasterFieldDef,
  MasterInventoryCategory,
  MasterInventoryItem,
  MasterInventoryWorkflowStep,
  MasterModuleDef,
  MasterPicklist,
  MasterTemplateDef,
  MasterWorkflowStepDef,
} from "@/types";
import { MASTER_INVENTORY_CATEGORIES } from "@/types/master";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/master")({
  component: MasterPage,
});

const SECTIONS = [
  { id: "overview", label: "Overview", icon: Database },
  { id: "platform", label: "Platform", icon: Settings2 },
  { id: "company-fields", label: "Company Fields", icon: Building2 },
  { id: "project-fields", label: "Project Fields", icon: Boxes },
  { id: "picklists", label: "Picklists", icon: ListChecks },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "workflow", label: "Workflow Steps", icon: Workflow },
  { id: "checklist", label: "Onboarding Checklist", icon: Layers },
  { id: "templates", label: "Templates", icon: FileText },
  { id: "modules", label: "Modules", icon: Layers },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "data-control", label: "Data Control", icon: Table2 },
  { id: "danger", label: "Reset & Safety", icon: ShieldAlert },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const FIELD_TYPES: FieldValueType[] = [
  "text", "email", "phone", "number", "date", "textarea", "select", "multiselect", "boolean",
];

function MasterPage() {
  const user = useCurrentUser();
  const [section, setSection] = useState<SectionId>("overview");

  if (user?.role !== "Admin") {
    return (
      <PageWrap>
        <PageHeader title="Master Config" subtitle="Central control plane for the tracker." />
        <div className="card-soft mx-auto max-w-lg p-8 text-center">
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-destructive" />
          <h3 className="font-semibold">Admin access required</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Master Config controls every catalog, field definition, workflow step, and template
            used across the product. Only Admins can view or change it.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link to="/">Back to Dashboard</Link>
          </Button>
        </div>
      </PageWrap>
    );
  }

  return (
    <PageWrap>
      <PageHeader
        title="Master Config"
        subtitle="Single source of truth for fields, workflows, templates, modules, and dictionaries."
      />

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <aside className="card-soft flex h-fit gap-1 overflow-x-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:sticky lg:top-20 lg:block lg:space-y-1 lg:overflow-visible">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                className={cn(
                  "flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors lg:w-full",
                  section === s.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{s.label}</span>
              </button>
            );
          })}
        </aside>

        <div className="min-w-0">
          {section === "overview" && <OverviewPanel onNavigate={setSection} />}
          {section === "platform" && <PlatformPanel />}
          {section === "company-fields" && <FieldsPanel entity="company" />}
          {section === "project-fields" && <FieldsPanel entity="project" />}
          {section === "picklists" && <PicklistsPanel />}
          {section === "inventory" && <InventoryPanel />}
          {section === "workflow" && <WorkflowPanel />}
          {section === "checklist" && <ChecklistPanel />}
          {section === "templates" && <TemplatesPanel />}
          {section === "modules" && <ModulesPanel />}
          {section === "integrations" && <IntegrationsPanel />}
          {section === "data-control" && <DataControlPanel />}
          {section === "danger" && <DangerPanel />}
        </div>
      </div>
    </PageWrap>
  );
}

function OverviewPanel({ onNavigate }: { onNavigate: (id: SectionId) => void }) {
  const companyFields = useMasterStore((s) => s.companyFields);
  const projectFields = useMasterStore((s) => s.projectFields);
  const picklists = useMasterStore((s) => s.picklists);
  const workflowSteps = useMasterStore((s) => s.workflowSteps);
  const checklistItems = useMasterStore((s) => s.checklistItems);
  const templates = useMasterStore((s) => s.templates);
  const modules = useMasterStore((s) => s.modules);
  const integrations = useMasterStore((s) => s.integrations);
  const triggers = useMasterStore((s) => s.triggers);
  const inventoryItems = useMasterStore((s) => s.inventoryItems ?? []);
  const platform = useMasterStore((s) => s.platform);

  const cards = [
    { label: "Company Fields", value: companyFields.filter((f) => f.enabled).length, total: companyFields.length, to: "company-fields" as const },
    { label: "Project Fields", value: projectFields.filter((f) => f.enabled).length, total: projectFields.length, to: "project-fields" as const },
    { label: "Picklists", value: picklists.length, total: picklists.reduce((n, p) => n + p.values.length, 0), to: "picklists" as const, suffix: "values" },
    { label: "Inventory Items", value: inventoryItems.filter((i) => i.enabled).length, total: inventoryItems.length, to: "inventory" as const },
    { label: "Workflow Steps", value: workflowSteps.filter((s) => s.enabled).length, total: workflowSteps.length, to: "workflow" as const },
    { label: "Checklist Items", value: checklistItems.filter((c) => c.enabled).length, total: checklistItems.length, to: "checklist" as const },
    { label: "Templates", value: templates.filter((t) => t.enabled).length, total: templates.length, to: "templates" as const },
    { label: "Modules", value: modules.filter((m) => m.enabled).length, total: modules.length, to: "modules" as const },
    { label: "Integrations", value: integrations.filter((i) => i.enabled).length, total: integrations.length + triggers.length, to: "integrations" as const },
    { label: "Data Control", value: "Edit", total: "companies & projects", to: "data-control" as const, suffix: "" },
  ];

  return (
    <div className="space-y-4">
      <div className="card-soft p-5">
        <h3 className="font-semibold">{platform.productName}</h3>
        <p className="text-sm text-muted-foreground">{platform.productTagline}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Pill tone="accent">{platform.defaultTimezone}</Pill>
          <Pill>{platform.defaultCurrency}</Pill>
          <Pill>{platform.supportEmail}</Pill>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => onNavigate(c.to)}
            className="card-soft p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className="mt-1 text-2xl font-semibold">{c.value}</div>
            <div className="text-[11px] text-muted-foreground">
              {typeof c.total === "number"
                ? `of ${c.total} ${c.suffix || "defined"} · click to manage`
                : `${c.total} · click to manage`}
            </div>
          </button>
        ))}
      </div>
      <div className="card-soft border-dashed p-4 text-sm text-muted-foreground">
        Changes here drive new Post Sales projects, form catalogs, and template pickers.
        Existing operational records are not rewritten until you recreate them. Use Data Control
        to edit or delete live company and project records.
      </div>
    </div>
  );
}

function PlatformPanel() {
  const platform = useMasterStore((s) => s.platform);
  const updatePlatform = useMasterStore((s) => s.updatePlatform);
  const [form, setForm] = useState(platform);

  return (
    <div className="space-y-4">
      <SectionHead
        title="Platform Settings"
        description="Global product identity and governance defaults."
      />
      <div className="card-soft grid gap-3 p-5 md:grid-cols-2">
        {(
          [
            ["productName", "Product Name"],
            ["productTagline", "Tagline"],
            ["supportEmail", "Support Email"],
            ["defaultTimezone", "Default Timezone"],
            ["defaultCurrency", "Default Currency"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block text-xs font-medium">
            {label}
            <input
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
            />
          </label>
        ))}
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input
            type="checkbox"
            checked={form.allowViewerApprovals}
            onChange={(e) => setForm((f) => ({ ...f, allowViewerApprovals: e.target.checked }))}
          />
          Allow Viewer role to approve Post Sales steps
        </label>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input
            type="checkbox"
            checked={form.requireRejectionRemarks}
            onChange={(e) => setForm((f) => ({ ...f, requireRejectionRemarks: e.target.checked }))}
          />
          Require rejection remarks
        </label>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input
            type="checkbox"
            checked={form.autoLogActivity}
            onChange={(e) => setForm((f) => ({ ...f, autoLogActivity: e.target.checked }))}
          />
          Auto-log activity for all mutations
        </label>
      </div>
      <Button
        onClick={() => {
          updatePlatform(form);
          toast.success("Platform settings saved");
        }}
      >
        Save Platform Settings
      </Button>
    </div>
  );
}

function FieldsPanel({ entity }: { entity: "company" | "project" }) {
  const companyFields = useMasterStore((s) => s.companyFields);
  const projectFields = useMasterStore((s) => s.projectFields);
  const addCompanyField = useMasterStore((s) => s.addCompanyField);
  const updateCompanyField = useMasterStore((s) => s.updateCompanyField);
  const deleteCompanyField = useMasterStore((s) => s.deleteCompanyField);
  const addProjectField = useMasterStore((s) => s.addProjectField);
  const updateProjectField = useMasterStore((s) => s.updateProjectField);
  const deleteProjectField = useMasterStore((s) => s.deleteProjectField);

  const fields = useMemo(
    () =>
      [...(entity === "company" ? companyFields : projectFields)].sort((a, b) => a.order - b.order),
    [entity, companyFields, projectFields],
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<MasterFieldDef | null>(null);
  const [form, setForm] = useState({
    key: "",
    label: "",
    description: "",
    type: "text" as FieldValueType,
    required: false,
    enabled: true,
    group: "General",
    options: "",
    placeholder: "",
    order: fields.length + 1,
  });

  function openCreate() {
    setEditing(null);
    setForm({
      key: "",
      label: "",
      description: "",
      type: "text",
      required: false,
      enabled: true,
      group: "General",
      options: "",
      placeholder: "",
      order: fields.length + 1,
    });
    setModalOpen(true);
  }

  function openEdit(f: MasterFieldDef) {
    setEditing(f);
    setForm({
      key: f.key,
      label: f.label,
      description: f.description ?? "",
      type: f.type,
      required: f.required,
      enabled: f.enabled,
      group: f.group,
      options: (f.options ?? []).join(", "),
      placeholder: f.placeholder ?? "",
      order: f.order,
    });
    setModalOpen(true);
  }

  function save() {
    if (!form.key.trim() || !form.label.trim()) {
      toast.error("Key and label are required");
      return;
    }
    const payload = {
      key: form.key.trim(),
      label: form.label.trim(),
      description: form.description.trim() || undefined,
      type: form.type,
      required: form.required,
      enabled: form.enabled,
      group: form.group.trim() || "General",
      options: form.options
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      placeholder: form.placeholder.trim() || undefined,
      order: form.order,
    };
    if (editing) {
      if (entity === "company") updateCompanyField(editing.id, payload);
      else updateProjectField(editing.id, payload);
      toast.success("Field updated");
    } else {
      if (entity === "company") addCompanyField(payload);
      else addProjectField(payload);
      toast.success("Field added");
    }
    setModalOpen(false);
  }

  return (
    <div className="space-y-4">
      <SectionHead
        title={entity === "company" ? "Company Field Catalog" : "Project Field Catalog"}
        description="Define which attributes appear in create/edit forms and detail views."
        action={<Button size="sm" className="gap-1" onClick={openCreate}><Plus className="h-3.5 w-3.5" /> Add Field</Button>}
      />
      <div className="card-soft overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Order</th>
              <th className="px-3 py-2 text-left">Label / Key</th>
              <th className="px-3 py-2 text-left">Group</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Flags</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f.id} className="border-t">
                <td className="px-3 py-2 text-muted-foreground">{f.order}</td>
                <td className="px-3 py-2">
                  <div className="font-medium">{f.label}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">{f.key}</div>
                </td>
                <td className="px-3 py-2">{f.group}</td>
                <td className="px-3 py-2"><Pill>{f.type}</Pill></td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {f.required && <Pill tone="warning">Required</Pill>}
                    <Pill tone={f.enabled ? "success" : "muted"}>{f.enabled ? "Enabled" : "Off"}</Pill>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-0.5">
                  <MasterToggle
                    enabled={f.enabled}
                    onClick={() => {
                      if (entity === "company") updateCompanyField(f.id, { enabled: !f.enabled });
                      else updateProjectField(f.id, { enabled: !f.enabled });
                    }}
                  />
                  <MasterIconButton label="Edit field" onClick={() => openEdit(f)}><Pencil /></MasterIconButton>
                  <MasterIconButton label="Delete field" destructive onClick={() => setDeleteId(f.id)}><Trash2 /></MasterIconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <EntityFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Edit Field" : "Add Field"}
        onSubmit={save}
        submitLabel={editing ? "Update" : "Create"}
      >
        <div className="grid gap-3">
          <label className="text-xs font-medium">Label<input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label>
          <label className="text-xs font-medium">Key<input value={form.key} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))} className="mt-1 h-9 w-full rounded-md border px-3 font-mono text-sm" /></label>
          <label className="text-xs font-medium">Group<input value={form.group} onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))} className="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label>
          <label className="text-xs font-medium">Type
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as FieldValueType }))} className="mt-1 h-9 w-full rounded-md border px-3 text-sm">
              {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium">Options (comma-separated, for select)
            <input value={form.options} onChange={(e) => setForm((f) => ({ ...f, options: e.target.value }))} className="mt-1 h-9 w-full rounded-md border px-3 text-sm" />
          </label>
          <label className="text-xs font-medium">Placeholder<input value={form.placeholder} onChange={(e) => setForm((f) => ({ ...f, placeholder: e.target.value }))} className="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label>
          <label className="text-xs font-medium">Description<textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="mt-1 min-h-[64px] w-full rounded-md border px-3 py-2 text-sm" /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.required} onChange={(e) => setForm((f) => ({ ...f, required: e.target.checked }))} /> Required</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} /> Enabled</label>
        </div>
      </EntityFormModal>

      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete field definition?"
        description="Forms that already use this key will still keep stored values until edited."
        onConfirm={() => {
          if (!deleteId) return;
          if (entity === "company") deleteCompanyField(deleteId);
          else deleteProjectField(deleteId);
          setDeleteId(null);
          toast.success("Field deleted");
        }}
      />
    </div>
  );
}

function PicklistsPanel() {
  const picklists = useMasterStore((s) => s.picklists);
  const addPicklist = useMasterStore((s) => s.addPicklist);
  const updatePicklist = useMasterStore((s) => s.updatePicklist);
  const deletePicklist = useMasterStore((s) => s.deletePicklist);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<MasterPicklist | null>(null);
  const [form, setForm] = useState({ key: "", label: "", description: "", values: "" });

  function openCreate() {
    setEditing(null);
    setForm({ key: "", label: "", description: "", values: "" });
    setModalOpen(true);
  }

  function openEdit(p: MasterPicklist) {
    setEditing(p);
    setForm({
      key: p.key,
      label: p.label,
      description: p.description ?? "",
      values: p.values.join("\n"),
    });
    setModalOpen(true);
  }

  function save() {
    const values = form.values.split("\n").map((v) => v.trim()).filter(Boolean);
    if (!form.key.trim() || !form.label.trim() || values.length === 0) {
      toast.error("Key, label, and at least one value are required");
      return;
    }
    const payload = {
      key: form.key.trim(),
      label: form.label.trim(),
      description: form.description.trim() || undefined,
      values,
    };
    if (editing) {
      updatePicklist(editing.id, payload);
      toast.success("Picklist updated");
    } else {
      addPicklist(payload);
      toast.success("Picklist created");
    }
    setModalOpen(false);
  }

  return (
    <div className="space-y-4">
      <SectionHead
        title="Global Picklists"
        description="Shared value dictionaries for plans, health, ticket types, training types, and more."
        action={<Button size="sm" className="gap-1" onClick={openCreate}><Plus className="h-3.5 w-3.5" /> Add Picklist</Button>}
      />
      <div className="grid gap-3 md:grid-cols-2">
        {picklists.map((p) => (
          <div key={p.id} className="card-soft p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{p.label}</div>
                <div className="font-mono text-[11px] text-muted-foreground">{p.key}</div>
              </div>
              <div className="flex items-center gap-0.5">
                <MasterIconButton label="Edit picklist" onClick={() => openEdit(p)}><Pencil /></MasterIconButton>
                <MasterIconButton label="Delete picklist" destructive onClick={() => setDeleteId(p.id)}><Trash2 /></MasterIconButton>
              </div>
            </div>
            {p.description && <p className="mb-2 text-xs text-muted-foreground">{p.description}</p>}
            <div className="flex flex-wrap gap-1">
              {p.values.map((v) => <Pill key={v} tone="accent">{v}</Pill>)}
            </div>
          </div>
        ))}
      </div>

      <EntityFormModal open={modalOpen} onOpenChange={setModalOpen} title={editing ? "Edit Picklist" : "Add Picklist"} onSubmit={save}>
        <div className="grid gap-3">
          <label className="text-xs font-medium">Label<input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label>
          <label className="text-xs font-medium">Key<input value={form.key} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))} className="mt-1 h-9 w-full rounded-md border px-3 font-mono text-sm" /></label>
          <label className="text-xs font-medium">Description<input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label>
          <label className="text-xs font-medium">Values (one per line)
            <textarea value={form.values} onChange={(e) => setForm((f) => ({ ...f, values: e.target.value }))} className="mt-1 min-h-[140px] w-full rounded-md border px-3 py-2 font-mono text-sm" />
          </label>
        </div>
      </EntityFormModal>

      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete picklist?"
        onConfirm={() => {
          if (deleteId) deletePicklist(deleteId);
          setDeleteId(null);
          toast.success("Picklist deleted");
        }}
      />
    </div>
  );
}

function InventoryPanel() {
  const items = useMasterStore((s) => s.inventoryItems ?? []);
  const addInventoryItem = useMasterStore((s) => s.addInventoryItem);
  const updateInventoryItem = useMasterStore((s) => s.updateInventoryItem);
  const deleteInventoryItem = useMasterStore((s) => s.deleteInventoryItem);
  const addInventoryWorkflowStep = useMasterStore((s) => s.addInventoryWorkflowStep);
  const updateInventoryWorkflowStep = useMasterStore((s) => s.updateInventoryWorkflowStep);
  const deleteInventoryWorkflowStep = useMasterStore((s) => s.deleteInventoryWorkflowStep);
  const moveInventoryWorkflowStep = useMasterStore((s) => s.moveInventoryWorkflowStep);
  const applyDefaultWorkflowToItem = useMasterStore((s) => s.applyDefaultWorkflowToItem);
  const clearInventoryWorkflow = useMasterStore((s) => s.clearInventoryWorkflow);

  const sorted = useMemo(() => [...items].sort((a, b) => a.order - b.order), [items]);
  const [selectedId, setSelectedId] = useState<string | null>(sorted[0]?.id ?? null);
  const selected = sorted.find((i) => i.id === selectedId) ?? sorted[0] ?? null;

  const [itemModal, setItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterInventoryItem | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState({
    name: "",
    sku: "",
    category: "Other" as MasterInventoryCategory,
    description: "",
    unit: "",
    enabled: true,
  });

  const [stepModal, setStepModal] = useState(false);
  const [editingStep, setEditingStep] = useState<MasterInventoryWorkflowStep | null>(null);
  const [deleteStepId, setDeleteStepId] = useState<string | null>(null);
  const [stepForm, setStepForm] = useState({
    key: "",
    label: "",
    description: "",
    requiresApproval: true,
    requiresUpload: false,
    enabled: true,
  });

  function openCreateItem() {
    setEditingItem(null);
    setItemForm({
      name: "",
      sku: "",
      category: "Other",
      description: "",
      unit: "",
      enabled: true,
    });
    setItemModal(true);
  }

  function openEditItem(item: MasterInventoryItem) {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      sku: item.sku ?? "",
      category: item.category,
      description: item.description ?? "",
      unit: item.unit ?? "",
      enabled: item.enabled,
    });
    setItemModal(true);
  }

  function saveItem() {
    if (!itemForm.name.trim()) {
      toast.error("Item name is required");
      return;
    }
    if (editingItem) {
      updateInventoryItem(editingItem.id, {
        name: itemForm.name.trim(),
        sku: itemForm.sku.trim() || undefined,
        category: itemForm.category,
        description: itemForm.description.trim() || undefined,
        unit: itemForm.unit.trim() || undefined,
        enabled: itemForm.enabled,
      });
      toast.success("Inventory item updated");
    } else {
      const created = addInventoryItem({
        name: itemForm.name.trim(),
        sku: itemForm.sku.trim() || undefined,
        category: itemForm.category,
        description: itemForm.description.trim() || undefined,
        unit: itemForm.unit.trim() || undefined,
        enabled: itemForm.enabled,
        order: items.length + 1,
        workflow: [],
      });
      setSelectedId(created.id);
      toast.success("Inventory item added — set up its workflow below");
    }
    setItemModal(false);
  }

  function openCreateStep() {
    if (!selected) return;
    setEditingStep(null);
    setStepForm({
      key: "",
      label: "",
      description: "",
      requiresApproval: true,
      requiresUpload: false,
      enabled: true,
    });
    setStepModal(true);
  }

  function openEditStep(step: MasterInventoryWorkflowStep) {
    setEditingStep(step);
    setStepForm({
      key: step.key,
      label: step.label,
      description: step.description ?? "",
      requiresApproval: step.requiresApproval,
      requiresUpload: step.requiresUpload,
      enabled: step.enabled,
    });
    setStepModal(true);
  }

  function saveStep() {
    if (!selected) return;
    if (!stepForm.label.trim()) {
      toast.error("Step label is required");
      return;
    }
    const key =
      stepForm.key.trim() ||
      stepForm.label
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    const payload = {
      key,
      label: stepForm.label.trim(),
      description: stepForm.description.trim() || undefined,
      requiresApproval: stepForm.requiresApproval,
      requiresUpload: stepForm.requiresUpload,
      enabled: stepForm.enabled,
      order: editingStep?.order ?? selected.workflow.length + 1,
    };
    if (editingStep) {
      updateInventoryWorkflowStep(selected.id, editingStep.id, payload);
      toast.success("Workflow step updated");
    } else {
      addInventoryWorkflowStep(selected.id, payload);
      toast.success("Workflow step added");
    }
    setStepModal(false);
  }

  const workflowSorted = useMemo(
    () => [...(selected?.workflow ?? [])].sort((a, b) => a.order - b.order),
    [selected],
  );

  return (
    <div className="space-y-4">
      <SectionHead
        title="Inventory Catalog"
        description="Add any item and manually design its end-to-end workflow. Full create, edit, reorder, and delete access."
        action={
          <Button size="sm" className="gap-1" onClick={openCreateItem}>
            <Plus className="h-3.5 w-3.5" /> Add Item
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="card-soft space-y-2 p-3">
          <div className="px-1 pb-1 text-xs font-medium text-muted-foreground">
            {sorted.length} item{sorted.length === 1 ? "" : "s"}
          </div>
          {sorted.length === 0 && (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No inventory items yet. Click Add Item to create one.
            </div>
          )}
          {sorted.map((item) => {
            const active = (selected?.id ?? selectedId) === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                  active ? "border-primary bg-primary/10" : "hover:bg-muted/50",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{item.name}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      <Pill tone="accent">{item.category}</Pill>
                      {item.sku && <span className="font-mono text-[10px] text-muted-foreground">{item.sku}</span>}
                    </div>
                  </div>
                  <Pill tone={item.enabled ? "success" : "muted"}>{item.enabled ? "On" : "Off"}</Pill>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {item.workflow.filter((s) => s.enabled).length}/{item.workflow.length} workflow steps
                </div>
              </button>
            );
          })}
        </div>

        <div className="min-w-0 space-y-4">
          {!selected ? (
            <div className="card-soft p-8 text-center text-sm text-muted-foreground">
              Select or add an inventory item to configure its workflow.
            </div>
          ) : (
            <>
              <div className="card-soft p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-semibold">{selected.name}</h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selected.description || "No description yet."}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <Pill tone="accent">{selected.category}</Pill>
                      {selected.sku && <Pill>{selected.sku}</Pill>}
                      {selected.unit && <Pill>Unit: {selected.unit}</Pill>}
                      <Pill tone={selected.enabled ? "success" : "muted"}>
                        {selected.enabled ? "Enabled" : "Disabled"}
                      </Pill>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <MasterToggle
                      enabled={selected.enabled}
                      onClick={() => updateInventoryItem(selected.id, { enabled: !selected.enabled })}
                    />
                    <MasterIconButton label="Edit item" onClick={() => openEditItem(selected)}>
                      <Pencil />
                    </MasterIconButton>
                    <MasterIconButton label="Delete item" destructive onClick={() => setDeleteItemId(selected.id)}>
                      <Trash2 />
                    </MasterIconButton>
                  </div>
                </div>
              </div>

              <div className="card-soft p-5">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h4 className="font-semibold">Item Workflow</h4>
                    <p className="text-xs text-muted-foreground">
                      Manually define every step for this item — order, approvals, and uploads.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => {
                        applyDefaultWorkflowToItem(selected.id);
                        toast.success("Default Post Sales workflow applied");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" /> Use default workflow
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        clearInventoryWorkflow(selected.id);
                        toast.message("Workflow cleared");
                      }}
                    >
                      Clear
                    </Button>
                    <Button size="sm" className="gap-1" onClick={openCreateStep}>
                      <Plus className="h-3.5 w-3.5" /> Add Step
                    </Button>
                  </div>
                </div>

                {workflowSorted.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No steps yet. Add steps manually or apply the default Post Sales workflow.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {workflowSorted.map((step, idx) => (
                      <div key={step.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 p-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                          {idx + 1}
                        </div>
                        <div className="min-w-[160px] flex-1">
                          <div className="font-medium">{step.label}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">{step.key}</div>
                          {step.description && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <Pill tone={step.enabled ? "success" : "muted"}>{step.enabled ? "On" : "Off"}</Pill>
                          {step.requiresApproval && <Pill tone="accent">Approval</Pill>}
                          {step.requiresUpload && <Pill>Upload</Pill>}
                        </div>
                        <div className="flex items-center gap-0.5">
                          <MasterIconButton
                            label="Move up"
                            onClick={() => moveInventoryWorkflowStep(selected.id, step.id, "up")}
                          >
                            <ArrowUp />
                          </MasterIconButton>
                          <MasterIconButton
                            label="Move down"
                            onClick={() => moveInventoryWorkflowStep(selected.id, step.id, "down")}
                          >
                            <ArrowDown />
                          </MasterIconButton>
                          <MasterToggle
                            enabled={step.enabled}
                            onClick={() =>
                              updateInventoryWorkflowStep(selected.id, step.id, { enabled: !step.enabled })
                            }
                          />
                          <MasterIconButton label="Edit step" onClick={() => openEditStep(step)}>
                            <Pencil />
                          </MasterIconButton>
                          <MasterIconButton
                            label="Delete step"
                            destructive
                            onClick={() => setDeleteStepId(step.id)}
                          >
                            <Trash2 />
                          </MasterIconButton>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <EntityFormModal
        open={itemModal}
        onOpenChange={setItemModal}
        title={editingItem ? "Edit Inventory Item" : "Add Inventory Item"}
        onSubmit={saveItem}
      >
        <div className="grid gap-3">
          <label className="text-xs font-medium">
            Name
            <input
              value={itemForm.name}
              onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              placeholder="e.g. Receipt Format"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-medium">
              SKU
              <input
                value={itemForm.sku}
                onChange={(e) => setItemForm((f) => ({ ...f, sku: e.target.value }))}
                className="mt-1 h-9 w-full rounded-md border px-3 font-mono text-sm"
                placeholder="INV-…"
              />
            </label>
            <label className="text-xs font-medium">
              Unit
              <input
                value={itemForm.unit}
                onChange={(e) => setItemForm((f) => ({ ...f, unit: e.target.value }))}
                className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
                placeholder="template / bag / app"
              />
            </label>
          </div>
          <label className="text-xs font-medium">
            Category
            <select
              value={itemForm.category}
              onChange={(e) =>
                setItemForm((f) => ({ ...f, category: e.target.value as MasterInventoryCategory }))
              }
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
            >
              {MASTER_INVENTORY_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium">
            Description
            <textarea
              value={itemForm.description}
              onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
              className="mt-1 min-h-[72px] w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={itemForm.enabled}
              onChange={(e) => setItemForm((f) => ({ ...f, enabled: e.target.checked }))}
            />
            Enabled
          </label>
        </div>
      </EntityFormModal>

      <EntityFormModal
        open={stepModal}
        onOpenChange={setStepModal}
        title={editingStep ? "Edit Workflow Step" : "Add Workflow Step"}
        onSubmit={saveStep}
      >
        <div className="grid gap-3">
          <label className="text-xs font-medium">
            Label
            <input
              value={stepForm.label}
              onChange={(e) => setStepForm((f) => ({ ...f, label: e.target.value }))}
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
            />
          </label>
          <label className="text-xs font-medium">
            Key
            <input
              value={stepForm.key}
              onChange={(e) => setStepForm((f) => ({ ...f, key: e.target.value }))}
              className="mt-1 h-9 w-full rounded-md border px-3 font-mono text-sm"
              placeholder="auto from label if empty"
            />
          </label>
          <label className="text-xs font-medium">
            Description
            <textarea
              value={stepForm.description}
              onChange={(e) => setStepForm((f) => ({ ...f, description: e.target.value }))}
              className="mt-1 min-h-[64px] w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={stepForm.requiresApproval}
              onChange={(e) => setStepForm((f) => ({ ...f, requiresApproval: e.target.checked }))}
            />
            Requires approval
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={stepForm.requiresUpload}
              onChange={(e) => setStepForm((f) => ({ ...f, requiresUpload: e.target.checked }))}
            />
            Requires upload
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={stepForm.enabled}
              onChange={(e) => setStepForm((f) => ({ ...f, enabled: e.target.checked }))}
            />
            Enabled
          </label>
        </div>
      </EntityFormModal>

      <ConfirmDeleteDialog
        open={!!deleteItemId}
        onOpenChange={(o) => !o && setDeleteItemId(null)}
        title="Delete inventory item?"
        description="This removes the item and its custom workflow from Master Config."
        onConfirm={() => {
          if (deleteItemId) {
            deleteInventoryItem(deleteItemId);
            if (selectedId === deleteItemId) setSelectedId(null);
            toast.success("Inventory item deleted");
          }
          setDeleteItemId(null);
        }}
      />

      <ConfirmDeleteDialog
        open={!!deleteStepId}
        onOpenChange={(o) => !o && setDeleteStepId(null)}
        title="Delete workflow step?"
        onConfirm={() => {
          if (selected && deleteStepId) {
            deleteInventoryWorkflowStep(selected.id, deleteStepId);
            toast.success("Step deleted");
          }
          setDeleteStepId(null);
        }}
      />
    </div>
  );
}

function WorkflowPanel() {
  const steps = useMasterStore((s) => s.workflowSteps);
  const addWorkflowStep = useMasterStore((s) => s.addWorkflowStep);
  const updateWorkflowStep = useMasterStore((s) => s.updateWorkflowStep);
  const deleteWorkflowStep = useMasterStore((s) => s.deleteWorkflowStep);
  const moveWorkflowStep = useMasterStore((s) => s.moveWorkflowStep);
  const sorted = useMemo(() => [...steps].sort((a, b) => a.order - b.order), [steps]);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<MasterWorkflowStepDef | null>(null);
  const [form, setForm] = useState({
    key: "",
    label: "",
    description: "",
    requiresTemplate: true,
    enabled: true,
    templateName: "",
    order: sorted.length + 1,
  });

  function openCreate() {
    setEditing(null);
    setForm({
      key: "",
      label: "",
      description: "",
      requiresTemplate: true,
      enabled: true,
      templateName: "",
      order: sorted.length + 1,
    });
    setModalOpen(true);
  }

  function openEdit(s: MasterWorkflowStepDef) {
    setEditing(s);
    setForm({
      key: s.key,
      label: s.label,
      description: s.description ?? "",
      requiresTemplate: s.requiresTemplate,
      enabled: s.enabled,
      templateName: s.templateName ?? "",
      order: s.order,
    });
    setModalOpen(true);
  }

  function save() {
    if (!form.key.trim() || !form.label.trim()) {
      toast.error("Key and label required");
      return;
    }
    const payload = {
      key: form.key.trim(),
      label: form.label.trim(),
      description: form.description.trim() || undefined,
      requiresTemplate: form.requiresTemplate,
      enabled: form.enabled,
      templateName: form.templateName.trim() || undefined,
      order: form.order,
    };
    if (editing) {
      updateWorkflowStep(editing.id, payload);
      toast.success("Step updated");
    } else {
      addWorkflowStep(payload);
      toast.success("Step added — new Post Sales projects will include it");
    }
    setModalOpen(false);
  }

  return (
    <div className="space-y-4">
      <SectionHead
        title="Post Sales Workflow Steps"
        description="Canonical pipeline for every new Post Sales project (template → upload → approval)."
        action={<Button size="sm" className="gap-1" onClick={openCreate}><Plus className="h-3.5 w-3.5" /> Add Step</Button>}
      />
      <div className="space-y-2">
        {sorted.map((s, idx) => (
          <div key={s.id} className="card-soft flex flex-wrap items-center gap-3 p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
              {idx + 1}
            </div>
            <div className="min-w-[180px] flex-1">
              <div className="font-medium">{s.label}</div>
              <div className="font-mono text-[11px] text-muted-foreground">{s.key}</div>
              {s.description && <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>}
            </div>
            <div className="flex flex-wrap gap-1">
              <Pill tone={s.enabled ? "success" : "muted"}>{s.enabled ? "Enabled" : "Disabled"}</Pill>
              <Pill tone={s.requiresTemplate ? "accent" : "muted"}>
                {s.requiresTemplate ? s.templateName || "Template required" : "No template"}
              </Pill>
            </div>
            <div className="flex items-center gap-0.5">
              <MasterIconButton label="Move up" onClick={() => moveWorkflowStep(s.id, "up")}><ArrowUp /></MasterIconButton>
              <MasterIconButton label="Move down" onClick={() => moveWorkflowStep(s.id, "down")}><ArrowDown /></MasterIconButton>
              <MasterToggle enabled={s.enabled} onClick={() => updateWorkflowStep(s.id, { enabled: !s.enabled })} />
              <MasterIconButton label="Edit step" onClick={() => openEdit(s)}><Pencil /></MasterIconButton>
              <MasterIconButton label="Delete step" destructive onClick={() => setDeleteId(s.id)}><Trash2 /></MasterIconButton>
            </div>
          </div>
        ))}
      </div>

      <EntityFormModal open={modalOpen} onOpenChange={setModalOpen} title={editing ? "Edit Step" : "Add Step"} onSubmit={save}>
        <div className="grid gap-3">
          <label className="text-xs font-medium">Label<input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label>
          <label className="text-xs font-medium">Key<input value={form.key} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))} className="mt-1 h-9 w-full rounded-md border px-3 font-mono text-sm" /></label>
          <label className="text-xs font-medium">Description<textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="mt-1 min-h-[64px] w-full rounded-md border px-3 py-2 text-sm" /></label>
          <label className="text-xs font-medium">Template file name<input value={form.templateName} onChange={(e) => setForm((f) => ({ ...f, templateName: e.target.value }))} className="mt-1 h-9 w-full rounded-md border px-3 text-sm" placeholder="Unit Details Template.xlsx" /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.requiresTemplate} onChange={(e) => setForm((f) => ({ ...f, requiresTemplate: e.target.checked }))} /> Requires template</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} /> Enabled</label>
        </div>
      </EntityFormModal>

      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete workflow step?"
        description="Existing projects keep their steps. New projects will no longer include this step."
        onConfirm={() => {
          if (deleteId) deleteWorkflowStep(deleteId);
          setDeleteId(null);
          toast.success("Step deleted");
        }}
      />
    </div>
  );
}

function ChecklistPanel() {
  const items = useMasterStore((s) => s.checklistItems);
  const addChecklistItem = useMasterStore((s) => s.addChecklistItem);
  const updateChecklistItem = useMasterStore((s) => s.updateChecklistItem);
  const deleteChecklistItem = useMasterStore((s) => s.deleteChecklistItem);
  const sections = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const item of [...items].sort((a, b) => a.order - b.order)) {
      const list = map.get(item.sectionKey) ?? [];
      list.push(item);
      map.set(item.sectionKey, list);
    }
    return Array.from(map.entries());
  }, [items]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ sectionKey: "project", sectionLabel: "Project Information", label: "" });

  return (
    <div className="space-y-4">
      <SectionHead
        title="Onboarding Checklist Catalog"
        description="Master checklist items copied into each onboarding project."
        action={<Button size="sm" className="gap-1" onClick={() => setModalOpen(true)}><Plus className="h-3.5 w-3.5" /> Add Item</Button>}
      />
      {sections.map(([key, list]) => (
        <div key={key} className="card-soft p-4">
          <h4 className="mb-3 text-sm font-semibold">{list[0]?.sectionLabel ?? key}</h4>
          <ul className="space-y-2">
            {list.map((item) => (
              <li key={item.id} className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm">
                <span className="flex-1">{item.label}</span>
                <Pill tone={item.enabled ? "success" : "muted"}>{item.enabled ? "On" : "Off"}</Pill>
                <MasterToggle enabled={item.enabled} onClick={() => updateChecklistItem(item.id, { enabled: !item.enabled })} />
                <MasterIconButton label="Remove item" destructive onClick={() => { deleteChecklistItem(item.id); toast.success("Removed"); }}><Trash2 /></MasterIconButton>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <EntityFormModal open={modalOpen} onOpenChange={setModalOpen} title="Add Checklist Item" onSubmit={() => {
        if (!form.label.trim()) return toast.error("Label required");
        addChecklistItem({
          sectionKey: form.sectionKey,
          sectionLabel: form.sectionLabel,
          label: form.label.trim(),
          enabled: true,
          order: items.length + 1,
        });
        setModalOpen(false);
        setForm({ sectionKey: "project", sectionLabel: "Project Information", label: "" });
        toast.success("Checklist item added");
      }}>
        <div className="grid gap-3">
          <label className="text-xs font-medium">Section key<input value={form.sectionKey} onChange={(e) => setForm((f) => ({ ...f, sectionKey: e.target.value }))} className="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label>
          <label className="text-xs font-medium">Section label<input value={form.sectionLabel} onChange={(e) => setForm((f) => ({ ...f, sectionLabel: e.target.value }))} className="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label>
          <label className="text-xs font-medium">Item label<input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label>
        </div>
      </EntityFormModal>
    </div>
  );
}

function TemplatesPanel() {
  const templates = useMasterStore((s) => s.templates);
  const addTemplate = useMasterStore((s) => s.addTemplate);
  const updateTemplate = useMasterStore((s) => s.updateTemplate);
  const deleteTemplate = useMasterStore((s) => s.deleteTemplate);
  const sorted = useMemo(() => [...templates].sort((a, b) => a.order - b.order), [templates]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MasterTemplateDef | null>(null);
  const [form, setForm] = useState({ name: "", category: "Legal", description: "", enabled: true, order: 1 });

  function openCreate() {
    setEditing(null);
    setForm({ name: "", category: "Legal", description: "", enabled: true, order: sorted.length + 1 });
    setModalOpen(true);
  }

  function openEdit(t: MasterTemplateDef) {
    setEditing(t);
    setForm({
      name: t.name,
      category: t.category,
      description: t.description ?? "",
      enabled: t.enabled,
      order: t.order,
    });
    setModalOpen(true);
  }

  function save() {
    if (!form.name.trim()) return toast.error("Name required");
    const payload = {
      name: form.name.trim(),
      category: form.category.trim(),
      description: form.description.trim() || undefined,
      enabled: form.enabled,
      order: form.order,
    };
    if (editing) {
      updateTemplate(editing.id, payload);
      toast.success("Template updated");
    } else {
      addTemplate(payload);
      toast.success("Template added");
    }
    setModalOpen(false);
  }

  return (
    <div className="space-y-4">
      <SectionHead
        title="Document Template Catalog"
        description="Canonical document names/categories offered during document setup."
        action={<Button size="sm" className="gap-1" onClick={openCreate}><Plus className="h-3.5 w-3.5" /> Add Template</Button>}
      />
      <div className="card-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="px-3 py-2">
                  <div className="font-medium">{t.name}</div>
                  {t.description && <div className="text-[11px] text-muted-foreground">{t.description}</div>}
                </td>
                <td className="px-3 py-2"><Pill tone="accent">{t.category}</Pill></td>
                <td className="px-3 py-2"><Pill tone={t.enabled ? "success" : "muted"}>{t.enabled ? "Enabled" : "Off"}</Pill></td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-0.5">
                  <MasterToggle enabled={t.enabled} onClick={() => updateTemplate(t.id, { enabled: !t.enabled })} />
                  <MasterIconButton label="Edit template" onClick={() => openEdit(t)}><Pencil /></MasterIconButton>
                  <MasterIconButton label="Delete template" destructive onClick={() => { deleteTemplate(t.id); toast.success("Deleted"); }}><Trash2 /></MasterIconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <EntityFormModal open={modalOpen} onOpenChange={setModalOpen} title={editing ? "Edit Template" : "Add Template"} onSubmit={save}>
        <div className="grid gap-3">
          <label className="text-xs font-medium">Name<input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label>
          <label className="text-xs font-medium">Category<input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label>
          <label className="text-xs font-medium">Description<textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="mt-1 min-h-[64px] w-full rounded-md border px-3 py-2 text-sm" /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} /> Enabled</label>
        </div>
      </EntityFormModal>
    </div>
  );
}

function ModulesPanel() {
  const modules = useMasterStore((s) => s.modules);
  const addModule = useMasterStore((s) => s.addModule);
  const updateModule = useMasterStore((s) => s.updateModule);
  const deleteModule = useMasterStore((s) => s.deleteModule);
  const sorted = useMemo(() => [...modules].sort((a, b) => a.order - b.order), [modules]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MasterModuleDef | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    key: "",
    label: "",
    description: "",
    icon: "Boxes",
    enabled: true,
  });

  function openCreate() {
    setEditing(null);
    setForm({ key: "", label: "", description: "", icon: "Boxes", enabled: true });
    setModalOpen(true);
  }

  function openEdit(m: MasterModuleDef) {
    setEditing(m);
    setForm({
      key: m.key,
      label: m.label,
      description: m.description,
      icon: m.icon,
      enabled: m.enabled,
    });
    setModalOpen(true);
  }

  function save() {
    if (!form.label.trim() || !form.key.trim()) {
      toast.error("Key and label required");
      return;
    }
    const payload = {
      key: form.key.trim(),
      label: form.label.trim(),
      description: form.description.trim() || "Custom module",
      icon: form.icon.trim() || "Boxes",
      enabled: form.enabled,
      order: editing?.order ?? modules.length + 1,
    };
    if (editing) {
      updateModule(editing.id, payload);
      toast.success("Module updated");
    } else {
      addModule(payload);
      toast.success("Module added");
    }
    setModalOpen(false);
  }

  return (
    <div className="space-y-4">
      <SectionHead
        title="Module Catalog"
        description="Full control over product modules offered when opting a company in."
        action={
          <Button size="sm" className="gap-1" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" /> Add Module
          </Button>
        }
      />
      <div className="grid gap-3 md:grid-cols-2">
        {sorted.map((m) => (
          <div key={m.id} className="card-soft p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{m.label}</div>
                <div className="font-mono text-[11px] text-muted-foreground">{m.key}</div>
              </div>
              <div className="flex items-center gap-0.5">
                <MasterToggle enabled={m.enabled} onClick={() => updateModule(m.id, { enabled: !m.enabled })} />
                <MasterIconButton label="Edit module" onClick={() => openEdit(m)}>
                  <Pencil />
                </MasterIconButton>
                <MasterIconButton label="Delete module" destructive onClick={() => setDeleteId(m.id)}>
                  <Trash2 />
                </MasterIconButton>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{m.description}</p>
            <div className="mt-2">
              <Pill tone={m.enabled ? "success" : "muted"}>{m.enabled ? "Available" : "Hidden"}</Pill>
            </div>
          </div>
        ))}
      </div>

      <EntityFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Edit Module" : "Add Module"}
        onSubmit={save}
      >
        <div className="grid gap-3">
          <label className="text-xs font-medium">
            Label
            <input
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
            />
          </label>
          <label className="text-xs font-medium">
            Key
            <input
              value={form.key}
              onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
              className="mt-1 h-9 w-full rounded-md border px-3 font-mono text-sm"
              placeholder="custom-module"
            />
          </label>
          <label className="text-xs font-medium">
            Description
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="mt-1 min-h-[64px] w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-medium">
            Icon name
            <input
              value={form.icon}
              onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              placeholder="Boxes"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
            />
            Enabled
          </label>
        </div>
      </EntityFormModal>

      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete module?"
        description="Companies that already opted into this module keep their records; it will no longer appear for new opt-ins."
        onConfirm={() => {
          if (deleteId) {
            deleteModule(deleteId);
            toast.success("Module deleted");
          }
          setDeleteId(null);
        }}
      />
    </div>
  );
}

function IntegrationsPanel() {
  const integrations = useMasterStore((s) => s.integrations);
  const triggers = useMasterStore((s) => s.triggers);
  const addIntegration = useMasterStore((s) => s.addIntegration);
  const updateIntegration = useMasterStore((s) => s.updateIntegration);
  const deleteIntegration = useMasterStore((s) => s.deleteIntegration);
  const updateTrigger = useMasterStore((s) => s.updateTrigger);
  const addTrigger = useMasterStore((s) => s.addTrigger);
  const deleteTrigger = useMasterStore((s) => s.deleteTrigger);
  const [modalOpen, setModalOpen] = useState(false);
  const [integrationModal, setIntegrationModal] = useState(false);
  const [form, setForm] = useState({ name: "", event: "", channel: "WhatsApp" });
  const [integrationForm, setIntegrationForm] = useState({ name: "", description: "", enabled: true });
  const [deleteIntegrationId, setDeleteIntegrationId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <SectionHead
          title="Integrations"
          description="Enable/disable connectors shown in the integrations workspace."
          action={
            <Button size="sm" className="gap-1" onClick={() => {
              setIntegrationForm({ name: "", description: "", enabled: true });
              setIntegrationModal(true);
            }}>
              <Plus className="h-3.5 w-3.5" /> Add Integration
            </Button>
          }
        />
        <div className="grid gap-3 md:grid-cols-2">
          {integrations.map((i) => (
            <div key={i.id} className="card-soft flex items-start gap-3 p-4">
              <div className="flex-1">
                <div className="font-medium">{i.name}</div>
                <p className="text-xs text-muted-foreground">{i.description}</p>
              </div>
              <div className="flex items-center gap-0.5">
                <MasterToggle enabled={i.enabled} onClick={() => updateIntegration(i.id, { enabled: !i.enabled })} />
                <MasterIconButton
                  label="Delete integration"
                  destructive
                  onClick={() => setDeleteIntegrationId(i.id)}
                >
                  <Trash2 />
                </MasterIconButton>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <SectionHead
          title="Notification Triggers"
          description="Event → channel mappings used by automations."
          action={<Button size="sm" className="gap-1" onClick={() => setModalOpen(true)}><Plus className="h-3.5 w-3.5" /> Add Trigger</Button>}
        />
        <div className="card-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Event</th>
                <th className="px-3 py-2 text-left">Channel</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {triggers.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{t.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{t.event}</td>
                  <td className="px-3 py-2"><Pill tone="accent">{t.channel}</Pill></td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-0.5">
                    <MasterToggle enabled={t.enabled} onClick={() => updateTrigger(t.id, { enabled: !t.enabled })} />
                    <MasterIconButton label="Delete trigger" destructive onClick={() => { deleteTrigger(t.id); toast.success("Deleted"); }}><Trash2 /></MasterIconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <EntityFormModal open={modalOpen} onOpenChange={setModalOpen} title="Add Trigger" onSubmit={() => {
        if (!form.name.trim() || !form.event.trim()) return toast.error("Name and event required");
        addTrigger({
          name: form.name.trim(),
          event: form.event.trim(),
          channel: form.channel,
          enabled: true,
          order: triggers.length + 1,
        });
        setModalOpen(false);
        setForm({ name: "", event: "", channel: "WhatsApp" });
        toast.success("Trigger added");
      }}>
        <div className="grid gap-3">
          <label className="text-xs font-medium">Name<input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label>
          <label className="text-xs font-medium">Event key<input value={form.event} onChange={(e) => setForm((f) => ({ ...f, event: e.target.value }))} className="mt-1 h-9 w-full rounded-md border px-3 font-mono text-sm" placeholder="payment.received" /></label>
          <label className="text-xs font-medium">Channel
            <select value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))} className="mt-1 h-9 w-full rounded-md border px-3 text-sm">
              {["WhatsApp", "SMS", "Email"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
        </div>
      </EntityFormModal>

      <EntityFormModal
        open={integrationModal}
        onOpenChange={setIntegrationModal}
        title="Add Integration"
        onSubmit={() => {
          if (!integrationForm.name.trim()) return toast.error("Name required");
          addIntegration({
            name: integrationForm.name.trim(),
            description: integrationForm.description.trim() || "Custom integration",
            enabled: integrationForm.enabled,
            order: integrations.length + 1,
          });
          setIntegrationModal(false);
          toast.success("Integration added");
        }}
      >
        <div className="grid gap-3">
          <label className="text-xs font-medium">
            Name
            <input
              value={integrationForm.name}
              onChange={(e) => setIntegrationForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
            />
          </label>
          <label className="text-xs font-medium">
            Description
            <textarea
              value={integrationForm.description}
              onChange={(e) => setIntegrationForm((f) => ({ ...f, description: e.target.value }))}
              className="mt-1 min-h-[64px] w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={integrationForm.enabled}
              onChange={(e) => setIntegrationForm((f) => ({ ...f, enabled: e.target.checked }))}
            />
            Enabled
          </label>
        </div>
      </EntityFormModal>

      <ConfirmDeleteDialog
        open={!!deleteIntegrationId}
        onOpenChange={(o) => !o && setDeleteIntegrationId(null)}
        title="Delete integration?"
        onConfirm={() => {
          if (deleteIntegrationId) {
            deleteIntegration(deleteIntegrationId);
            toast.success("Integration deleted");
          }
          setDeleteIntegrationId(null);
        }}
      />
    </div>
  );
}

function DangerPanel() {
  const resetSection = useMasterStore((s) => s.resetSection);
  const resetAll = useMasterStore((s) => s.resetAll);
  const [confirmAll, setConfirmAll] = useState(false);
  const sections: { id: MasterResetSection; label: string }[] = [
    { id: "platform", label: "Platform settings" },
    { id: "companyFields", label: "Company fields" },
    { id: "projectFields", label: "Project fields" },
    { id: "picklists", label: "Picklists" },
    { id: "workflowSteps", label: "Workflow steps" },
    { id: "checklistItems", label: "Checklist items" },
    { id: "templates", label: "Templates" },
    { id: "modules", label: "Modules" },
    { id: "integrations", label: "Integrations" },
    { id: "triggers", label: "Triggers" },
    { id: "inventoryItems", label: "Inventory items" },
  ];

  return (
    <div className="space-y-4">
      <SectionHead
        title="Reset & Safety"
        description="Restore seeded defaults for a section, or wipe the entire master catalog."
      />
      <div className="grid gap-2 md:grid-cols-2">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            className="card-soft flex items-center justify-between gap-3 p-4 text-left hover:bg-muted/40"
            onClick={() => {
              resetSection(s.id);
              toast.success(`Reset ${s.label}`);
            }}
          >
            <span className="text-sm font-medium">{s.label}</span>
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>
      <div className="card-soft border-destructive/30 bg-destructive/5 p-5">
        <h4 className="font-semibold text-destructive">Reset all master configuration</h4>
        <p className="mt-1 text-sm text-muted-foreground">
          Restores every catalog to factory seed. Operational company/project data is not deleted.
        </p>
        <Button variant="destructive" className="mt-3 gap-1.5" onClick={() => setConfirmAll(true)}>
          <RotateCcw className="h-4 w-4" /> Reset Everything
        </Button>
      </div>
      <ConfirmDeleteDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title="Reset all master config?"
        description="This restores every field, step, template, and picklist to defaults."
        confirmLabel="Reset all"
        onConfirm={() => {
          resetAll();
          setConfirmAll(false);
          toast.success("Master configuration restored");
        }}
      />
    </div>
  );
}

function SectionHead({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function MasterToggle({
  enabled,
  onClick,
}: {
  enabled: boolean;
  onClick: () => void;
}) {
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center">
      <Switch
        size="sm"
        checked={enabled}
        onCheckedChange={() => onClick()}
        aria-label={enabled ? "Disable" : "Enable"}
        title={enabled ? "Enabled — click to disable" : "Disabled — click to enable"}
      />
    </span>
  );
}

function MasterIconButton({
  onClick,
  label,
  destructive,
  children,
}: {
  onClick: () => void;
  label: string;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "h-9 w-9 shrink-0 [&_svg]:!size-4",
        destructive && "text-destructive hover:text-destructive",
      )}
    >
      {children}
    </Button>
  );
}
