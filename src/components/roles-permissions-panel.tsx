import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, Lock, Pencil, Plus, RotateCcw, Shield, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDeleteDialog, EntityFormModal } from "@/components/entity-form-modal";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { usePermissions } from "@/hooks/use-permissions";
import { countEnabledPermissions } from "@/lib/permissions";
import { useSettingsStore, useUserStore } from "@/stores";
import { cn } from "@/lib/utils";
import {
  ADMIN_LOCKED_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  type RoleDefinition,
  type RolePermissionKey,
} from "@/types";

const ease = [0.22, 1, 0.36, 1] as const;

export function RolesPermissionsPanel() {
  const { isAdmin } = usePermissions();
  const roles = useSettingsStore((s) => s.roles);
  const addRole = useSettingsStore((s) => s.addRole);
  const updateRole = useSettingsStore((s) => s.updateRole);
  const deleteRole = useSettingsStore((s) => s.deleteRole);
  const setRolePermission = useSettingsStore((s) => s.setRolePermission);
  const resetRoles = useSettingsStore((s) => s.resetRoles);
  const users = useUserStore((s) => s.users);

  const [selectedId, setSelectedId] = useState<string>(() => roles[0]?.id ?? "");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [cloneFromId, setCloneFromId] = useState("");

  const selected = useMemo(
    () => roles.find((r) => r.id === selectedId) ?? roles[0],
    [roles, selectedId],
  );

  const usersOnRole = useMemo(
    () => (selected ? users.filter((u) => u.role === selected.key).length : 0),
    [users, selected],
  );

  if (!isAdmin) {
    return (
      <div className="card-soft flex flex-col items-center justify-center gap-3 p-10 text-center">
        <Shield className="h-10 w-10 text-muted-foreground/50" />
        <div className="text-lg font-semibold">Admin access required</div>
        <p className="max-w-sm text-sm text-muted-foreground">
          Roles and permissions can only be viewed and managed by Administrators.
        </p>
      </div>
    );
  }

  function openCreate() {
    setNewName("");
    setNewDescription("");
    setCloneFromId(roles.find((r) => r.key === "Manager")?.id ?? roles[0]?.id ?? "");
    setCreateOpen(true);
  }

  function submitCreate() {
    if (newName.trim().length < 2) {
      toast.error("Role name must be at least 2 characters");
      return;
    }
    const role = addRole({
      name: newName.trim(),
      description: newDescription.trim() || undefined,
      cloneFromId: cloneFromId || undefined,
    });
    setSelectedId(role.id);
    toast.success(`Role “${role.name}” created`);
    setCreateOpen(false);
  }

  function submitEdit() {
    if (!selected || newName.trim().length < 2) {
      toast.error("Role name must be at least 2 characters");
      return;
    }
    updateRole(selected.id, { name: newName.trim(), description: newDescription.trim() });
    toast.success("Role updated");
    setEditOpen(false);
  }

  function confirmDelete() {
    if (!selected) return;
    if (usersOnRole > 0) {
      toast.error(`Cannot delete — ${usersOnRole} user(s) still assigned to this role`);
      setDeleteOpen(false);
      return;
    }
    const ok = deleteRole(selected.id);
    if (ok) {
      toast.success("Role deleted");
      setSelectedId(roles.find((r) => r.id !== selected.id)?.id ?? "");
    }
    setDeleteOpen(false);
  }

  function togglePermission(key: RolePermissionKey, value: boolean) {
    if (!selected) return;
    if (selected.key === "Admin" && ADMIN_LOCKED_PERMISSIONS.includes(key)) return;
    setRolePermission(selected.id, key, value);
  }

  function isPermissionLocked(role: RoleDefinition, key: RolePermissionKey) {
    return role.key === "Admin" && ADMIN_LOCKED_PERMISSIONS.includes(key);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Roles & Permissions</h3>
          <p className="text-sm text-muted-foreground">
            Create roles, assign capabilities, and control who sees Administration.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
            resetRoles();
            toast.success("Roles reset to defaults");
          }}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset defaults
          </Button>
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" /> New role
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(220px,280px)_1fr]">
        <motion.div layout className="card-soft overflow-hidden">
          <div className="border-b px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Roles ({roles.length})
          </div>
          <ul className="max-h-[min(70vh,520px)] overflow-y-auto p-2">
            {roles.map((role) => {
              const active = role.id === selected?.id;
              const enabled = countEnabledPermissions(role.permissions);
              const assigned = users.filter((u) => u.role === role.key).length;
              return (
                <li key={role.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(role.id)}
                    className={cn(
                      "mb-1 flex w-full flex-col rounded-lg px-3 py-2.5 text-left transition-all",
                      active
                        ? "bg-primary/10 ring-1 ring-primary/30"
                        : "hover:bg-muted/60",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{role.name}</span>
                      {role.isSystem && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          System
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {enabled} permissions · {assigned} user{assigned === 1 ? "" : "s"}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </motion.div>

        <AnimatePresence mode="wait">
          {selected && (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease }}
              className="card-soft overflow-hidden"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-semibold">{selected.name}</h4>
                    {selected.isSystem && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-medium">
                        <Lock className="h-3 w-3" /> System role
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Key: <code className="rounded bg-muted px-1 py-0.5">{selected.key}</code>
                    {selected.description ? ` · ${selected.description}` : ""}
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {usersOnRole} user{usersOnRole === 1 ? "" : "s"} assigned
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Edit role"
                    onClick={() => {
                      setNewName(selected.name);
                      setNewDescription(selected.description ?? "");
                      setEditOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Duplicate as new role"
                    onClick={() => {
                      setNewName(`${selected.name} Copy`);
                      setNewDescription(selected.description ?? "");
                      setCloneFromId(selected.id);
                      setCreateOpen(true);
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  {!selected.isSystem && (
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Delete role"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-4 p-5">
                {PERMISSION_GROUPS.map((group, gi) => (
                  <motion.div
                    key={group.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: gi * 0.05, duration: 0.25, ease }}
                    className="rounded-xl border border-border/80 bg-muted/20 p-4"
                  >
                    <div className="mb-3">
                      <div className="text-sm font-semibold">{group.label}</div>
                      <p className="text-xs text-muted-foreground">{group.description}</p>
                      {group.id === "administration" && (
                        <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                          Administration permissions unlock Master Config, user management, and this screen.
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      {group.keys.map((key) => {
                        const locked = isPermissionLocked(selected, key);
                        const checked = selected.permissions[key];
                        return (
                          <div
                            key={key}
                            className={cn(
                              "flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2.5 transition-colors",
                              checked && "border-primary/20",
                            )}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-sm font-medium">
                                {PERMISSION_LABELS[key]}
                                {locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {PERMISSION_DESCRIPTIONS[key]}
                              </p>
                            </div>
                            <Switch
                              size="sm"
                              checked={checked}
                              disabled={locked}
                              onCheckedChange={(v) => togglePermission(key, v)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <EntityFormModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create role"
        submitLabel="Create role"
        onSubmit={submitCreate}
      >
        <div className="grid gap-3">
          <input
            placeholder="Role name"
            className="h-9 rounded-md border px-3 text-sm"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <textarea
            placeholder="Description (optional)"
            className="min-h-[72px] rounded-md border px-3 py-2 text-sm"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />
          <label className="text-xs font-medium">
            Copy permissions from
            <select
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              value={cloneFromId}
              onChange={(e) => setCloneFromId(e.target.value)}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </EntityFormModal>

      <EntityFormModal
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit role"
        submitLabel="Save"
        onSubmit={submitEdit}
      >
        <div className="grid gap-3">
          <input
            placeholder="Role name"
            className="h-9 rounded-md border px-3 text-sm"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <textarea
            placeholder="Description"
            className="min-h-[72px] rounded-md border px-3 py-2 text-sm"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />
          {selected?.isSystem && (
            <p className="text-xs text-muted-foreground">
              System role keys cannot be changed. Duplicate this role to create a custom variant.
            </p>
          )}
        </div>
      </EntityFormModal>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete role “${selected?.name}”?`}
        description="Users must be reassigned before deleting a role."
        onConfirm={confirmDelete}
      />
    </div>
  );
}
