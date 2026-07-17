import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, ArrowLeftRight, Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { PageHeader, PageWrap } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EntityFormModal, ConfirmDeleteDialog } from "@/components/entity-form-modal";
import { usePermissions } from "@/hooks/use-permissions";
import { assignableManagerUsers, resolveAssigneeLabel } from "@/lib/managers";
import { useEmployeeStore, useCompanyStore, useUserStore } from "@/stores";
import type { Employee } from "@/types";

type EmployeeForm = Pick<Employee, "name" | "role" | "region" | "email">;

export const Route = createFileRoute("/employees")({
  component: Employees,
});

function Employees() {
  const employees = useEmployeeStore((s) => s.employees);
  const addEmployee = useEmployeeStore((s) => s.addEmployee);
  const updateEmployee = useEmployeeStore((s) => s.updateEmployee);
  const deleteEmployee = useEmployeeStore((s) => s.deleteEmployee);
  const transferManager = useEmployeeStore((s) => s.transferManager);
  const companies = useCompanyStore((s) => s.companies);
  const users = useUserStore((s) => s.users);
  const { isAdmin } = usePermissions();

  const [modalOpen, setModalOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");

  const form = useForm<EmployeeForm>({
    defaultValues: { name: "", role: "Onboarding Manager", region: "West", email: "" },
  });

  const assignableUsers = useMemo(() => assignableManagerUsers(users), [users]);

  const enriched = employees.map((e) => {
    const linkedUser = users.find((u) => u.email.toLowerCase() === e.email.toLowerCase());
    const managerIds = new Set([e.id, linkedUser?.id].filter(Boolean) as string[]);
    return {
      ...e,
      companies: companies.filter((c) => managerIds.has(c.onboardingManagerId)).length,
    };
  });

  function onSubmit() {
    form.handleSubmit((data) => {
      if (editing) {
        updateEmployee(editing.id, data);
        toast.success("Employee updated");
      } else {
        addEmployee(data);
        toast.success("Employee added. Login user is synced (default password for new account: buildesk123).");
      }
      setModalOpen(false);
    })();
  }

  function doTransfer() {
    if (!isAdmin) {
      toast.error("Only admins can transfer onboarding managers");
      return;
    }
    if (!fromId || !toId) return;
    const companyIds = companies.filter((c) => c.onboardingManagerId === fromId).map((c) => c.id);
    transferManager(fromId, toId, companyIds);
    toast.success(
      `Transferred ${companyIds.length} ${companyIds.length === 1 ? "company" : "companies"} from ${resolveAssigneeLabel(fromId, users, employees)} to ${resolveAssigneeLabel(toId, users, employees)}`,
    );
    setTransferOpen(false);
  }

  return (
    <PageWrap>
      <PageHeader
        title="Employees & Onboarding Managers"
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {isAdmin && (
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  setFromId("");
                  setToId("");
                  setTransferOpen(true);
                }}
              >
                <ArrowLeftRight className="h-4 w-4" /> Transfer Manager
              </Button>
            )}
            <Button
              className="gap-1.5 bg-primary"
              onClick={() => {
                setEditing(null);
                form.reset();
                setModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add Employee
            </Button>
          </div>
        }
      />
      <div className="space-y-2.5 md:hidden">
        {enriched.map((e) => (
          <div key={e.id} className="rounded-xl border border-border bg-card p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {e.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{e.name}</div>
                <div className="text-xs text-muted-foreground">
                  {e.role} · {e.region}
                </div>
              </div>
              <span className="text-xs text-muted-foreground">{e.companies} cos</span>
            </div>
            <div className="mt-2 flex justify-end gap-1 border-t border-border/60 pt-2">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setEditing(e);
                  form.reset({ name: e.name, role: e.role, region: e.region, email: e.email });
                  setModalOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setEditing(e);
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="card-soft hidden overflow-hidden md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Role</th>
              <th className="px-4 py-2 text-left">Region</th>
              <th className="px-4 py-2 text-left">Assigned Companies</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {enriched.map((e) => (
              <tr key={e.id} className="border-t hover:bg-muted/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      {e.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div className="font-medium">{e.name}</div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{e.role}</td>
                <td className="px-4 py-3">{e.region}</td>
                <td className="px-4 py-3">{e.companies}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditing(e);
                      form.reset({ name: e.name, role: e.role, region: e.region, email: e.email });
                      setModalOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditing(e);
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

      <EntityFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Edit Employee" : "Add Employee"}
        onSubmit={onSubmit}
      >
        <div className="grid gap-3">
          <input {...form.register("name")} placeholder="Name" className="h-9 rounded-md border px-3 text-sm" />
          <input {...form.register("email")} placeholder="Email" className="h-9 rounded-md border px-3 text-sm" />
          <select {...form.register("role")} className="h-9 rounded-md border px-3 text-sm">
            {["Onboarding Manager", "Implementation Lead", "Implementation Engineer", "CSM", "Admin"].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input {...form.register("region")} placeholder="Region" className="h-9 rounded-md border px-3 text-sm" />
        </div>
      </EntityFormModal>

      <EntityFormModal
        open={transferOpen}
        onOpenChange={setTransferOpen}
        title="Transfer Onboarding Manager"
        onSubmit={doTransfer}
        submitLabel="Transfer"
      >
        <div className="grid gap-3">
          <p className="text-xs text-muted-foreground">
            Choose users from User Management. Only admins can transfer assignments.
          </p>
          <select
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
            className="h-9 rounded-md border px-3 text-sm"
          >
            <option value="">From user…</option>
            {assignableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {u.role}
              </option>
            ))}
          </select>
          <select
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            className="h-9 rounded-md border px-3 text-sm"
          >
            <option value="">To user…</option>
            {assignableUsers
              .filter((u) => u.id !== fromId)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.role}
                </option>
              ))}
          </select>
        </div>
      </EntityFormModal>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete employee?"
        onConfirm={() => {
          if (editing) {
            deleteEmployee(editing.id);
            toast.success("Employee removed");
          }
          setDeleteOpen(false);
        }}
      />
    </PageWrap>
  );
}
