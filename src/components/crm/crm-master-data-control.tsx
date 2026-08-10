import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Pencil, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  CrmAccountFormFields,
  crmAccountSchema,
  crmAccountToFormValues,
  normalizeCrmAccountForm,
  type CrmAccountFormValues,
} from "@/components/crm/crm-account-form";
import { ConfirmDeleteDialog, EntityFormModal } from "@/components/entity-form-modal";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { calcCrmOnboardingProgress } from "@/data/crm-onboarding-defaults";
import { cn } from "@/lib/utils";
import { useCrmAccountStore, useCrmOnboardingStore } from "@/stores";
import type { CrmAccount } from "@/types/crm-account";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

export function CrmMasterDataControl() {
  const accounts = useCrmAccountStore((s) => s.accounts);
  const upsertAccount = useCrmAccountStore((s) => s.upsertAccount);
  const deleteAccount = useCrmAccountStore((s) => s.deleteAccount);
  const ensure = useCrmOnboardingStore((s) => s.ensureForCompany);
  const removeRecord = useCrmOnboardingStore((s) => s.removeRecord);
  const records = useCrmOnboardingStore((s) => s.records);

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<CrmAccount | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<CrmAccount | null>(null);

  const form = useForm<CrmAccountFormValues>({
    resolver: zodResolver(crmAccountSchema),
    defaultValues: crmAccountToFormValues(accounts[0] ?? ({} as CrmAccount)),
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...accounts].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return list;
    return list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        a.contact.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q),
    );
  }, [accounts, query]);

  function openEdit(account: CrmAccount) {
    setEditing(account);
    form.reset(crmAccountToFormValues(account));
    setModalOpen(true);
  }

  function onSubmit() {
    void form.handleSubmit((values) => {
      if (!editing) return;
      const data = normalizeCrmAccountForm(values);
      upsertAccount({
        ...editing,
        ...data,
        status: editing.status,
      });
      ensure(editing.id, data.companyType);
      toast.success(`${data.name} updated`);
      setModalOpen(false);
      setEditing(null);
    })();
  }

  function confirmDelete() {
    if (!deleting) return;
    deleteAccount(deleting.id);
    removeRecord(deleting.id);
    toast.success(`${deleting.name} deleted`);
    setDeleteOpen(false);
    setDeleting(null);
  }

  return (
    <div className="space-y-2.5">
      <div className="card-soft p-3">
        <h3 className="text-sm font-semibold">Data Control</h3>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Edit or delete live CRM account records — same role as ERP Master → Data Control.
        </p>
        <div className="relative mt-2.5 max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search accounts…"
            className="h-8 w-full rounded-md border bg-background pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      <div className="card-soft overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-muted/60 text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Account</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Users</th>
                <th className="px-3 py-2 font-medium">Progress</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const rec =
                  records.find((r) => r.companyId === a.id) ?? ensure(a.id, a.companyType);
                const pct = calcCrmOnboardingProgress(rec);
                return (
                  <tr key={a.id} className="border-t border-border/60 hover:bg-muted/30">
                    <td className="px-3 py-2.5">
                      <Link
                        to="/crm/accounts/$accountId"
                        params={{ accountId: a.id }}
                        className="font-medium text-primary hover:underline"
                      >
                        {a.name}
                      </Link>
                      <div className="text-[10px] text-muted-foreground">
                        {a.city}
                        {a.region ? ` · ${a.region}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{a.companyType}</td>
                    <td className="px-3 py-2.5 tabular-nums">{a.usersPurchased ?? "—"}</td>
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{pct}%</td>
                    <td className="px-3 py-2.5">
                      <Pill
                        tone={
                          a.status === "live"
                            ? "success"
                            : a.status === "onboarding"
                              ? "warning"
                              : a.status === "churned"
                                ? "danger"
                                : "info"
                        }
                      >
                        {a.status}
                      </Pill>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => openEdit(a)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => {
                          setDeleting(a);
                          setDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className={cn("px-3 py-10 text-center text-muted-foreground")}
                  >
                    No accounts match your search.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <EntityFormModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditing(null);
        }}
        title="Edit CRM account"
        submitLabel="Save changes"
        onSubmit={onSubmit}
        contentClassName="max-w-2xl"
      >
        <CrmAccountFormFields form={form} />
      </EntityFormModal>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete CRM account?"
        description={
          deleting
            ? `This will remove ${deleting.name} and its onboarding master data.`
            : "This account will be removed."
        }
        confirmLabel="Delete account"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
