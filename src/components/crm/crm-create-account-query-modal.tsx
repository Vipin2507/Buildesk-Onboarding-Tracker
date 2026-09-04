import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EntityFormModal } from "@/components/entity-form-modal";
import { DesignTicketSelect } from "@/components/design-ticket/design-ticket-fields";
import {
  CRM_ACCOUNT_QUERY_CATEGORY_LABEL,
  type CrmAccountQuery,
  type CrmAccountQueryCategory,
} from "@/types/crm-account-query";
import { useCrmAccountQueryStore } from "@/stores";

type AccountOption = { id: string; name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountOption[];
  /** When set, the account picker is hidden and this account is used. */
  defaultCompanyId?: string;
  onCreated?: (query: CrmAccountQuery, companyId: string) => void;
};

export function CrmCreateAccountQueryModal({
  open,
  onOpenChange,
  accounts,
  defaultCompanyId,
  onCreated,
}: Props) {
  const createQuery = useCrmAccountQueryStore((s) => s.createQuery);
  const refreshCompanyQueries = useCrmAccountQueryStore((s) => s.refreshCompanyQueries);

  const [companyId, setCompanyId] = useState(defaultCompanyId ?? "");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<CrmAccountQueryCategory>("general");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => a.name.localeCompare(b.name)),
    [accounts],
  );

  useEffect(() => {
    if (!open) return;
    setCompanyId(defaultCompanyId ?? sortedAccounts[0]?.id ?? "");
    setTitle("");
    setCategory("general");
    setMessage("");
  }, [open, defaultCompanyId, sortedAccounts]);

  async function handleSubmit() {
    const targetCompanyId = defaultCompanyId ?? companyId;
    if (!targetCompanyId) {
      toast.error("Select an account");
      return;
    }
    if (!title.trim()) {
      toast.error("Subject is required");
      return;
    }

    setSubmitting(true);
    try {
      const created = await createQuery({
        companyId: targetCompanyId,
        title: title.trim(),
        category,
        initialMessage: message.trim() || undefined,
      });
      await refreshCompanyQueries(targetCompanyId).catch(() => {});
      toast.success("Query created");
      onOpenChange(false);
      onCreated?.(created, targetCompanyId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create query");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <EntityFormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Start account query"
      submitLabel="Create query"
      onSubmit={handleSubmit}
      submitDisabled={submitting}
    >
      {!defaultCompanyId ? (
        <label className="mb-3 block text-xs font-medium">
          Account
          <div className="mt-1">
            <DesignTicketSelect
              compact
              value={companyId}
              onChange={setCompanyId}
              options={sortedAccounts.map((a) => ({ value: a.id, label: a.name }))}
              placeholder="Select account…"
            />
          </div>
        </label>
      ) : null}
      <label className="mb-3 block text-xs font-medium">
        Subject
        <input
          className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What do you need to discuss?"
        />
      </label>
      <label className="mb-3 block text-xs font-medium">
        Category
        <select
          className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value as CrmAccountQueryCategory)}
        >
          {Object.entries(CRM_ACCOUNT_QUERY_CATEGORY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium">
        Initial message
        <textarea
          className="mt-1 min-h-[72px] w-full resize-y rounded-md border px-3 py-2 text-sm"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe your question…"
          rows={3}
        />
      </label>
    </EntityFormModal>
  );
}
