import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  Boxes,
  Calendar,
  Database,
  GraduationCap,
  Link2,
  ListChecks,
  Pencil,
  Plus,
  ShieldAlert,
  Table2,
  Trash2,
  RotateCcw,
  Upload,
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
import { flushCrmMasterConfigPersistence } from "@/lib/config-persistence";
import { CRM_MODULE_PROVIDERS, CRM_INTEGRATION_MODULES, isCrmIntegrationModule } from "@/data/crm-onboarding-defaults";
import { normalizeCrmBookingHostHours } from "@/data/crm-booking-defaults";
import {
  ensureCrmMasterModulesCatalog,
  getCrmMasterBookingCallTypes,
  getCrmMasterBookingHostHours,
  getCrmMasterMigrationFields,
  getCrmMasterProductModuleCatalog,
  getCrmMasterTrainingFields,
} from "@/stores/useCrmMasterStore";
import { useAuthStore, useCrmMasterStore, useCrmOnboardingStore } from "@/stores";
import type {
  CrmBookingCallTypeDef,
  CrmBookingHostHoursDef,
  CrmMasterFieldDef,
  CrmMasterPicklist,
  CrmMigrationFieldDef,
  CrmTrainingFieldDef,
} from "@/types/crm-master";
import type { FieldValueType } from "@/types/master";
import type { CrmProductModuleKey } from "@/types/crm-onboarding";

export const Route = createFileRoute("/crm/master")({
  component: CrmMasterPage,
});

