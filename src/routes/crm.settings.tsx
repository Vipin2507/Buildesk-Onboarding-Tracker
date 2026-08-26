import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  Building2,
  KeyRound,
  Monitor,
  Palette,
  Pencil,
  Plus,
  Shield,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDeleteDialog, EntityFormModal } from "@/components/entity-form-modal";
import { WebPushDevicePanel } from "@/components/crm/web-push-device-panel";
import {
  DesignTicketPageHeader,
  TICKET_EASE,
} from "@/components/design-ticket/design-ticket-shared";
import { AnimatedSection, PageWrap } from "@/components/page-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { usePermissions } from "@/hooks/use-permissions";
import {
  createUser as apiCreateUser,
  setUserPassword as apiSetUserPassword,
  setAppConfig,
  updateUser as apiUpdateUser,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ThemeMode } from "@/lib/theme";
import {
  useAuthStore,
  useCrmMasterStore,
  useCrmSettingsStore,
  useUserStore,
} from "@/stores";
import type { CrmNotificationSettings } from "@/stores/useCrmSettingsStore";
import { crmSettingsSnapshot } from "@/stores/useCrmSettingsStore";
import type { CrmMasterPlatformSettings } from "@/types/crm-master";
import type { User } from "@/types";
import { CRM_SEED_PLATFORM } from "@/data/crm-master-seed";

type SectionId =
  | "appearance"
  | "organization"
  | "notifications"
  | "users"
  | "roles"
  | "profile";

const SECTION_IDS: SectionId[] = [
  "appearance",
  "organization",
  "notifications",
  "users",
  "roles",
  "profile",
];

const CRM_ROLES = [
  { key: "Admin", name: "Administrator", desc: "Full CRM access — users, master, settings, go-live." },
  { key: "Manager", name: "Manager", desc: "Run account onboarding, checklists, tracker, and tickets." },
  { key: "Viewer", name: "Viewer", desc: "Read-only CRM dashboards and account progress." },
] as const;

const FIELD =
  "mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/25";

export const Route = createFileRoute("/crm/settings")({
  validateSearch: (search: Record<string, unknown>) => ({
    section: SECTION_IDS.includes(search.section as SectionId)
      ? (search.section as SectionId)
      : (undefined as SectionId | undefined),
    invite: Boolean(search.invite === true || search.invite === "true" || search.invite === "1"),
  }),
  component: CrmSettingsPage,
});

const SECTIONS: {
  id: SectionId;
  title: string;
  desc: string;
  icon: typeof Building2;
  adminOnly?: boolean;
}[] = [
  { id: "appearance", title: "Appearance", desc: "Theme for the CRM workspace.", icon: Palette },
  {
    id: "organization",
    title: "Organization",
    desc: "Product name, branding, timezone, support contacts.",
    icon: Building2,
    adminOnly: true,
  },
  {
    id: "notifications",
    title: "Email & Alerts",
    desc: "In-app CRM alerts, web push for tasks, and SMTP settings.",
    icon: Bell,
    adminOnly: true,
  },
  {
    id: "users",
    title: "CRM Users",
    desc: "Invite and manage people who work in CRM.",
    icon: Users,
    adminOnly: true,
  },
  {
    id: "roles",
    title: "Roles",
    desc: "What Admin, Manager, and Viewer can do in CRM.",
    icon: Shield,
    adminOnly: true,
  },
  { id: "profile", title: "My Profile", desc: "Your account details and password.", icon: UserRound },
];

function normalizePlatform(platform: CrmMasterPlatformSettings): CrmMasterPlatformSettings {
  return {
    ...CRM_SEED_PLATFORM,
    ...platform,
    supportPhone: platform.supportPhone ?? CRM_SEED_PLATFORM.supportPhone,
    locale: platform.locale ?? CRM_SEED_PLATFORM.locale,
    brandPrimary: platform.brandPrimary ?? CRM_SEED_PLATFORM.brandPrimary,
    registeredAddress: platform.registeredAddress ?? CRM_SEED_PLATFORM.registeredAddress,
  };
}

