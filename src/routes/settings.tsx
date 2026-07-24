import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  Building2,
  Download,
  FileSpreadsheet,
  FileText,
  Monitor,
  Palette,
  Pencil,
  Plus,
  Shield,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDeleteDialog, EntityFormModal } from "@/components/entity-form-modal";
import { PageHeader, PageWrap } from "@/components/page-header";
import { RolesPermissionsPanel } from "@/components/roles-permissions-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuthStore, useSettingsStore, useUserStore } from "@/stores";
import { createUser as apiCreateUser, setUserPassword as apiSetUserPassword, updateUser as apiUpdateUser } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ThemeMode } from "@/lib/theme";
import {
  type DocumentSettings,
  type ExcelTemplateSetting,
  type NotificationSettings,
  type OrgSettings,
  type PaymentPlanPreset,
  type User,
} from "@/types";

type SectionId =
  | "appearance"
  | "company"
  | "notifications"
  | "documents"
  | "excel"
  | "payments"
  | "roles"
  | "users";

const SECTION_IDS: SectionId[] = [
  "appearance",
  "company",
  "notifications",
  "documents",
  "excel",
  "payments",
  "roles",
  "users",
];

export const Route = createFileRoute("/settings")({
  validateSearch: (search: Record<string, unknown>) => ({
    section: SECTION_IDS.includes(search.section as SectionId)
      ? (search.section as SectionId)
      : (undefined as SectionId | undefined),
    invite: Boolean(search.invite === true || search.invite === "true" || search.invite === "1"),
  }),
  component: Settings,
});

const SECTIONS: {
  id: SectionId;
  title: string;
  desc: string;
  icon: typeof Building2;
  adminOnly?: boolean;
  requiresManageSettings?: boolean;
}[] = [
  { id: "appearance", title: "Appearance", desc: "Light and dark theme for the whole app.", icon: Palette },
  { id: "company", title: "Company Settings", desc: "Legal name, GST, branding, timezone.", icon: Building2, requiresManageSettings: true },
  { id: "notifications", title: "Email & Notifications", desc: "SMTP, digest cadence, event alerts.", icon: Bell, requiresManageSettings: true },
  { id: "documents", title: "Document Settings", desc: "Default formats & signatories.", icon: FileText, requiresManageSettings: true },
  { id: "excel", title: "Excel Templates", desc: "Manage import templates & samples.", icon: FileSpreadsheet, requiresManageSettings: true },
  { id: "payments", title: "Payment Plan Settings", desc: "Base plans and installment presets.", icon: Wallet, requiresManageSettings: true },
  { id: "roles", title: "Roles & Permissions", desc: "Create roles and configure access.", icon: Shield, adminOnly: true },
  { id: "users", title: "User Management", desc: "Invite, deactivate and audit users.", icon: Users, adminOnly: true },
];

function canAccessSettingsSection(
  section: (typeof SECTIONS)[number],
  ctx: { isAdmin: boolean; can: (key: "manageSettings") => boolean },
) {
  if (section.adminOnly) return ctx.isAdmin;
  if (section.requiresManageSettings) return ctx.isAdmin || ctx.can("manageSettings");
  return true;
}

const FIELD =
  "mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/25";