const SECTIONS = [
  { id: "overview", label: "Overview", icon: Database },
  { id: "account-fields", label: "Account Fields", icon: Building2 },
  { id: "project-fields", label: "Project Fields", icon: Boxes },
  { id: "picklists", label: "Picklists", icon: ListChecks },
  { id: "integrations", label: "Integrations", icon: Link2 },
  { id: "migration", label: "Migration", icon: Upload },
  { id: "training", label: "Training", icon: GraduationCap },
  { id: "bookings", label: "Meetings", icon: Calendar },
  { id: "data-control", label: "Data Control", icon: Table2 },
  { id: "danger", label: "Reset & Safety", icon: ShieldAlert },
] as const;

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

  useEffect(() => {
    if (user?.role === "Admin") {
      flushCrmMasterConfigPersistence();
    }
  }, [user?.role]);

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
            {section === "integrations" ? <IntegrationsPanel /> : null}
            {section === "migration" ? <MigrationPanel /> : null}
            {section === "training" ? <TrainingPanel /> : null}
            {section === "bookings" ? <BookingsPanel /> : null}
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
  const migrationFields = useCrmMasterStore((s) => s.migrationFields);
  const trainingFieldsDeveloper = useCrmMasterStore((s) => s.trainingFieldsDeveloper);
  const trainingFieldsBroker = useCrmMasterStore((s) => s.trainingFieldsBroker);
  const bookingCallTypes = useCrmMasterStore((s) => s.bookingCallTypes);

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
      label: "Integrations",
      value: modules.filter((m) => isCrmIntegrationModule(m.key) && m.enabled).length,
      total: CRM_INTEGRATION_MODULES.length,
      to: "integrations" as const,
    },
    {
      label: "Migration",
      value: migrationFields?.length ?? getCrmMasterMigrationFields().length,
      total: "checklist fields",
      to: "migration" as const,
    },
    {
      label: "Training",
      value:
        (trainingFieldsDeveloper?.length ?? getCrmMasterTrainingFields("developer").length) +
        (trainingFieldsBroker?.length ?? getCrmMasterTrainingFields("broker_cp").length),
      total: "catalog items",
      to: "training" as const,
    },
    {
      label: "Meetings",
      value: (bookingCallTypes?.length ?? getCrmMasterBookingCallTypes().length),
      total: "call types · host hours",
      to: "bookings" as const,
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

function IntegrationsPanel() {
  const modules = useCrmMasterStore((s) => s.modules);
  const updateModule = useCrmMasterStore((s) => s.updateModule);
  const moduleProviders = useCrmMasterStore((s) => s.moduleProviders);
  const setModuleProviders = useCrmMasterStore((s) => s.setModuleProviders);
  const applyToAllAccounts = useCrmOnboardingStore((s) => s.applyProductModulesCatalogToAllAccounts);
  const accountCount = useCrmOnboardingStore((s) => s.records.length);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    ensureCrmMasterModulesCatalog();
  }, []);

  const integrationModules = useMemo(
    () =>
      modules
        .filter((m) => isCrmIntegrationModule(m.key))
        .slice()
        .sort((a, b) => a.order - b.order),
    [modules],
  );

  const enabledCount = integrationModules.filter((m) => m.enabled).length;

  function providersFor(key: string) {
    const fromStore = moduleProviders?.[key];
    if (fromStore && fromStore.length > 0) return fromStore;
    return CRM_MODULE_PROVIDERS[key as CrmProductModuleKey] ?? [];
  }

  function renameProvider(moduleKey: string, index: number, next: string) {
    const list = [...providersFor(moduleKey)];
    list[index] = next;
    setModuleProviders(moduleKey, list);
  }

  function removeProvider(moduleKey: string, index: number) {
    const list = providersFor(moduleKey).filter((_, i) => i !== index);
    setModuleProviders(moduleKey, list);
    toast.success("Provider removed");
  }

  function addProvider(moduleKey: string) {
    const value = (drafts[moduleKey] ?? "").trim();
    if (!value) {
      toast.error("Enter a provider name");
      return;
    }
    const list = providersFor(moduleKey);
    if (list.some((p) => p.toLowerCase() === value.toLowerCase())) {
      toast.error("Provider already exists");
      return;
    }
    setModuleProviders(moduleKey, [...list, value]);
    setDrafts((d) => ({ ...d, [moduleKey]: "" }));
    toast.success(`Added ${value}`);
  }

  function syncForMe() {
    flushCrmMasterConfigPersistence();
    toast.success("Integration catalog saved", {
      description:
        "Synced to server for all admins. Account records update when each account is opened.",
    });
  }

  function syncForAll() {
    flushCrmMasterConfigPersistence();
    const updated = applyToAllAccounts();
    toast.success("Integration catalog applied to all accounts", {
      description:
        updated > 0
          ? `Updated ${updated} of ${accountCount} CRM account onboarding record(s).`
          : `All ${accountCount} account(s) already matched the master catalog.`,
    });
  }

  return (
    <div className="space-y-2.5">
      <div>
        <h3 className="text-sm font-semibold">Integrations</h3>
        <p className="text-[10px] text-muted-foreground">
          Enable integrations for account onboarding and manage vendor/provider options shown when
          configuring each integration on an account.
        </p>
      </div>

      <div className="card-soft flex flex-col gap-2 border border-primary/20 bg-primary/5 p-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground">{enabledCount}</span> of{" "}
          {integrationModules.length} integration(s) enabled ·{" "}
          <span className="font-medium text-foreground">{accountCount}</span> CRM account(s)
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={syncForMe}>
            Update for me
          </Button>
          <Button type="button" size="sm" className="h-7 text-xs" onClick={syncForAll}>
            Update for all
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        {integrationModules.map((m) => (
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

      {integrationModules
        .filter((m) => m.enabled)
        .map((mod) => (
          <div key={mod.key} className="card-soft space-y-2 p-3">
            <div>
              <h4 className="text-xs font-semibold">{mod.label} providers</h4>
              <p className="text-[10px] text-muted-foreground">
                Vendor options shown on account Integrations when configuring this integration.
              </p>
            </div>
            <div className="space-y-1">
              {providersFor(mod.key).map((provider, index) => (
                <div key={`${mod.key}-${index}`} className="flex items-center gap-1.5">
                  <input
                    value={provider}
                    onChange={(e) => renameProvider(mod.key, index, e.target.value)}
                    className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 p-0 text-destructive"
                    onClick={() => removeProvider(mod.key, index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <input
                value={drafts[mod.key] ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [mod.key]: e.target.value }))}
                placeholder="Add provider…"
                className="h-8 min-w-[10rem] flex-1 rounded-md border bg-background px-2 text-xs"
              />
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={() => addProvider(mod.key)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>
          </div>
        ))}
    </div>
  );
}

function MigrationPanel() {
  const migrationFields = useCrmMasterStore((s) => s.migrationFields);
  const setMigrationFields = useCrmMasterStore((s) => s.setMigrationFields);
  const fields = useMemo(
    () => (migrationFields?.length ? migrationFields : getCrmMasterMigrationFields()),
    [migrationFields],
  );
  const [draftLabel, setDraftLabel] = useState("");
  const [draftCategory, setDraftCategory] = useState("CRM data");

  function slugify(label: string) {
    return label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  }

  function updateField(index: number, patch: Partial<CrmMigrationFieldDef>) {
    const next = fields.map((f, i) => (i === index ? { ...f, ...patch } : f));
    setMigrationFields(next);
  }

  function removeField(index: number) {
    setMigrationFields(fields.filter((_, i) => i !== index));
    toast.success("Migration field removed");
  }

  function addField() {
    const label = draftLabel.trim();
    if (!label) {
      toast.error("Enter a field label");
      return;
    }
    const key = slugify(label);
    if (!key) {
      toast.error("Label must include letters or numbers");
      return;
    }
    if (fields.some((f) => f.key === key)) {
      toast.error("A field with this key already exists");
      return;
    }
    setMigrationFields([
      ...fields,
      { key, label, category: draftCategory.trim() || "CRM data" },
    ]);
    setDraftLabel("");
    toast.success(`Added ${label}`);
  }

  const categories = useMemo(() => {
    const preferred = ["CRM data", "Project and property"];
    const seen = new Set(preferred);
    const extra = fields.map((f) => f.category).filter((c) => c && !seen.has(c));
    return [...preferred, ...Array.from(new Set(extra))];
  }, [fields]);

  return (
    <div className="space-y-2.5">
      <div>
        <h3 className="text-sm font-semibold">Migration checklist fields</h3>
        <p className="text-[10px] text-muted-foreground">
          Controls which datasets appear on account Data Migration. Default is CRM data plus Project
          and property. Changes sync to accounts the next time their onboarding record is opened.
        </p>
      </div>

      <div className="card-soft space-y-2 p-2.5">
        <div className="grid gap-1.5 sm:grid-cols-[1fr_1fr_auto]">
          <input
            className="h-7 rounded-md border bg-background px-2 text-xs"
            placeholder="New field label"
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addField();
              }
            }}
          />
          <input
            className="h-7 rounded-md border bg-background px-2 text-xs"
            list="crm-migration-categories"
            placeholder="Category"
            value={draftCategory}
            onChange={(e) => setDraftCategory(e.target.value)}
          />
          <datalist id="crm-migration-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
            onClick={addField}
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>

        <div className="space-y-1">
          {fields.map((field, index) => (
            <div
              key={field.key}
              className="flex flex-col gap-1.5 rounded-md border bg-background/60 p-2 sm:flex-row sm:items-center"
            >
              <input
                className="h-7 flex-1 rounded-md border bg-background px-2 text-xs"
                value={field.label}
                onChange={(e) => updateField(index, { label: e.target.value })}
                onBlur={(e) => {
                  if (!e.target.value.trim()) removeField(index);
                }}
              />
              <input
                className="h-7 w-full rounded-md border bg-background px-2 text-xs sm:w-44"
                list="crm-migration-categories"
                value={field.category}
                onChange={(e) => updateField(index, { category: e.target.value })}
              />
              <span className="truncate text-[10px] text-muted-foreground sm:w-28" title={field.key}>
                {field.key}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeField(index)}
                aria-label={`Remove ${field.label}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {fields.length === 0 ? (
            <p className="py-3 text-center text-[10px] text-muted-foreground">
              No migration fields. Add at least one, or reset Master to restore defaults.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TrainingPanel() {
  const trainingFieldsDeveloper = useCrmMasterStore((s) => s.trainingFieldsDeveloper);
  const trainingFieldsBroker = useCrmMasterStore((s) => s.trainingFieldsBroker);
  const setTrainingFields = useCrmMasterStore((s) => s.setTrainingFields);
  const [track, setTrack] = useState<"developer" | "broker_cp">("developer");
  const [draftLabel, setDraftLabel] = useState("");
  const [draftCategory, setDraftCategory] = useState("Admin");

  const fields = useMemo(() => {
    if (track === "broker_cp") {
      return Array.isArray(trainingFieldsBroker)
        ? trainingFieldsBroker
        : getCrmMasterTrainingFields("broker_cp");
    }
    return Array.isArray(trainingFieldsDeveloper)
      ? trainingFieldsDeveloper
      : getCrmMasterTrainingFields("developer");
  }, [track, trainingFieldsDeveloper, trainingFieldsBroker]);

  function slugify(label: string) {
    return label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  }

  function updateField(index: number, patch: Partial<CrmTrainingFieldDef>) {
    const next = fields.map((f, i) => (i === index ? { ...f, ...patch } : f));
    setTrainingFields(track, next);
  }

  function removeField(index: number) {
    setTrainingFields(
      track,
      fields.filter((_, i) => i !== index),
    );
    toast.success("Training field removed");
  }

  function addField() {
    const label = draftLabel.trim();
    if (!label) {
      toast.error("Enter a training label");
      return;
    }
    const key = slugify(label);
    if (!key) {
      toast.error("Label must include letters or numbers");
      return;
    }
    if (fields.some((f) => f.key === key)) {
      toast.error("A training item with this key already exists");
      return;
    }
    setTrainingFields(track, [
      ...fields,
      { key, label, category: draftCategory.trim() || "Custom" },
    ]);
    setDraftLabel("");
    toast.success(`Added ${label}`);
  }

  const categories = useMemo(() => {
    const preferred =
      track === "broker_cp"
        ? ["Admin", "Sales process", "Operations", "Product", "Custom"]
        : ["Admin", "Sales roles", "Front office", "Product modules", "Integrations", "Custom"];
    const seen = new Set(preferred);
    const extra = fields.map((f) => f.category).filter((c) => c && !seen.has(c));
    return [...preferred, ...Array.from(new Set(extra))];
  }, [fields, track]);

  return (
    <div className="space-y-2.5">
      <div>
        <h3 className="text-sm font-semibold">Training catalog</h3>
        <p className="text-[10px] text-muted-foreground">
          Controls which sessions appear on account Training. Includes Admin Training by default.
          Changes sync when an account onboarding record is opened.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { id: "developer" as const, label: "Developer" },
            { id: "broker_cp" as const, label: "Broker / CP" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTrack(t.id);
              setDraftCategory("Admin");
            }}
            className={cn(
              "rounded-md border px-2.5 py-1 text-[10px] font-medium transition-colors",
              track === t.id
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card-soft space-y-2 p-2.5">
        <div className="grid gap-1.5 sm:grid-cols-[1fr_1fr_auto]">
          <input
            className="h-7 rounded-md border bg-background px-2 text-xs"
            placeholder="New training label"
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addField();
              }
            }}
          />
          <input
            className="h-7 rounded-md border bg-background px-2 text-xs"
            list={`crm-training-categories-${track}`}
            placeholder="Category"
            value={draftCategory}
            onChange={(e) => setDraftCategory(e.target.value)}
          />
          <datalist id={`crm-training-categories-${track}`}>
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
            onClick={addField}
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>

        <div className="space-y-1">
          {fields.map((field, index) => (
            <div
              key={field.key}
              className="flex flex-col gap-1.5 rounded-md border bg-background/60 p-2 sm:flex-row sm:items-center"
            >
              <input
                className="h-7 flex-1 rounded-md border bg-background px-2 text-xs"
                value={field.label}
                onChange={(e) => updateField(index, { label: e.target.value })}
                onBlur={(e) => {
                  if (!e.target.value.trim()) removeField(index);
                }}
              />
              <input
                className="h-7 w-full rounded-md border bg-background px-2 text-xs sm:w-44"
                list={`crm-training-categories-${track}`}
                value={field.category}
                onChange={(e) => updateField(index, { category: e.target.value })}
              />
              <span className="truncate text-[10px] text-muted-foreground sm:w-28" title={field.key}>
                {field.key}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeField(index)}
                aria-label={`Remove ${field.label}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {fields.length === 0 ? (
            <p className="py-3 text-center text-[10px] text-muted-foreground">
              No training items. Add at least one, or reset Master to restore defaults.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function BookingsPanel() {
  const bookingCallTypes = useCrmMasterStore((s) => s.bookingCallTypes);
  const bookingHostHours = useCrmMasterStore((s) => s.bookingHostHours);
  const setBookingCallTypes = useCrmMasterStore((s) => s.setBookingCallTypes);
  const setBookingHostHours = useCrmMasterStore((s) => s.setBookingHostHours);

  const callTypes = useMemo(
    () =>
      Array.isArray(bookingCallTypes) && bookingCallTypes.length > 0
        ? bookingCallTypes
        : getCrmMasterBookingCallTypes(),
    [bookingCallTypes],
  );
  const hostHours = useMemo(
    () => normalizeCrmBookingHostHours(bookingHostHours),
    [bookingHostHours],
  );

  const [draftLabel, setDraftLabel] = useState("");
  const [draftDuration, setDraftDuration] = useState("15");
  const [draftCustom, setDraftCustom] = useState(false);

  function updateCallType(index: number, patch: Partial<CrmBookingCallTypeDef>) {
    const next = callTypes.map((row, i) => (i === index ? { ...row, ...patch } : row));
    setBookingCallTypes(next);
  }

  function removeCallType(index: number) {
    setBookingCallTypes(callTypes.filter((_, i) => i !== index));
  }

  function addCallType() {
    const label = draftLabel.trim();
    if (!label) {
      toast.error("Enter a call type label");
      return;
    }
    const key = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    if (!key) {
      toast.error("Label must include letters or numbers");
      return;
    }
    if (callTypes.some((c) => c.key === key)) {
      toast.error("A call type with this key already exists");
      return;
    }
    const durationMinutes = Math.max(5, Number(draftDuration) || 15);
    setBookingCallTypes([
      ...callTypes,
      {
        key,
        label,
        durationMinutes,
        allowsCustomDuration: draftCustom,
        isActive: true,
        order: callTypes.length + 1,
      },
    ]);
    setDraftLabel("");
    setDraftDuration("15");
    setDraftCustom(false);
    toast.success("Call type added");
  }

  useEffect(() => {
    const normalized = normalizeCrmBookingHostHours(bookingHostHours);
    if (JSON.stringify(normalized) !== JSON.stringify(bookingHostHours ?? [])) {
      setBookingHostHours(normalized);
    }
  }, [bookingHostHours, setBookingHostHours]);

  function updateHostHour(weekday: number, patch: Partial<CrmBookingHostHoursDef>) {
    const next = hostHours.map((row) => (row.weekday === weekday ? { ...row, ...patch } : row));
    setBookingHostHours(next);
  }

  return (
    <div className="space-y-3">
      <div className="card-soft space-y-3 p-3">
        <div>
          <h3 className="text-sm font-semibold">Call types</h3>
          <p className="text-[10px] text-muted-foreground">
            Durations drive open portal slots (Query 15m, Training 30m, Other custom). Changes apply
            when meeting defaults sync for an account.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <input
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            placeholder="New call type"
            className="h-8 min-w-[10rem] flex-1 rounded-md border bg-background px-2 text-xs"
          />
          <input
            type="number"
            min={5}
            step={5}
            value={draftDuration}
            onChange={(e) => setDraftDuration(e.target.value)}
            className="h-8 w-20 rounded-md border bg-background px-2 text-xs"
            aria-label="Duration minutes"
          />
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <input
              type="checkbox"
              checked={draftCustom}
              onChange={(e) => setDraftCustom(e.target.checked)}
            />
            Custom duration
          </label>
          <Button type="button" size="sm" className="h-8 gap-1 text-xs" onClick={addCallType}>
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>

        <div className="divide-y rounded-md border">
          {callTypes.map((field, index) => (
            <div key={field.key} className="flex flex-wrap items-center gap-2 px-2.5 py-2">
              <input
                value={field.label}
                onChange={(e) => updateCallType(index, { label: e.target.value })}
                className="h-7 min-w-[8rem] flex-1 rounded-md border bg-background px-2 text-xs"
              />
              <input
                type="number"
                min={5}
                step={5}
                value={field.durationMinutes}
                onChange={(e) =>
                  updateCallType(index, {
                    durationMinutes: Math.max(5, Number(e.target.value) || 15),
                  })
                }
                className="h-7 w-16 rounded-md border bg-background px-2 text-xs"
                aria-label={`${field.label} duration`}
              />
              <span className="text-[10px] text-muted-foreground">min</span>
              <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={field.allowsCustomDuration}
                  onChange={(e) =>
                    updateCallType(index, { allowsCustomDuration: e.target.checked })
                  }
                />
                Other/specify
              </label>
              <Switch
                checked={field.isActive}
                onCheckedChange={(checked) => updateCallType(index, { isActive: checked })}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeCallType(index)}
                aria-label={`Remove ${field.label}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {callTypes.length === 0 ? (
            <p className="py-3 text-center text-[10px] text-muted-foreground">
              No call types. Add at least one, or reset Master to restore defaults.
            </p>
          ) : null}
        </div>
      </div>

      <div className="card-soft space-y-3 p-3">
        <div>
          <h3 className="text-sm font-semibold">Executive weekly hours</h3>
          <p className="text-[10px] text-muted-foreground">
            Default availability seeded for hosts who have no windows yet. Executives can still
            refine hours under CRM → Meetings → Availability.
          </p>
        </div>
        <div className="divide-y rounded-md border">
          {hostHours
            .filter((row) => row.weekday >= 1 && row.weekday <= 6)
            .map((row) => (
            <div key={row.weekday} className="flex flex-wrap items-center gap-2 px-2.5 py-2">
              <div className="w-10 text-xs font-medium">{WEEKDAY_LABELS[row.weekday]}</div>
              <Switch
                checked={row.enabled}
                onCheckedChange={(checked) => updateHostHour(row.weekday, { enabled: checked })}
              />
              <input
                type="time"
                value={row.startTime}
                disabled={!row.enabled}
                onChange={(e) => updateHostHour(row.weekday, { startTime: e.target.value })}
                className="h-7 rounded-md border bg-background px-2 text-xs disabled:opacity-50"
              />
              <span className="text-[10px] text-muted-foreground">to</span>
              <input
                type="time"
                value={row.endTime}
                disabled={!row.enabled}
                onChange={(e) => updateHostHour(row.weekday, { endTime: e.target.value })}
                className="h-7 rounded-md border bg-background px-2 text-xs disabled:opacity-50"
              />
            </div>
          ))}
        </div>
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
          Restores seeded account fields, project fields, picklists, modules, providers, migration,
          training, and meeting catalogs. Does not delete CRM accounts or onboarding checklists.
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
        description="All field catalogs, picklists, modules, providers, migration, training, and meeting fields will revert to seed defaults."
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