function CrmSettingsPage() {
  const navigate = useNavigate({ from: "/crm/settings" });
  const search = Route.useSearch();
  const { isAdmin } = usePermissions();
  const [section, setSection] = useState<SectionId | null>(search.section ?? null);

  const visibleSections = SECTIONS.filter((s) => !s.adminOnly || isAdmin);

  useEffect(() => {
    if (!search.section) return;
    const target = SECTIONS.find((s) => s.id === search.section);
    if (target && (!target.adminOnly || isAdmin)) {
      setSection(search.section);
    } else {
      setSection(null);
      void navigate({ search: { section: undefined, invite: false }, replace: true });
    }
  }, [search.section, isAdmin, navigate]);

  function openSection(next: SectionId | null) {
    setSection(next);
    void navigate({
      search: { section: next ?? undefined, invite: false },
      replace: true,
    });
  }

  return (
    <PageWrap compact>
      <DesignTicketPageHeader
        compact
        title="CRM Settings"
        subtitle="Configure the CRM workspace — users, branding, alerts, and your profile."
      />

      {!section ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {visibleSections.map((s, i) => (
            <motion.button
              key={s.id}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: Math.min(i * 0.03, 0.2), ease: TICKET_EASE }}
              whileHover={{ y: -1 }}
              onClick={() => openSection(s.id)}
              className="card-soft flex gap-3 px-3 py-2.5 text-left transition-shadow hover:shadow-sm"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <s.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold">{s.title}</div>
                <div className="text-[11px] text-muted-foreground">{s.desc}</div>
              </div>
            </motion.button>
          ))}
        </div>
      ) : (
        <AnimatedSection>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-2 gap-1.5 text-muted-foreground"
            onClick={() => openSection(null)}
          >
            ← Back to Settings
          </Button>
          {section === "appearance" ? <AppearanceSection /> : null}
          {section === "organization" && isAdmin ? <OrganizationSection /> : null}
          {section === "notifications" && isAdmin ? <NotificationsSection /> : null}
          {section === "users" && isAdmin ? (
            <UsersSection initialInviteOpen={Boolean(search.invite)} />
          ) : null}
          {section === "roles" && isAdmin ? <RolesSection /> : null}
          {section === "profile" ? <ProfileSection /> : null}
        </AnimatedSection>
      )}
    </PageWrap>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-2.5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {subtitle ? <p className="text-[11px] text-muted-foreground">{subtitle}</p> : null}
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