function Settings() {
  const navigate = useNavigate({ from: "/settings" });
  const search = Route.useSearch();
  const { isAdmin, can } = usePermissions();
  const [section, setSection] = useState<SectionId | null>(search.section ?? null);

  const visibleSections = SECTIONS.filter((s) =>
    canAccessSettingsSection(s, { isAdmin, can }),
  );

  useEffect(() => {
    if (search.section) {
      const target = SECTIONS.find((s) => s.id === search.section);
      if (target && canAccessSettingsSection(target, { isAdmin, can })) {
        setSection(search.section);
      } else if (search.section) {
        setSection(null);
        void navigate({ search: { section: undefined, invite: false }, replace: true });
      }
    }
  }, [search.section, isAdmin, can, navigate]);

  function openSection(next: SectionId | null) {
    setSection(next);
    void navigate({
      search: { section: next ?? undefined, invite: false },
      replace: true,
    });
  }

  return (
    <PageWrap>
      <PageHeader title="Settings" subtitle="Configure the tracker to match your workflow." />
      {!section ? (
        <div className="grid gap-3 md:grid-cols-2">
          {visibleSections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => openSection(s.id)}
              className="card-soft flex gap-4 p-5 text-left transition-shadow hover:shadow-[var(--shadow-elevated)]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">{s.title}</div>
                <div className="text-sm text-muted-foreground">{s.desc}</div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div>
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => openSection(null)}>
            ← Back to Settings
          </Button>
          {section === "appearance" && <AppearanceSection />}
          {section === "company" && (isAdmin || can("manageSettings")) && <CompanySection />}
          {section === "notifications" && (isAdmin || can("manageSettings")) && <NotificationsSection />}
          {section === "documents" && (isAdmin || can("manageSettings")) && <DocumentsSection />}
          {section === "excel" && (isAdmin || can("manageSettings")) && <ExcelSection />}
          {section === "payments" && (isAdmin || can("manageSettings")) && <PaymentsSection />}
          {section === "roles" && isAdmin && <RolesPermissionsPanel />}
          {section === "users" && isAdmin && (
            <UsersSection initialInviteOpen={Boolean(search.invite)} />
          )}
        </div>
      )}
    </PageWrap>
  );
}

