import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EntityFormModal } from "@/components/entity-form-modal";
import { DesignTicketSelect } from "@/components/design-ticket/design-ticket-fields";
import { normalizeManagerName } from "@/lib/crm-account-sheet-import";
import { useCrmAccountStore, useUserStore } from "@/stores";
import type { CrmAccount } from "@/types/crm-account";

type TransferField = "salesManagerName" | "supportManager1" | "supportManager2";

const FIELD_OPTIONS: { value: TransferField; label: string }[] = [
  { value: "salesManagerName", label: "Sales Manager" },
  { value: "supportManager1", label: "Support Manager 1" },
  { value: "supportManager2", label: "Support Manager 2" },
];

function managerMatches(value: string | undefined, fromName: string) {
  const from = normalizeManagerName(fromName);
  if (!from) return false;
  const current = normalizeManagerName(value ?? "");
  return Boolean(current) && current === from;
}

const UNSET = "__unset__";

export function CrmAccountClientTransferModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const accounts = useCrmAccountStore((s) => s.accounts);
  const upsertAccountsBatch = useCrmAccountStore((s) => s.upsertAccountsBatch);
  const users = useUserStore((s) => s.users);

  const [field, setField] = useState<TransferField>("salesManagerName");
  const [fromName, setFromName] = useState(UNSET);
  const [toName, setToName] = useState(UNSET);

  const crmUsers = useMemo(
    () =>
      users
        .filter((u) => u.active && u.productScope === "crm")
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  );

  const fromOptions = useMemo(() => {
    const names = new Set<string>();
    for (const account of accounts) {
      const value = account[field]?.trim();
      if (value) names.add(value);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [accounts, field]);

  const matching = useMemo(
    () =>
      fromName === UNSET
        ? []
        : accounts.filter((account) => managerMatches(account[field], fromName)),
    [accounts, field, fromName],
  );

  function reset() {
    setField("salesManagerName");
    setFromName(UNSET);
    setToName(UNSET);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function onSubmit() {
    if (fromName === UNSET || !fromName.trim()) {
      toast.error("Choose the manager to transfer from");
      return;
    }
    if (toName === UNSET || !toName.trim()) {
      toast.error("Choose the manager to transfer to");
      return;
    }
    if (normalizeManagerName(fromName) === normalizeManagerName(toName)) {
      toast.error("From and To must be different managers");
      return;
    }
    if (matching.length === 0) {
      toast.error("No accounts match the selected manager");
      return;
    }

    const payloads: CrmAccount[] = matching.map((account) => ({
      ...account,
      [field]: toName.trim(),
    }));
    upsertAccountsBatch(payloads);
    toast.success(
      `Transferred ${payloads.length} client${payloads.length === 1 ? "" : "s"} to ${toName.trim()}`,
    );
    handleOpenChange(false);
  }

  return (
    <EntityFormModal
      open={open}
      onOpenChange={handleOpenChange}
      title="Client transfer"
      submitLabel="Transfer clients"
      onSubmit={onSubmit}
      contentClassName="max-w-lg"
    >
      <div className="grid gap-3">
        <p className="text-xs text-muted-foreground">
          Reassign all CRM accounts from one manager to another. Matching is by the selected role
          field on each account.
        </p>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Role</label>
          <DesignTicketSelect
            compact
            value={field}
            onChange={(value) => {
              setField(value as TransferField);
              setFromName(UNSET);
            }}
            options={FIELD_OPTIONS}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">From manager</label>
          <DesignTicketSelect
            compact
            value={fromName}
            onChange={setFromName}
            options={[
              { value: UNSET, label: "Select current manager…" },
              ...fromOptions.map((name) => ({ value: name, label: name })),
            ]}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">To manager</label>
          <DesignTicketSelect
            compact
            value={toName}
            onChange={setToName}
            options={[
              { value: UNSET, label: "Select new manager…" },
              ...crmUsers.map((u) => ({ value: u.name, label: `${u.name} · ${u.role}` })),
            ]}
          />
        </div>

        {fromName !== UNSET ? (
          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{matching.length}</span>{" "}
            {matching.length === 1 ? "account" : "accounts"} will be reassigned
            {matching.length > 0 ? (
              <>
                {" "}
                from <span className="font-medium text-foreground">{fromName}</span> to{" "}
                {toName !== UNSET ? (
                  <span className="font-medium text-foreground">{toName}</span>
                ) : (
                  "the selected manager"
                )}
                .
              </>
            ) : (
              "."
            )}
          </div>
        ) : null}
      </div>
    </EntityFormModal>
  );
}
