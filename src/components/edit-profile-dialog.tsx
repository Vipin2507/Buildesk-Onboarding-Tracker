import { useEffect, useRef, useState, type ReactNode } from "react";
import { Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuthStore, useCurrentUser, useUserStore } from "@/stores";
import { authChangePassword, authUpdateProfile } from "@/lib/api";
import { cn } from "@/lib/utils";

const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
];

export function EditProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const user = useCurrentUser();
  const setUser = useAuthStore((s) => s.setUser);
  const updateUser = useUserStore((s) => s.updateUser);
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<"profile" | "security" | "preferences">("profile");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    jobTitle: "",
    department: "",
    timezone: "Asia/Kolkata",
    bio: "",
    avatarUrl: "",
    notifyEmail: true,
    notifyInApp: true,
  });
  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
  });

  useEffect(() => {
    if (!open || !user) return;
    setTab("profile");
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone ?? "",
      jobTitle: user.jobTitle ?? "",
      department: user.department ?? "",
      timezone: user.timezone ?? "Asia/Kolkata",
      bio: user.bio ?? "",
      avatarUrl: user.avatarUrl ?? "",
      notifyEmail: user.notifyEmail ?? true,
      notifyInApp: user.notifyInApp ?? true,
    });
    setPasswords({ current: "", next: "", confirm: "" });
  }, [open, user]);

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  function onPickImage(file?: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, avatarUrl: String(reader.result ?? "") }));
    };
    reader.readAsDataURL(file);
  }

  async function saveProfile() {
    if (form.name.trim().length < 2) {
      toast.error("Name must be at least 2 characters");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error("Enter a valid email");
      return;
    }
    try {
      const result = await authUpdateProfile({
        data: {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || null,
          jobTitle: form.jobTitle.trim() || null,
          department: form.department.trim() || null,
          timezone: form.timezone,
          bio: form.bio.trim() || null,
          avatarUrl: form.avatarUrl || null,
          notifyEmail: form.notifyEmail,
          notifyInApp: form.notifyInApp,
        },
      });
      setUser(result.data.user);
      updateUser(user!.id, result.data.user);
      toast.success("Profile updated");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update profile");
    }
  }

  async function savePassword() {
    if (passwords.next !== passwords.confirm) {
      toast.error("New passwords do not match");
      return;
    }
    try {
      const result = await authChangePassword({
        data: { currentPassword: passwords.current, nextPassword: passwords.next },
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Password changed");
      setPasswords({ current: "", next: "", confirm: "" });
      setTab("profile");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to change password");
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Edit Profile</AlertDialogTitle>
          <AlertDialogDescription>
            Update your photo, personal details, password, and notification preferences.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="mb-3 flex gap-1 rounded-lg border bg-muted/30 p-1">
          {(
            [
              ["profile", "Profile"],
              ["security", "Password"],
              ["preferences", "Preferences"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "profile" && (
          <div className="space-y-4 py-1">
            <div className="flex items-center gap-4">
              <div className="relative">
                {form.avatarUrl ? (
                  <img
                    src={form.avatarUrl}
                    alt={form.name}
                    className="h-16 w-16 rounded-full object-cover ring-2 ring-primary/20"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
                    {initials}
                  </div>
                )}
                <button
                  type="button"
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border bg-card shadow-sm hover:bg-muted"
                  onClick={() => fileRef.current?.click()}
                  title="Change photo"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickImage(e.target.files?.[0])}
                />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium">Profile photo</div>
                <div className="text-xs text-muted-foreground">PNG or JPG · max 2MB</div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                    Upload
                  </Button>
                  {form.avatarUrl && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setForm((f) => ({ ...f, avatarUrl: "" }))}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name">
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="field"
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="field"
                />
              </Field>
              <Field label="Phone">
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="field"
                  placeholder="+91 …"
                />
              </Field>
              <Field label="Job title">
                <input
                  value={form.jobTitle}
                  onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
                  className="field"
                />
              </Field>
              <Field label="Department">
                <input
                  value={form.department}
                  onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                  className="field"
                />
              </Field>
              <Field label="Timezone">
                <select
                  value={form.timezone}
                  onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                  className="field"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </Field>
              <Field label="Bio" className="sm:col-span-2">
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  className="field min-h-[72px]"
                  placeholder="Short note about your role…"
                />
              </Field>
            </div>
          </div>
        )}

        {tab === "security" && (
          <div className="grid gap-3 py-1">
            <Field label="Current password">
              <input
                type="password"
                value={passwords.current}
                onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))}
                className="field"
                autoComplete="current-password"
              />
            </Field>
            <Field label="New password">
              <input
                type="password"
                value={passwords.next}
                onChange={(e) => setPasswords((p) => ({ ...p, next: e.target.value }))}
                className="field"
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirm new password">
              <input
                type="password"
                value={passwords.confirm}
                onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
                className="field"
                autoComplete="new-password"
              />
            </Field>
            <p className="text-xs text-muted-foreground">Use at least 6 characters. Demo tip: current password is often `buildesk123`.</p>
          </div>
        )}

        {tab === "preferences" && (
          <div className="space-y-3 py-1">
            <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={form.notifyEmail}
                onChange={(e) => setForm((f) => ({ ...f, notifyEmail: e.target.checked }))}
              />
              <span>
                <span className="font-medium">Email notifications</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Approvals, renewals, and digests to your inbox
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={form.notifyInApp}
                onChange={(e) => setForm((f) => ({ ...f, notifyInApp: e.target.checked }))}
              />
              <span>
                <span className="font-medium">In-app alerts</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Show bell notifications while you work in the tracker
                </span>
              </span>
            </label>
            <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
              Role: <span className="font-medium text-foreground">{user.role}</span>
              {" · "}
              Account status: <span className="font-medium text-foreground">{user.active ? "Active" : "Inactive"}</span>
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {tab === "security" ? (
            <Button onClick={savePassword}>Update Password</Button>
          ) : (
            <Button onClick={saveProfile}>Save Changes</Button>
          )}
        </AlertDialogFooter>

        <style>{`
          .field {
            margin-top: 0.25rem;
            height: 2.25rem;
            width: 100%;
            border-radius: 0.375rem;
            border: 1px solid var(--color-border);
            background: var(--color-background);
            padding: 0 0.75rem;
            font-size: 0.875rem;
          }
          textarea.field {
            height: auto;
            padding-top: 0.5rem;
            padding-bottom: 0.5rem;
          }
        `}</style>
      </AlertDialogContent>
    </AlertDialog>
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
