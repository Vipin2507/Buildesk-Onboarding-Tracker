import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageWrap } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EntityFormModal, ConfirmDeleteDialog } from "@/components/entity-form-modal";
import { useUserStore } from "@/stores";
import type { User } from "@/types";

export const Route = createFileRoute("/settings")({
  component: Settings,
});

const SECTIONS = [
  { title: "Company Settings", desc: "Legal name, GST, branding, timezone." },
  { title: "Email & Notifications", desc: "SMTP, digest cadence, opt-outs." },
  { title: "Document Settings", desc: "Default formats & signatories." },
  { title: "Excel Templates", desc: "Manage import templates & samples." },
  { title: "Payment Plan Settings", desc: "Base plans and installment presets." },
  { title: "Roles & Permissions", desc: "Access matrix by role." },
  { title: "User Management", desc: "Invite, deactivate and audit users." },
];

type UserForm = Pick<User, "name" | "email" | "role" | "active">;

function Settings() {
  const users = useUserStore((s) => s.users);
  const addUser = useUserStore((s) => s.addUser);
  const updateUser = useUserStore((s) => s.updateUser);
  const deleteUser = useUserStore((s) => s.deleteUser);
  const [section, setSection] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>({ name: "", email: "", role: "Viewer", active: true });

  return (
    <PageWrap>
      <PageHeader title="Settings" subtitle="Configure the tracker to match your workflow." />
      {!section ? (
        <div className="grid gap-3 md:grid-cols-2">
          {SECTIONS.map((s) => (
            <button key={s.title} onClick={() => setSection(s.title)} className="card-soft p-5 text-left transition-shadow hover:shadow-[var(--shadow-elevated)]">
              <div className="font-semibold">{s.title}</div>
              <div className="text-sm text-muted-foreground">{s.desc}</div>
            </button>
          ))}
        </div>
      ) : section === "User Management" ? (
        <div>
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => setSection(null)}>← Back</Button>
          <div className="mb-4 flex justify-between">
            <h3 className="font-semibold">Users</h3>
            <Button className="bg-primary" onClick={() => { setEditing(null); setForm({ name: "", email: "", role: "Viewer", active: true }); setModalOpen(true); }}><Plus className="mr-1 h-4 w-4" /> Invite User</Button>
          </div>
          <div className="card-soft overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr><th className="px-4 py-2 text-left">Name</th><th className="px-4 py-2 text-left">Email</th><th className="px-4 py-2 text-left">Role</th><th className="px-4 py-2 text-left">Status</th><th></th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">{u.role}</td>
                    <td className="px-4 py-3">{u.active ? "Active" : "Inactive"}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(u); setForm(u); setModalOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(u); setDeleteOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => setSection(null)}>← Back</Button>
          <div className="card-soft p-5 text-sm text-muted-foreground">{section} configuration — stored in local prototype settings.</div>
        </div>
      )}

      <EntityFormModal open={modalOpen} onOpenChange={setModalOpen} title={editing ? "Edit User" : "Invite User"} onSubmit={() => {
        if (editing) updateUser(editing.id, form);
        else addUser(form);
        toast.success(editing ? "User updated" : "User invited");
        setModalOpen(false);
      }}>
        <div className="grid gap-2">
          <input placeholder="Name" className="h-9 rounded-md border px-3 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Email" className="h-9 rounded-md border px-3 text-sm" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <select className="h-9 rounded-md border px-3 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as User["role"] })}>
            {["Admin", "Manager", "Viewer"].map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </EntityFormModal>
      <ConfirmDeleteDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Remove user?" onConfirm={() => { if (editing) { deleteUser(editing.id); toast.success("User removed"); } setDeleteOpen(false); }} />
    </PageWrap>
  );
}