function AppearanceSection() {
  const { mode, resolved, setMode } = useTheme();
  const options: { id: ThemeMode; label: string; desc: string; icon: typeof Monitor }[] = [
    { id: "light", label: "Light", desc: "Bright surfaces for daytime work.", icon: Palette },
    { id: "dark", label: "Dark", desc: "Low-glare surfaces for long sessions.", icon: Palette },
    { id: "system", label: "System", desc: "Follow your OS preference.", icon: Monitor },
  ];

  return (
    <div className="space-y-3">
      <SectionTitle title="Appearance" subtitle="Theme applies across every CRM screen." />
      <div className="card-soft flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
        <div>
          <div className="text-xs font-semibold">Quick switch</div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Currently {resolved} · preference: {mode}
          </p>
        </div>
        <ThemeToggle />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
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
                "card-soft p-3 text-left transition-all",
                active ? "shadow-sm ring-2 ring-primary/50" : "hover:border-primary/30",
              )}
            >
              <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <opt.icon className="h-3.5 w-3.5" />
              </div>
              <div className="text-sm font-semibold">{opt.label}</div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{opt.desc}</p>
              {active ? (
                <span className="mt-2 inline-flex text-[9px] font-semibold uppercase tracking-wide text-primary">
                  Active
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OrganizationSection() {
  const platform = useCrmMasterStore((s) => s.platform);
  const updatePlatform = useCrmMasterStore((s) => s.updatePlatform);
  const [form, setForm] = useState(() => normalizePlatform(platform));

  useEffect(() => setForm(normalizePlatform(platform)), [platform]);

  function save() {
    if (!form.productName.trim() || !form.supportEmail.trim()) {
      toast.error("Product name and support email are required");
      return;
    }
    updatePlatform({
      ...form,
      productName: form.productName.trim(),
      productTagline: form.productTagline.trim(),
      supportEmail: form.supportEmail.trim(),
      supportPhone: form.supportPhone.trim(),
      registeredAddress: form.registeredAddress.trim(),
      brandPrimary: form.brandPrimary.trim() || CRM_SEED_PLATFORM.brandPrimary,
    });
    toast.success("Organization settings saved");
  }

  return (
    <div className="card-soft p-3">
      <SectionTitle
        title="Organization"
        subtitle="CRM product identity used in the workspace and support contacts."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Product name">
          <input
            className={FIELD}
            value={form.productName}
            onChange={(e) => setForm({ ...form, productName: e.target.value })}
          />
        </Field>
        <Field label="Brand primary color">
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              className="h-9 w-12 cursor-pointer rounded border"
              value={form.brandPrimary || "#009BFF"}
              onChange={(e) => setForm({ ...form, brandPrimary: e.target.value })}
            />
            <input
              className={cn(FIELD, "mt-0 flex-1")}
              value={form.brandPrimary}
              onChange={(e) => setForm({ ...form, brandPrimary: e.target.value })}
            />
          </div>
        </Field>
        <Field label="Tagline" className="sm:col-span-2">
          <input
            className={FIELD}
            value={form.productTagline}
            onChange={(e) => setForm({ ...form, productTagline: e.target.value })}
          />
        </Field>
        <Field label="Registered address" className="sm:col-span-2">
          <textarea
            className={cn(FIELD, "h-auto min-h-[72px] py-2")}
            value={form.registeredAddress}
            onChange={(e) => setForm({ ...form, registeredAddress: e.target.value })}
          />
        </Field>
        <Field label="Timezone">
          <select
            className={FIELD}
            value={form.defaultTimezone}
            onChange={(e) => setForm({ ...form, defaultTimezone: e.target.value })}
          >
            {["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York"].map(
              (tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ),
            )}
          </select>
        </Field>
        <Field label="Locale">
          <select
            className={FIELD}
            value={form.locale}
            onChange={(e) => setForm({ ...form, locale: e.target.value })}
          >
            {["en-IN", "en-US", "en-GB"].map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Currency">
          <select
            className={FIELD}
            value={form.defaultCurrency}
            onChange={(e) => setForm({ ...form, defaultCurrency: e.target.value })}
          >
            {["INR", "USD", "AED", "SGD"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Support email">
          <input
            type="email"
            className={FIELD}
            value={form.supportEmail}
            onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
          />
        </Field>
        <Field label="Support phone">
          <input
            className={FIELD}
            value={form.supportPhone}
            onChange={(e) => setForm({ ...form, supportPhone: e.target.value })}
          />
        </Field>
      </div>
      <div className="mt-3 flex justify-end">
        <Button onClick={save}>Save Organization</Button>
      </div>
    </div>
  );
}

function NotificationsSection() {
  const notifications = useCrmSettingsStore((s) => s.notifications);
  const updateNotifications = useCrmSettingsStore((s) => s.updateNotifications);
  const [form, setForm] = useState<CrmNotificationSettings>(notifications);

  useEffect(() => setForm(notifications), [notifications]);

  function save() {
    const next = {
      ...form,
      smtpHost: form.smtpHost.trim(),
      smtpUser: form.smtpUser.trim(),
      smtpFromName: form.smtpFromName.trim(),
      smtpFromEmail: form.smtpFromEmail.trim(),
      smtpPort: Number(form.smtpPort) || 587,
      digestHour: Math.min(23, Math.max(0, Number(form.digestHour) || 0)),
      taskReminderWebPushMinutesBefore: Math.min(
        24 * 60,
        Math.max(1, Number(form.taskReminderWebPushMinutesBefore) || 15),
      ),
      notifyOnPendingActivities: form.notifyOnPendingActivities,
    };
    updateNotifications(next);
    void setAppConfig({ data: { key: "crm-settings", value: crmSettingsSnapshot() } })
      .then(() => toast.success("Notification settings saved"))
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : "Saved locally but server sync failed"),
      );
  }

  const eventToggles: {
    key: "notifyOnStageChange" | "notifyOnTraining" | "notifyOnGoLive";
    label: string;
    desc: string;
  }[] = [
    {
      key: "notifyOnStageChange",
      label: "Stage changes",
      desc: "In-app bell when an account moves to a new implementation stage",
    },
    {
      key: "notifyOnTraining",
      label: "Training",
      desc: "In-app bell when a training session is logged",
    },
    {
      key: "notifyOnGoLive",
      label: "Go-live",
      desc: "In-app bell when an account is marked live",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="card-soft p-3">
        <SectionTitle
          title="In-app event alerts"
          subtitle="These toggles control the CRM notification bell. Clicking an alert opens the account."
        />
        <div className="space-y-2">
          {eventToggles.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-xs font-medium">{item.label}</div>
                <div className="text-[10px] text-muted-foreground">{item.desc}</div>
              </div>
              <Switch
                checked={Boolean(form[item.key])}
                onCheckedChange={(v) => setForm({ ...form, [item.key]: v === true })}
              />
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-2 opacity-70">
            <div className="min-w-0">
              <div className="text-xs font-medium">Pending activities digest</div>
              <div className="text-[10px] text-muted-foreground">
                Coming soon — needs a scheduled digest job. Setting is saved but not sent yet.
              </div>
            </div>
            <Switch checked={false} disabled />
          </div>
        </div>
      </div>

      <div className="card-soft p-3">
        <SectionTitle
          title="Task reminder web push"
          subtitle="Browser notifications for assignees before a scheduled task starts. Each user must enable push on their device under My Profile. The server checks every minute."
        />
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
            <div className="min-w-0">
              <div className="text-xs font-medium">Enable web push reminders</div>
              <div className="text-[10px] text-muted-foreground">
                Sends a notification to browsers that have opted in when a task is approaching its
                start time.
              </div>
            </div>
            <Switch
              checked={Boolean(form.taskReminderWebPushEnabled)}
              onCheckedChange={(v) => setForm({ ...form, taskReminderWebPushEnabled: v === true })}
            />
          </div>
          <Field label="Minutes before task start">
            <input
              type="number"
              min={1}
              max={1440}
              className={FIELD}
              disabled={!form.taskReminderWebPushEnabled}
              value={form.taskReminderWebPushMinutesBefore}
              onChange={(e) =>
                setForm({
                  ...form,
                  taskReminderWebPushMinutesBefore: Number(e.target.value) || 15,
                })
              }
            />
          </Field>
          {form.quietHoursEnabled ? (
            <p className="text-[10px] text-muted-foreground">
              Quiet hours below are respected — web push will not fire during those times.
            </p>
          ) : null}
        </div>
      </div>

      <div className="card-soft p-3">
        <SectionTitle
          title="SMTP Configuration"
          subtitle="Stored for a future email send path. Email is not sent yet."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="SMTP host">
            <input
              className={FIELD}
              value={form.smtpHost}
              onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
            />
          </Field>
          <Field label="Port">
            <input
              type="number"
              className={FIELD}
              value={form.smtpPort}
              onChange={(e) => setForm({ ...form, smtpPort: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="SMTP user">
            <input
              className={FIELD}
              value={form.smtpUser}
              onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
            />
          </Field>
          <Field label="From name">
            <input
              className={FIELD}
              value={form.smtpFromName}
              onChange={(e) => setForm({ ...form, smtpFromName: e.target.value })}
            />
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

      <div className="card-soft p-3">
        <SectionTitle
          title="Digest"
          subtitle="Email digest cadence — stored only until email sending is wired."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cadence">
            <select
              className={FIELD}
              value={form.digestCadence}
              onChange={(e) =>
                setForm({
                  ...form,
                  digestCadence: e.target.value as CrmNotificationSettings["digestCadence"],
                })
              }
            >
              <option value="off">Off</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </Field>
          <Field label="Hour (0–23)">
            <input
              type="number"
              min={0}
              max={23}
              className={FIELD}
              value={form.digestHour}
              onChange={(e) => setForm({ ...form, digestHour: Number(e.target.value) || 0 })}
            />
          </Field>
        </div>
      </div>

      <div className="card-soft p-3">
        <SectionTitle
          title="Quiet hours"
          subtitle="Stored for later — not enforced on in-app alerts yet."
        />
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-xs font-medium">Enable quiet hours</span>
          <Switch
            checked={form.quietHoursEnabled}
            onCheckedChange={(v) => setForm({ ...form, quietHoursEnabled: v === true })}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Start">
            <input
              type="time"
              className={FIELD}
              value={form.quietHoursStart}
              disabled={!form.quietHoursEnabled}
              onChange={(e) => setForm({ ...form, quietHoursStart: e.target.value })}
            />
          </Field>
          <Field label="End">
            <input
              type="time"
              className={FIELD}
              value={form.quietHoursEnd}
              disabled={!form.quietHoursEnabled}
              onChange={(e) => setForm({ ...form, quietHoursEnd: e.target.value })}
            />
          </Field>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save}>Save Notification Settings</Button>
      </div>
    </div>
  );
}

function RolesSection() {
  const users = useUserStore((s) => s.users);
  const crmUsers = users.filter((u) => u.productScope === "crm");

  return (
    <div className="space-y-3">
      <SectionTitle
        title="CRM Roles"
        subtitle="Roles are assigned when you invite a CRM user. Catalog config stays under Master."
      />
      <div className="grid gap-2">
        {CRM_ROLES.map((role) => {
          const count = crmUsers.filter((u) => u.role === role.key).length;
          return (
            <div key={role.key} className="card-soft flex items-start gap-3 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Shield className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold">{role.name}</div>
                  <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                    {count} user{count === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{role.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Field dictionaries, modules, and account data control live in{" "}
        <span className="font-medium text-foreground">CRM → Master</span>.
      </p>
    </div>
  );
}

type UserForm = {
  name: string;
  email: string;
  workEmail: string;
  role: string;
  active: boolean;
  phone: string;
  jobTitle: string;
  department: string;
};

function emptyUserForm(): UserForm {
  return {
    name: "",
    email: "",
    workEmail: "",
    role: "Manager",
    active: true,
    phone: "",
    jobTitle: "",
    department: "",
  };
}

function userToForm(u: User): UserForm {
  return {
    name: u.name,
    email: u.email,
    workEmail: u.workEmail ?? "",
    role: u.role,
    active: u.active,
    phone: u.phone ?? "",
    jobTitle: u.jobTitle ?? "",
    department: u.department ?? "",
  };
}

function UsersSection({ initialInviteOpen = false }: { initialInviteOpen?: boolean }) {
  const allUsers = useUserStore((s) => s.users);
  const users = useMemo(
    () =>
      allUsers
        .filter((u) => u.productScope === "crm")
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [allUsers],
  );
  const deleteUser = useUserStore((s) => s.deleteUser);
  const currentUser = useAuthStore((s) => s.user);
  const setAuthUser = useAuthStore((s) => s.setUser);
  const currentUserId = currentUser?.id;
  const navigate = useNavigate({ from: "/crm/settings" });

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [passwords, setPasswords] = useState({ next: "", confirm: "" });
  const [form, setForm] = useState<UserForm>(emptyUserForm);

  useEffect(() => {
    if (!initialInviteOpen) return;
    setEditing(null);
    setPasswords({ next: "", confirm: "" });
    setForm(emptyUserForm());
    setModalOpen(true);
    void navigate({ search: { section: "users", invite: false }, replace: true });
  }, [initialInviteOpen, navigate]);

  function openInvite() {
    setEditing(null);
    setPasswords({ next: "", confirm: "" });
    setForm(emptyUserForm());
    setModalOpen(true);
  }

  return (
          <div>
      <div className="mb-2.5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <SectionTitle
          title="CRM Users"
          subtitle="People invited here only access the CRM product."
        />
        <Button size="sm" className="h-8 w-full gap-1 text-xs sm:w-auto" onClick={openInvite}>
          <Plus className="h-3.5 w-3.5" /> Invite CRM User
        </Button>
      </div>

      <div className="card-soft overflow-hidden">
        {users.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            No CRM users yet. Invite your implementation team.
          </div>
        ) : (
          <>
            <div className="space-y-1.5 p-2.5 md:hidden">
              {users.map((u) => (
                <div key={u.id} className="rounded-lg border border-border bg-card p-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                      {u.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">
                        {u.name}
                        {u.id === currentUserId ? (
                          <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                            (you)
                          </span>
                        ) : null}
                      </div>
                      <div className="truncate text-[10px] text-muted-foreground">{u.email}</div>
                    </div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span>{CRM_ROLES.find((r) => r.key === u.role)?.name ?? u.role}</span>
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                        u.active
                          ? "border-success/30 bg-success/15 text-success"
                          : "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      {u.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="mt-1.5 flex justify-end gap-0.5 border-t border-border/60 pt-1.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => {
                        setEditing(u);
                        setPasswords({ next: "", confirm: "" });
                        setForm(userToForm(u));
                        setModalOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={u.id === currentUserId}
                      onClick={() => {
                        setEditing(u);
                        setDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[560px] text-xs">
                <thead className="bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-1.5 text-left">User</th>
                    <th className="px-3 py-1.5 text-left">Role</th>
                    <th className="px-3 py-1.5 text-left">Department</th>
                    <th className="px-3 py-1.5 text-left">Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t">
                      <td className="px-3 py-2">
                        <div className="font-medium">
                          {u.name}
                          {u.id === currentUserId ? (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              (you)
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="px-3 py-2">
                        {CRM_ROLES.find((r) => r.key === u.role)?.name ?? u.role}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{u.department ?? "—"}</td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                            u.active
                              ? "border-success/30 bg-success/15 text-success"
                              : "border-border bg-muted text-muted-foreground",
                          )}
                        >
                          {u.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditing(u);
                            setPasswords({ next: "", confirm: "" });
                            setForm(userToForm(u));
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <EntityFormModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setPasswords({ next: "", confirm: "" });
        }}
        title={editing ? "Edit CRM User" : "Invite CRM User"}
        onSubmit={() => {
          if (form.name.trim().length < 2) {
            toast.error("Name must be at least 2 characters");
            return;
          }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
            toast.error("Enter a valid login email");
            return;
          }
          const workTrim = form.workEmail.trim();
          if (workTrim && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workTrim)) {
            toast.error("Enter a valid work email");
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
            workEmail: workTrim ? workTrim.toLowerCase() : null,
            role: form.role,
            active: form.active,
            productScope: "crm" as const,
            phone: form.phone.trim() || undefined,
            jobTitle: form.jobTitle.trim() || undefined,
            department: form.department.trim() || undefined,
          };
          if (editing) {
            void apiUpdateUser({ data: { id: editing.id, patch: payload } })
              .then(async (u) => {
                useUserStore.setState((s) => ({
                  users: s.users.map((x) => (x.id === u.id ? u : x)),
                }));
                if (u.id === currentUserId) setAuthUser(u);
                if (wantsPasswordChange) {
                  await apiSetUserPassword({ data: { id: editing.id, password: passwords.next } });
                  toast.success("CRM user updated and password changed");
                } else {
                  toast.success("CRM user updated");
                }
                setPasswords({ next: "", confirm: "" });
                setModalOpen(false);
              })
              .catch((e) => toast.error(e instanceof Error ? e.message : "Update failed"));
            return;
          }
          void apiCreateUser({
            data: {
              ...payload,
              workEmail: workTrim ? workTrim.toLowerCase() : undefined,
              password: "buildesk123",
            },
          })
            .then((user) => {
              useUserStore.setState((s) => ({ users: [...s.users, user] }));
              toast.success("CRM user invited · temporary password: buildesk123");
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
            placeholder="Login email"
            type="email"
            className={FIELD}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            placeholder="Work email (automation & executive alerts)"
            type="email"
            className={FIELD}
            value={form.workEmail}
            onChange={(e) => setForm({ ...form, workEmail: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="Phone"
              className={FIELD}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <input
              placeholder="Job title"
              className={FIELD}
              value={form.jobTitle}
              onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
            />
          </div>
          <input
            placeholder="Department"
            className={FIELD}
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
          />
          <select
            className={FIELD}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            {CRM_ROLES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Active account
          </label>
          {!editing ? (
            <p className="text-xs text-muted-foreground">
              New CRM users get temporary password <code>buildesk123</code> and land on /crm.
            </p>
          ) : (
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
            </div>
          )}
        </div>
      </EntityFormModal>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Remove CRM user?"
        description="This permanently deletes the account from the server."
        onConfirm={() => {
          if (editing) {
            deleteUser(editing.id);
            toast.success("CRM user removed");
          }
          setDeleteOpen(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

function ProfileSection() {
  const user = useAuthStore((s) => s.user);
  const setAuthUser = useAuthStore((s) => s.setUser);
  const [passwords, setPasswords] = useState({ next: "", confirm: "" });
  const [profile, setProfile] = useState({
    name: user?.name ?? "",
    phone: user?.phone ?? "",
    jobTitle: user?.jobTitle ?? "",
    department: user?.department ?? "",
  });

  useEffect(() => {
    setProfile({
      name: user?.name ?? "",
      phone: user?.phone ?? "",
      jobTitle: user?.jobTitle ?? "",
      department: user?.department ?? "",
    });
  }, [user]);

  function saveProfile() {
    if (!user) return;
    if (profile.name.trim().length < 2) {
      toast.error("Name must be at least 2 characters");
      return;
    }
    void apiUpdateUser({
      data: {
        id: user.id,
        patch: {
          name: profile.name.trim(),
          phone: profile.phone.trim() || null,
          jobTitle: profile.jobTitle.trim() || null,
          department: profile.department.trim() || null,
          productScope: "crm",
        },
      },
    })
      .then((u) => {
        useUserStore.setState((s) => ({
          users: s.users.map((x) => (x.id === u.id ? u : x)),
        }));
        setAuthUser(u);
        toast.success("Profile saved");
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Update failed"));
  }

  function changePassword() {
    if (!user) return;
    if (passwords.next.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (passwords.next !== passwords.confirm) {
      toast.error("Passwords do not match");
      return;
    }
    void apiSetUserPassword({ data: { id: user.id, password: passwords.next } })
      .then(() => {
        setPasswords({ next: "", confirm: "" });
        toast.success("Password updated");
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Password change failed"));
  }

  return (
    <div className="space-y-3">
      <div className="card-soft p-3">
        <SectionTitle title="My profile" subtitle="Details shown across CRM account activity." />
        <dl className="mb-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[10px] uppercase text-muted-foreground">Email</dt>
            <dd className="font-medium">{user?.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-muted-foreground">Role</dt>
            <dd className="font-medium">
              {CRM_ROLES.find((r) => r.key === user?.role)?.name ?? user?.role ?? "—"}
            </dd>
          </div>
        </dl>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input
              className={FIELD}
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
          </Field>
          <Field label="Phone">
            <input
              className={FIELD}
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            />
          </Field>
          <Field label="Job title">
            <input
              className={FIELD}
              value={profile.jobTitle}
              onChange={(e) => setProfile({ ...profile, jobTitle: e.target.value })}
            />
          </Field>
          <Field label="Department">
            <input
              className={FIELD}
              value={profile.department}
              onChange={(e) => setProfile({ ...profile, department: e.target.value })}
            />
          </Field>
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={saveProfile}>Save Profile</Button>
        </div>
      </div>

      <div className="card-soft p-3">
        <SectionTitle
          title="Browser notifications"
          subtitle="Enable web push on this device to receive upcoming task reminders configured under Email & Alerts."
        />
        <WebPushDevicePanel />
      </div>

      <div className="card-soft p-3">
        <SectionTitle title="Password" subtitle="Update the password for this CRM login." />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="New password">
            <input
              type="password"
              className={FIELD}
              value={passwords.next}
              onChange={(e) => setPasswords((p) => ({ ...p, next: e.target.value }))}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm password">
            <input
              type="password"
              className={FIELD}
              value={passwords.confirm}
              onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
              autoComplete="new-password"
            />
          </Field>
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="outline" className="gap-1.5" onClick={changePassword}>
            <KeyRound className="h-3.5 w-3.5" />
            Update Password
          </Button>
        </div>
      </div>
    </div>
  );
}