function AppearanceSection() {
  const { mode, resolved, setMode } = useTheme();

  const options: { id: ThemeMode; label: string; desc: string; icon: typeof Monitor }[] = [
    { id: "light", label: "Light", desc: "Bright surfaces, high clarity for daytime work.", icon: Palette },
    { id: "dark", label: "Dark", desc: "Low-glare navy surfaces for long sessions.", icon: Palette },
    { id: "system", label: "System", desc: "Follow your OS preference automatically.", icon: Monitor },
  ];

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Appearance"
        subtitle="Theme applies across every screen, control, and chart — contrast is tuned for both modes."
      />

      <div className="card-soft flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <div className="text-sm font-semibold">Quick switch</div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Currently {resolved} · preference: {mode}
          </p>
        </div>
        <ThemeToggle />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((opt) => {
          const active = mode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setMode(opt.id, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
              }}
              className={cn(
                "card-soft p-4 text-left transition-all",
                active
                  ? "ring-2 ring-primary/50 shadow-[var(--shadow-elevated)]"
                  : "hover:border-primary/30",
              )}
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <opt.icon className="h-4 w-4" />
              </div>
              <div className="font-semibold">{opt.label}</div>
              <p className="mt-1 text-xs text-muted-foreground">{opt.desc}</p>
              {active && (
                <span className="mt-3 inline-flex text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Active
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block text-xs font-medium", className)}>
      {label}
      {children}
    </label>
  );
}

function CompanySection() {
  const org = useSettingsStore((s) => s.org);
  const updateOrg = useSettingsStore((s) => s.updateOrg);
  const [form, setForm] = useState<OrgSettings>(org);

  useEffect(() => setForm(org), [org]);

  function save() {
    if (!form.legalName.trim() || !form.tradeName.trim()) {
      toast.error("Legal name and trade name are required");
      return;
    }
    updateOrg({
      ...form,
      legalName: form.legalName.trim(),
      tradeName: form.tradeName.trim(),
      gstNumber: form.gstNumber.trim(),
      supportEmail: form.supportEmail.trim(),
    });
    toast.success("Company settings saved");
  }

  return (
    <div className="card-soft p-5">
      <SectionTitle title="Company Settings" subtitle="Organization identity used on documents and notifications." />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Legal name">
          <input className={FIELD} value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
        </Field>
        <Field label="Trade name">
          <input className={FIELD} value={form.tradeName} onChange={(e) => setForm({ ...form, tradeName: e.target.value })} />
        </Field>
        <Field label="GST number">
          <input className={FIELD} value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
        </Field>
        <Field label="Brand primary color">
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              className="h-9 w-12 cursor-pointer rounded border"
              value={form.brandPrimary}
              onChange={(e) => setForm({ ...form, brandPrimary: e.target.value })}
            />
            <input
              className={cn(FIELD, "mt-0 flex-1")}
              value={form.brandPrimary}
              onChange={(e) => setForm({ ...form, brandPrimary: e.target.value })}
            />
          </div>
        </Field>
        <Field label="Registered address" className="sm:col-span-2">
          <textarea
            className={cn(FIELD, "h-auto min-h-[72px] py-2")}
            value={form.registeredAddress}
            onChange={(e) => setForm({ ...form, registeredAddress: e.target.value })}
          />
        </Field>
        <Field label="Timezone">
          <select className={FIELD} value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
            {["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York"].map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </Field>
        <Field label="Locale">
          <select className={FIELD} value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })}>
            {["en-IN", "en-US", "en-GB"].map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Currency">
          <select className={FIELD} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
            {["INR", "USD", "AED", "SGD"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Fiscal year start (MM-DD)">
          <input className={FIELD} value={form.fiscalYearStart} onChange={(e) => setForm({ ...form, fiscalYearStart: e.target.value })} />
        </Field>
        <Field label="Support email">
          <input type="email" className={FIELD} value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} />
        </Field>
        <Field label="Support phone">
          <input className={FIELD} value={form.supportPhone} onChange={(e) => setForm({ ...form, supportPhone: e.target.value })} />
        </Field>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={save}>Save Company Settings</Button>
      </div>
    </div>
  );
}

function NotificationsSection() {
  const notifications = useSettingsStore((s) => s.notifications);
  const updateNotifications = useSettingsStore((s) => s.updateNotifications);
  const [form, setForm] = useState<NotificationSettings>(notifications);

  useEffect(() => setForm(notifications), [notifications]);

  function save() {
    if (!form.smtpHost.trim() || !form.smtpFromEmail.trim()) {
      toast.error("SMTP host and from email are required");
      return;
    }
    updateNotifications({
      ...form,
      smtpHost: form.smtpHost.trim(),
      smtpUser: form.smtpUser.trim(),
      smtpFromName: form.smtpFromName.trim(),
      smtpFromEmail: form.smtpFromEmail.trim(),
      smtpPort: Number(form.smtpPort) || 587,
      digestHour: Math.min(23, Math.max(0, Number(form.digestHour) || 0)),
    });
    toast.success("Email & notification settings saved");
  }

  const eventToggles: { key: keyof NotificationSettings; label: string; desc: string }[] = [
    { key: "notifyOnApprovals", label: "Approvals", desc: "When Post Sales steps are approved or rejected" },
    { key: "notifyOnTicketUpdates", label: "Ticket updates", desc: "New comments and status changes" },
    { key: "notifyOnRenewals", label: "Renewals", desc: "Upcoming and overdue renewals" },
    { key: "notifyOnGoLive", label: "Go-live", desc: "When a project is marked go-live" },
  ];

  return (
    <div className="space-y-4">
      <div className="card-soft p-5">
        <SectionTitle title="SMTP Configuration" subtitle="Outbound mail used for digests and alerts (prototype — values are stored locally)." />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="SMTP host">
            <input className={FIELD} value={form.smtpHost} onChange={(e) => setForm({ ...form, smtpHost: e.target.value })} />
          </Field>
          <Field label="Port">
            <input
              type="number"
              className={FIELD}
              value={form.smtpPort}
              onChange={(e) => setForm({ ...form, smtpPort: Number(e.target.value) })}
            />
          </Field>
          <Field label="SMTP user">
            <input className={FIELD} value={form.smtpUser} onChange={(e) => setForm({ ...form, smtpUser: e.target.value })} />
          </Field>
          <Field label="From name">
            <input className={FIELD} value={form.smtpFromName} onChange={(e) => setForm({ ...form, smtpFromName: e.target.value })} />
          </Field>
          <Field label="From email" className="sm:col-span-2">
            <input
              type="email"
              className={FIELD}
              value={form.smtpFromEmail}
              onChange={(e) => setForm({ ...form, smtpFromEmail: e.target.value })}
            />
          </Field>
        </div>
      </div>

      <div className="card-soft p-5">
        <SectionTitle title="Digest & Quiet Hours" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Digest cadence">
            <select
              className={FIELD}
              value={form.digestCadence}
              onChange={(e) => setForm({ ...form, digestCadence: e.target.value as NotificationSettings["digestCadence"] })}
            >
              <option value="off">Off</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </Field>
          <Field label="Digest hour (0–23)">
            <input
              type="number"
              min={0}
              max={23}
              className={FIELD}
              value={form.digestHour}
              onChange={(e) => setForm({ ...form, digestHour: Number(e.target.value) })}
            />
          </Field>
          <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
            <div>
              <div className="text-sm font-medium">Quiet hours</div>
              <div className="text-xs text-muted-foreground">Suppress non-critical emails overnight</div>
            </div>
            <Switch
              checked={form.quietHoursEnabled}
              onCheckedChange={(v) => setForm({ ...form, quietHoursEnabled: v })}
            />
          </div>
          {form.quietHoursEnabled && (
            <>
              <Field label="Quiet hours start">
                <input
                  type="time"
                  className={FIELD}
                  value={form.quietHoursStart}
                  onChange={(e) => setForm({ ...form, quietHoursStart: e.target.value })}
                />
              </Field>
              <Field label="Quiet hours end">
                <input
                  type="time"
                  className={FIELD}
                  value={form.quietHoursEnd}
                  onChange={(e) => setForm({ ...form, quietHoursEnd: e.target.value })}
                />
              </Field>
            </>
          )}
        </div>
      </div>

      <div className="card-soft p-5">
        <SectionTitle title="Event Notifications" />
        <div className="space-y-2">
          {eventToggles.map((t) => (
            <div key={t.key} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">{t.label}</div>
                <div className="text-xs text-muted-foreground">{t.desc}</div>
              </div>
              <Switch
                checked={Boolean(form[t.key])}
                onCheckedChange={(v) => setForm({ ...form, [t.key]: v })}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={save}>Save Notification Settings</Button>
        </div>
      </div>
    </div>
  );
}

function DocumentsSection() {
  const documents = useSettingsStore((s) => s.documents);
  const updateDocuments = useSettingsStore((s) => s.updateDocuments);
  const [form, setForm] = useState<DocumentSettings>(documents);

  useEffect(() => setForm(documents), [documents]);

  function save() {
    if (!form.defaultSignatory.trim()) {
      toast.error("Default signatory is required");
      return;
    }
    updateDocuments({
      ...form,
      defaultSignatory: form.defaultSignatory.trim(),
      signatoryTitle: form.signatoryTitle.trim(),
      footerText: form.footerText.trim(),
      retentionDays: Math.max(30, Number(form.retentionDays) || 365),
    });
    toast.success("Document settings saved");
  }

  return (
    <div className="card-soft p-5">
      <SectionTitle title="Document Settings" subtitle="Defaults applied when generating letters, proposals, and agreements." />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Default format">
          <select
            className={FIELD}
            value={form.defaultFormat}
            onChange={(e) => setForm({ ...form, defaultFormat: e.target.value as DocumentSettings["defaultFormat"] })}
          >
            <option value="PDF">PDF</option>
            <option value="DOCX">DOCX</option>
          </select>
        </Field>
        <Field label="Retention (days)">
          <input
            type="number"
            min={30}
            className={FIELD}
            value={form.retentionDays}
            onChange={(e) => setForm({ ...form, retentionDays: Number(e.target.value) })}
          />
        </Field>
        <Field label="Default signatory">
          <input className={FIELD} value={form.defaultSignatory} onChange={(e) => setForm({ ...form, defaultSignatory: e.target.value })} />
        </Field>
        <Field label="Signatory title">
          <input className={FIELD} value={form.signatoryTitle} onChange={(e) => setForm({ ...form, signatoryTitle: e.target.value })} />
        </Field>
        <Field label="Footer text" className="sm:col-span-2">
          <input className={FIELD} value={form.footerText} onChange={(e) => setForm({ ...form, footerText: e.target.value })} />
        </Field>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <div className="text-sm font-medium">Include GST on documents</div>
            <div className="text-xs text-muted-foreground">Show GSTIN in letterheads</div>
          </div>
          <Switch checked={form.includeGstOnDocs} onCheckedChange={(v) => setForm({ ...form, includeGstOnDocs: v })} />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <div className="text-sm font-medium">Auto-versioning</div>
            <div className="text-xs text-muted-foreground">Keep prior versions when regenerating</div>
          </div>
          <Switch checked={form.autoVersioning} onCheckedChange={(v) => setForm({ ...form, autoVersioning: v })} />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={save}>Save Document Settings</Button>
      </div>
    </div>
  );
}

type ExcelForm = Omit<ExcelTemplateSetting, "id" | "createdAt" | "updatedAt">;

function ExcelSection() {
  const templates = useSettingsStore((s) => s.excelTemplates);
  const addExcelTemplate = useSettingsStore((s) => s.addExcelTemplate);
  const updateExcelTemplate = useSettingsStore((s) => s.updateExcelTemplate);
  const deleteExcelTemplate = useSettingsStore((s) => s.deleteExcelTemplate);

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<ExcelTemplateSetting | null>(null);
  const [form, setForm] = useState<ExcelForm>({
    name: "",
    purpose: "unit",
    sampleFileName: "",
    requiredColumns: "",
    enabled: true,
  });

  function openCreate() {
    setEditing(null);
    setForm({ name: "", purpose: "unit", sampleFileName: "", requiredColumns: "", enabled: true });
    setModalOpen(true);
  }

  function openEdit(t: ExcelTemplateSetting) {
    setEditing(t);
    setForm({
      name: t.name,
      purpose: t.purpose,
      sampleFileName: t.sampleFileName,
      requiredColumns: t.requiredColumns,
      enabled: t.enabled,
    });
    setModalOpen(true);
  }

  function downloadSample(t: ExcelTemplateSetting) {
    const header = t.requiredColumns;
    const blob = new Blob([`${header}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = t.sampleFileName.replace(/\.xlsx$/i, ".csv");
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded sample for ${t.name}`);
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <SectionTitle title="Excel Templates" subtitle="Define import shapes and downloadable sample files." />
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> Add Template
        </Button>
      </div>
      <div className="card-soft overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Purpose</th>
              <th className="px-4 py-2 text-left">Columns</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.sampleFileName}</div>
                </td>
                <td className="px-4 py-3 capitalize">{t.purpose}</td>
                <td className="max-w-[240px] truncate px-4 py-3 text-muted-foreground">{t.requiredColumns}</td>
                <td className="px-4 py-3">
                  <Switch
                    size="sm"
                    checked={t.enabled}
                    onCheckedChange={(v) => updateExcelTemplate(t.id, { enabled: v })}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <Button size="icon" variant="ghost" title="Download sample" onClick={() => downloadSample(t)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(t)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditing(t);
                      setDeleteOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
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
        title={editing ? "Edit Template" : "Add Template"}
        onSubmit={() => {
          if (!form.name.trim() || !form.requiredColumns.trim()) {
            toast.error("Name and required columns are needed");
            return;
          }
          const payload = {
            ...form,
            name: form.name.trim(),
            sampleFileName: form.sampleFileName.trim() || `${form.purpose}_sample.xlsx`,
            requiredColumns: form.requiredColumns.trim(),
          };
          if (editing) {
            updateExcelTemplate(editing.id, payload);
            toast.success("Template updated");
          } else {
            addExcelTemplate(payload);
            toast.success("Template added");
          }
          setModalOpen(false);
        }}
      >
        <div className="grid gap-2">
          <input
            placeholder="Template name"
            className={FIELD}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <select className={FIELD} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
            {["unit", "customer", "booking", "payment", "other"].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <input
            placeholder="Sample file name"
            className={FIELD}
            value={form.sampleFileName}
            onChange={(e) => setForm({ ...form, sampleFileName: e.target.value })}
          />
          <textarea
            placeholder="Required columns (comma-separated)"
            className={cn(FIELD, "h-auto min-h-[72px] py-2")}
            value={form.requiredColumns}
            onChange={(e) => setForm({ ...form, requiredColumns: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
            Enabled
          </label>
        </div>
      </EntityFormModal>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete template?"
        onConfirm={() => {
          if (editing) {
            deleteExcelTemplate(editing.id);
            toast.success("Template deleted");
          }
          setDeleteOpen(false);
        }}
      />
    </div>
  );
}

type PlanForm = Omit<PaymentPlanPreset, "id" | "createdAt" | "updatedAt">;

function PaymentsSection() {
  const plans = useSettingsStore((s) => s.paymentPlans);
  const addPaymentPlan = useSettingsStore((s) => s.addPaymentPlan);
  const updatePaymentPlan = useSettingsStore((s) => s.updatePaymentPlan);
  const deletePaymentPlan = useSettingsStore((s) => s.deletePaymentPlan);

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentPlanPreset | null>(null);
  const [form, setForm] = useState<PlanForm>({
    name: "",
    installments: 12,
    frequency: "Monthly",
    downPaymentPercent: 10,
    notes: "",
    enabled: true,
  });

  function openCreate() {
    setEditing(null);
    setForm({ name: "", installments: 12, frequency: "Monthly", downPaymentPercent: 10, notes: "", enabled: true });
    setModalOpen(true);
  }

  function openEdit(p: PaymentPlanPreset) {
    setEditing(p);
    setForm({
      name: p.name,
      installments: p.installments,
      frequency: p.frequency,
      downPaymentPercent: p.downPaymentPercent,
      notes: p.notes ?? "",
      enabled: p.enabled,
    });
    setModalOpen(true);
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <SectionTitle title="Payment Plan Settings" subtitle="Presets available when configuring company billing." />
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> Add Plan
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {plans.map((p) => (
          <div key={p.id} className="card-soft p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.installments} installments · {p.frequency} · {p.downPaymentPercent}% down
                </div>
              </div>
              <Switch size="sm" checked={p.enabled} onCheckedChange={(v) => updatePaymentPlan(p.id, { enabled: v })} />
            </div>
            {p.notes && <p className="mb-3 text-sm text-muted-foreground">{p.notes}</p>}
            <div className="flex justify-end gap-1">
              <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setEditing(p);
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <EntityFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Edit Payment Plan" : "Add Payment Plan"}
        onSubmit={() => {
          if (!form.name.trim()) {
            toast.error("Plan name is required");
            return;
          }
          const payload = {
            ...form,
            name: form.name.trim(),
            notes: form.notes?.trim() || undefined,
            installments: Math.max(1, Number(form.installments) || 1),
            downPaymentPercent: Math.min(100, Math.max(0, Number(form.downPaymentPercent) || 0)),
          };
          if (editing) {
            updatePaymentPlan(editing.id, payload);
            toast.success("Plan updated");
          } else {
            addPaymentPlan(payload);
            toast.success("Plan added");
          }
          setModalOpen(false);
        }}
      >
        <div className="grid gap-2">
          <input
            placeholder="Plan name"
            className={FIELD}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={1}
              placeholder="Installments"
              className={FIELD}
              value={form.installments}
              onChange={(e) => setForm({ ...form, installments: Number(e.target.value) })}
            />
            <input
              type="number"
              min={0}
              max={100}
              placeholder="Down payment %"
              className={FIELD}
              value={form.downPaymentPercent}
              onChange={(e) => setForm({ ...form, downPaymentPercent: Number(e.target.value) })}
            />
          </div>
          <select
            className={FIELD}
            value={form.frequency}
            onChange={(e) => setForm({ ...form, frequency: e.target.value as PlanForm["frequency"] })}
          >
            {(["Monthly", "Quarterly", "Milestone"] as const).map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <textarea
            placeholder="Notes (optional)"
            className={cn(FIELD, "h-auto min-h-[64px] py-2")}
            value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
      </EntityFormModal>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete payment plan?"
        onConfirm={() => {
          if (editing) {
            deletePaymentPlan(editing.id);
            toast.success("Plan deleted");
          }
          setDeleteOpen(false);
        }}
      />
    </div>
  );
}

type UserForm = Pick<User, "name" | "email" | "role" | "active" | "phone" | "jobTitle" | "department">;

function UsersSection({ initialInviteOpen = false }: { initialInviteOpen?: boolean }) {
  const users = useUserStore((s) => s.users);
  const deleteUser = useUserStore((s) => s.deleteUser);
  const roles = useSettingsStore((s) => s.roles);
  const currentUser = useAuthStore((s) => s.user);
  const currentUserId = currentUser?.id;
  const { isAdmin } = usePermissions();
  const navigate = useNavigate({ from: "/settings" });

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [passwords, setPasswords] = useState({ next: "", confirm: "" });
  const [form, setForm] = useState<UserForm>({
    name: "",
    email: "",
    role: roles.find((r) => r.key === "Viewer")?.key ?? roles[0]?.key ?? "Viewer",
    active: true,
    phone: "",
    jobTitle: "",
    department: "",
  });

  useEffect(() => {
    if (!initialInviteOpen || !isAdmin) return;
    setEditing(null);
    resetPasswordFields();
    setForm({
      name: "",
      email: "",
      role: roles.find((r) => r.key === "Viewer")?.key ?? roles[0]?.key ?? "Viewer",
      active: true,
      phone: "",
      jobTitle: "",
      department: "",
    });
    setModalOpen(true);
    void navigate({ search: { section: "users", invite: false }, replace: true });
  }, [initialInviteOpen, isAdmin, navigate]);

  function resetPasswordFields() {
    setPasswords({ next: "", confirm: "" });
  }

  function openInvite() {
    if (!isAdmin) {
      toast.error("Only admins can invite users");
      return;
    }
    setEditing(null);
    resetPasswordFields();
    setForm({
      name: "",
      email: "",
      role: roles.find((r) => r.key === "Viewer")?.key ?? roles[0]?.key ?? "Viewer",
      active: true,
      phone: "",
      jobTitle: "",
      department: "",
    });
    setModalOpen(true);
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <SectionTitle
          title="User Management"
          subtitle="Create login accounts with role, contact details, and access. Same form used from Invite user in the profile menu."
        />
        {isAdmin && (
          <Button onClick={openInvite}>
            <Plus className="mr-1 h-4 w-4" /> Invite User
          </Button>
        )}
      </div>
      {!isAdmin && (
        <p className="mb-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Viewing accounts only. Ask an Admin to invite or edit users.
        </p>
      )}
      <div className="card-soft overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">User</th>
              <th className="px-4 py-2 text-left">Role</th>
              <th className="px-4 py-2 text-left">Department</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                        {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                    )}
                    <div>
                      <div className="font-medium">
                        {u.name}
                        {u.id === currentUserId && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {roles.find((r) => r.key === u.role)?.name ?? u.role}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.department ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                      u.active
                        ? "bg-success/15 text-success border border-success/30"
                        : "bg-muted text-muted-foreground border border-border",
                    )}
                  >
                    {u.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {isAdmin && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(u);
                          resetPasswordFields();
                          setForm({
                            name: u.name,
                            email: u.email,
                            role: u.role,
                            active: u.active,
                            phone: u.phone ?? "",
                            jobTitle: u.jobTitle ?? "",
                            department: u.department ?? "",
                          });
                          setModalOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={u.id === currentUserId}
                        onClick={() => {
                          setEditing(u);
                          setDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <EntityFormModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) resetPasswordFields();
        }}
        title={editing ? "Edit User" : "Invite User"}
        onSubmit={() => {
          if (!isAdmin) {
            toast.error("Only admins can manage users");
            return;
          }
          if (form.name.trim().length < 2) {
            toast.error("Name must be at least 2 characters");
            return;
          }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
            toast.error("Enter a valid email");
            return;
          }
          const wantsPasswordChange = Boolean(passwords.next.trim() || passwords.confirm.trim());
          if (wantsPasswordChange) {
            if (passwords.next.length < 6) {
              toast.error("New password must be at least 6 characters");
              return;
            }
            if (passwords.next !== passwords.confirm) {
              toast.error("New passwords do not match");
              return;
            }
          }
          const payload = {
            name: form.name.trim(),
            email: form.email.trim().toLowerCase(),
            role: form.role,
            active: form.active,
            phone: form.phone?.trim() || undefined,
            jobTitle: form.jobTitle?.trim() || undefined,
            department: form.department?.trim() || undefined,
          };
          if (editing) {
            void apiUpdateUser({ data: { id: editing.id, patch: payload } })
              .then(async (u) => {
                useUserStore.setState((s) => ({
                  users: s.users.map((x) => (x.id === u.id ? u : x)),
                }));
                if (wantsPasswordChange) {
                  await apiSetUserPassword({ data: { id: editing.id, password: passwords.next } });
                  toast.success("User updated and password changed");
                } else {
                  toast.success("User updated");
                }
                resetPasswordFields();
                setModalOpen(false);
              })
              .catch((e) => toast.error(e instanceof Error ? e.message : "Update failed"));
            return;
          }
          void apiCreateUser({ data: { ...payload, password: "buildesk123" } })
            .then((user) => {
              useUserStore.setState((s) => ({ users: [...s.users, user] }));
              toast.success("User invited · temporary password: buildesk123");
              setModalOpen(false);
            })
            .catch((e) => toast.error(e instanceof Error ? e.message : "Invite failed"));
        }}
      >
        <div className="grid gap-2">
          <input
            placeholder="Full name"
            className={FIELD}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            placeholder="Email"
            type="email"
            className={FIELD}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="Phone"
              className={FIELD}
              value={form.phone ?? ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <input
              placeholder="Job title"
              className={FIELD}
              value={form.jobTitle ?? ""}
              onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
            />
          </div>
          <input
            placeholder="Department"
            className={FIELD}
            value={form.department ?? ""}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
          />
          <select
            className={FIELD}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.key}>
                {r.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Active account
          </label>
          {!editing && (
            <p className="text-xs text-muted-foreground">
              New users get temporary password <code>buildesk123</code>. They can change it after sign-in.
            </p>
          )}
          {editing && (
            <div className="mt-2 space-y-2 rounded-lg border border-dashed p-3">
              <div className="text-xs font-medium text-muted-foreground">Change password (optional)</div>
              <input
                type="password"
                placeholder="New password"
                className={FIELD}
                value={passwords.next}
                onChange={(e) => setPasswords((p) => ({ ...p, next: e.target.value }))}
                autoComplete="new-password"
              />
              <input
                type="password"
                placeholder="Confirm new password"
                className={FIELD}
                value={passwords.confirm}
                onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
                autoComplete="new-password"
              />
              <p className="text-[11px] text-muted-foreground">
                Leave blank to keep the current password. Minimum 6 characters.
              </p>
            </div>
          )}
        </div>
      </EntityFormModal>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Remove user?"
        description="This permanently deletes the account from the server. It will not come back on refresh."
        onConfirm={() => {
          if (editing) {
            deleteUser(editing.id);
            toast.success("User removed");
          }
          setDeleteOpen(false);
          setEditing(null);
        }}
      />
    </div>
  );
}
