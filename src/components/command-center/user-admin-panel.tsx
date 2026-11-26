import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminDeleteDirectoryUser,
  adminDirectory,
  adminSaveDirectoryUser,
} from "@/server/api/command-center";
import type { User } from "@/types";

type Draft = {
  id?: string;
  name: string;
  email: string;
  role: "Admin" | "Manager" | "Viewer";
  productScope: "erp" | "crm";
  active: boolean;
  phone: string;
  jobTitle: string;
  department: string;
  password: string;
};

const EMPTY: Draft = {
  name: "",
  email: "",
  role: "Viewer",
  productScope: "erp",
  active: true,
  phone: "",
  jobTitle: "",
  department: "",
  password: "",
};

export function UserAdminPanel() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-directory"],
    queryFn: () => adminDirectory(),
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  const rows = query.data?.success ? query.data.data : [];

  async function save() {
    if (!draft) return;
    const result = await adminSaveDirectoryUser({
      data: {
        id: draft.id,
        name: draft.name,
        email: draft.email,
        role: draft.role,
        productScope: draft.productScope,
        active: draft.active,
        phone: draft.phone || undefined,
        jobTitle: draft.jobTitle || undefined,
        department: draft.department || undefined,
        password: draft.password || undefined,
      },
    });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(draft.id ? "User updated" : "User added");
    setDraft(null);
    await client.invalidateQueries({ queryKey: ["admin-directory"] });
  }

  async function remove(user: User) {
    if (user.platformOwner) return;
    if (!window.confirm(`Delete ${user.name}? Their login will stop working.`)) return;
    const result = await adminDeleteDirectoryUser({ data: { id: user.id } });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("User deleted");
    await client.invalidateQueries({ queryKey: ["admin-directory"] });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] text-slate-500">
          Only this owner account can add, edit, or delete users. Other Admin accounts can open
          Command Center and cannot use this tab.
        </p>
        <Button size="sm" className="h-8 shrink-0 text-xs" onClick={() => setDraft({ ...EMPTY })}>
          Add user
        </Button>
      </div>

      {query.data && !query.data.success ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {query.data.error}
        </p>
      ) : null}

      {draft ? (
        <form
          className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 dark:border-white/10 dark:bg-[#0E1C33]"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <Field label="Name" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
          <Field
            label="Login email"
            value={draft.email}
            disabled={Boolean(draft.id && rows.find((row) => row.id === draft.id)?.platformOwner)}
            onChange={(email) => setDraft({ ...draft, email })}
          />
          <label className="text-xs">
            <span className="mb-1 block text-slate-500">Role</span>
            <select
              value={draft.role}
              disabled={Boolean(draft.id && rows.find((row) => row.id === draft.id)?.platformOwner)}
              onChange={(event) =>
                setDraft({ ...draft, role: event.target.value as Draft["role"] })
              }
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="Admin">Admin</option>
              <option value="Manager">Manager</option>
              <option value="Viewer">Viewer</option>
            </select>
          </label>
          <label className="text-xs">
            <span className="mb-1 block text-slate-500">Product</span>
            <select
              value={draft.productScope}
              disabled={Boolean(draft.id && rows.find((row) => row.id === draft.id)?.platformOwner)}
              onChange={(event) =>
                setDraft({ ...draft, productScope: event.target.value as Draft["productScope"] })
              }
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="erp">ERP tracker</option>
              <option value="crm">CRM</option>
            </select>
          </label>
          <Field
            label="Job title"
            value={draft.jobTitle}
            onChange={(jobTitle) => setDraft({ ...draft, jobTitle })}
          />
          <Field
            label="Department"
            value={draft.department}
            onChange={(department) => setDraft({ ...draft, department })}
          />
          <Field label="Phone" value={draft.phone} onChange={(phone) => setDraft({ ...draft, phone })} />
          <Field
            label={draft.id ? "New password (optional)" : "Password"}
            value={draft.password}
            type="password"
            onChange={(password) => setDraft({ ...draft, password })}
          />
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={draft.active}
              disabled={Boolean(draft.id && rows.find((row) => row.id === draft.id)?.platformOwner)}
              onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
            />
            Active login
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" size="sm" className="h-8 text-xs">
              Save user
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {query.isLoading ? (
        <p className="text-sm text-slate-500">Loading users…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0E1C33]">
          <table className="w-full min-w-[40rem] text-left text-[13px]">
            <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                {["Name", "Email", "Role", "Product", "Status", ""].map((label) => (
                  <th key={label} className="px-3 py-2 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => (
                <tr key={user.id} className="border-b border-slate-100 last:border-0 dark:border-white/5">
                  <td className="px-3 py-2 font-medium">
                    {user.name}
                    {user.platformOwner ? (
                      <span className="ml-2 rounded bg-[#009bff]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#0077c2]">
                        Owner
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{user.email}</td>
                  <td className="px-3 py-2">{user.role}</td>
                  <td className="px-3 py-2 uppercase">{user.productScope ?? "erp"}</td>
                  <td className="px-3 py-2">{user.active ? "Active" : "Inactive"}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="mr-3 text-xs font-medium text-[#009bff]"
                      onClick={() =>
                        setDraft({
                          id: user.id,
                          name: user.name,
                          email: user.email,
                          role: (user.role === "Admin" || user.role === "Manager" || user.role === "Viewer"
                            ? user.role
                            : "Viewer") as Draft["role"],
                          productScope: user.productScope === "crm" ? "crm" : "erp",
                          active: user.active,
                          phone: user.phone ?? "",
                          jobTitle: user.jobTitle ?? "",
                          department: user.department ?? "",
                          password: "",
                        })
                      }
                    >
                      Edit
                    </button>
                    {user.platformOwner ? null : (
                      <button
                        type="button"
                        className="text-xs font-medium text-rose-600"
                        onClick={() => void remove(user)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="text-xs">
      <span className="mb-1 block text-slate-500">{label}</span>
      <Input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 text-sm"
      />
    </label>
  );
}
