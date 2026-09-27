import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DatePickerField } from "@/components/date-picker-field";
import { EntityFormModal } from "@/components/entity-form-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  roundMoney,
  sumInstallments,
  validateInstallmentTotal,
} from "@/lib/crm-account-commercial";
import {
  buildEqualRenewalInstallments,
  defaultRenewalEndDate,
  nextRenewalStartDate,
} from "@/lib/crm-account-renewal";
import { renewCrmAccount } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import { useCrmAccountStore } from "@/stores/useCrmAccountStore";
import type { CrmAccount, CrmAccountInstallment } from "@/types/crm-account";

type Props = {
  account: CrmAccount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRenewed?: (account: CrmAccount) => void;
};

export function CrmAccountRenewDialog({ account, open, onOpenChange, onRenewed }: Props) {
  const previousEnd = account?.endDate?.slice(0, 10) ?? "";
  const nextStart = account ? nextRenewalStartDate(account.endDate) : null;

  const [dealSize, setDealSize] = useState(0);
  const [paymentReceived, setPaymentReceived] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [usersPurchased, setUsersPurchased] = useState(0);
  const [gstPercent, setGstPercent] = useState(18);
  const [termMonths, setTermMonths] = useState(12);
  const [endDate, setEndDate] = useState("");
  const [installmentCount, setInstallmentCount] = useState(1);
  const [rows, setRows] = useState<CrmAccountInstallment[]>([]);
  const [saving, setSaving] = useState(false);

  /** Renewal installments schedule against pending only (never fall back to full deal). */
  function scheduleTotal(pending: number) {
    return pending > 0 ? roundMoney(pending) : 0;
  }

  function syncRows(count: number, pending: number, start: string) {
    const total = scheduleTotal(pending);
    if (total <= 0 || count <= 0) {
      setRows([]);
      return;
    }
    setRows(buildEqualRenewalInstallments({ totalAmount: total, count, startDate: start }));
  }

  useEffect(() => {
    if (!open || !account || !previousEnd || !nextStart) return;
    const deal = Number(account.dealSize) || 0;
    const users = Number(account.usersPurchased) || 0;
    const gst = Number(account.gstPercent) || 18;
    const months = 12;
    const end = defaultRenewalEndDate(previousEnd, months);
    setDealSize(deal);
    setPaymentReceived(0);
    setPendingAmount(deal);
    setUsersPurchased(users);
    setGstPercent(gst);
    setTermMonths(months);
    setEndDate(end);
    setInstallmentCount(deal > 0 ? 1 : 0);
    syncRows(deal > 0 ? 1 : 0, deal, nextStart);
  }, [open, account?.id, previousEnd, nextStart, account]);

  useEffect(() => {
    if (!open || !previousEnd) return;
    setEndDate(defaultRenewalEndDate(previousEnd, termMonths));
  }, [termMonths, open, previousEnd]);

  const installmentCheck = useMemo(() => {
    const target = scheduleTotal(pendingAmount);
    if (target <= 0) {
      return { ok: true as const, total: 0, target: 0 };
    }
    return validateInstallmentTotal(
      dealSize,
      pendingAmount,
      rows.map(({ kind: _k, ...rest }) => rest),
    );
  }, [dealSize, pendingAmount, rows]);

  const renewalTotal = sumInstallments(rows);

  function onDealChange(nextDeal: number) {
    const deal = roundMoney(Math.max(0, nextDeal));
    const received = roundMoney(Math.min(deal, paymentReceived));
    const pending = roundMoney(Math.max(0, deal - received));
    setDealSize(deal);
    setPaymentReceived(received);
    setPendingAmount(pending);
    if (nextStart) {
      const count =
        pending <= 0 ? 0 : installmentCount > 0 ? installmentCount : 1;
      if (count !== installmentCount) setInstallmentCount(count);
      syncRows(count, pending, nextStart);
    }
  }

  function onReceivedChange(nextReceived: number) {
    const received = roundMoney(Math.min(dealSize, Math.max(0, nextReceived)));
    const pending = roundMoney(Math.max(0, dealSize - received));
    setPaymentReceived(received);
    setPendingAmount(pending);
    if (nextStart) {
      const count = pending <= 0 ? 0 : installmentCount > 0 ? installmentCount : 1;
      if (count !== installmentCount) setInstallmentCount(count);
      syncRows(count, pending, nextStart);
    }
  }

  function onPendingChange(nextPending: number) {
    const pending = roundMoney(Math.min(dealSize, Math.max(0, nextPending)));
    const received = roundMoney(Math.max(0, dealSize - pending));
    setPendingAmount(pending);
    setPaymentReceived(received);
    if (nextStart) {
      const count = pending <= 0 ? 0 : installmentCount > 0 ? installmentCount : 1;
      if (count !== installmentCount) setInstallmentCount(count);
      syncRows(count, pending, nextStart);
    }
  }

  async function submit() {
    if (!account || !nextStart) return;
    if (!endDate) {
      toast.error("Choose a renewal end date");
      return;
    }
    if (dealSize <= 0) {
      toast.error("Enter a renewal deal amount");
      return;
    }
    if (roundMoney(paymentReceived + pendingAmount) > dealSize + 0.01) {
      toast.error("Payment received + pending cannot exceed deal amount");
      return;
    }
    const scheduleTarget = scheduleTotal(pendingAmount);
    if (scheduleTarget > 0) {
      if (rows.length === 0) {
        toast.error("Add at least one installment for the pending amount");
        return;
      }
      if (!installmentCheck.ok) {
        toast.error(installmentCheck.message ?? "Installment total must match pending amount");
        return;
      }
    }

    setSaving(true);
    try {
      const updated = await renewCrmAccount({
        data: {
          accountId: account.id,
          dealSize,
          usersPurchased,
          gstPercent,
          endDate,
          paymentReceived,
          pendingAmount,
          renewalInstallments: rows.map((r) => ({
            amount: r.amount,
            dueDate: r.dueDate,
            id: r.id,
          })),
        },
      });
      useCrmAccountStore.getState().hydrateAccounts(
        useCrmAccountStore.getState().accounts.map((a) => (a.id === updated.id ? updated : a)),
      );
      toast.success(`${account.name} renewed through ${formatDate(updated.endDate)}`);
      onRenewed?.(updated);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Renew failed");
    } finally {
      setSaving(false);
    }
  }

  if (!account) return null;

  return (
    <EntityFormModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Renew · ${account.name}`}
      contentClassName="max-w-2xl"
      submitLabel={saving ? "Saving…" : "Confirm renewal"}
      submitDisabled={saving}
      onSubmit={() => void submit()}
    >
      <p className="mb-3 text-[11px] text-muted-foreground">
        {nextStart
          ? `Current service ends ${formatDate(previousEnd)}. New period starts ${formatDate(nextStart)}. Old collections stay on the ledger.`
          : "Set the next service period commercial terms."}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Renewal deal amount (incl. GST)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={dealSize || ""}
            onChange={(e) => onDealChange(Number(e.target.value) || 0)}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label>Users</Label>
          <Input
            type="number"
            min={0}
            step={1}
            value={usersPurchased || ""}
            onChange={(e) => setUsersPurchased(Number(e.target.value) || 0)}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label>Payment received (this renewal)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={paymentReceived || ""}
            onChange={(e) => onReceivedChange(Number(e.target.value) || 0)}
            className="h-8 text-xs"
          />
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Initial collection for this deal — added to payment history.
          </p>
        </div>
        <div>
          <Label>Pending amount</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={pendingAmount || ""}
            onChange={(e) => onPendingChange(Number(e.target.value) || 0)}
            className="h-8 text-xs"
          />
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Remaining for this renewal · installments schedule against this.
          </p>
        </div>
        <div>
          <Label>GST %</Label>
          <Input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={gstPercent}
            onChange={(e) => setGstPercent(Number(e.target.value) || 0)}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label>Term (months)</Label>
          <Input
            type="number"
            min={1}
            max={120}
            step={1}
            value={termMonths}
            onChange={(e) => setTermMonths(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            className="h-8 text-xs"
          />
          <p className="mt-0.5 text-[10px] text-muted-foreground">Updates end date; you can still edit it.</p>
        </div>
        <div>
          <Label>New start date</Label>
          <Input value={nextStart ? formatDate(nextStart) : "—"} disabled className="h-8 text-xs" />
        </div>
        <div>
          <Label>New end date</Label>
          <DatePickerField value={endDate} onChange={setEndDate} compact />
        </div>
        <div>
          <Label>No. of installments</Label>
          <Input
            type="number"
            min={0}
            max={60}
            step={1}
            value={installmentCount}
            onChange={(e) => {
              const count = Math.max(0, Math.floor(Number(e.target.value) || 0));
              setInstallmentCount(count);
              if (nextStart) syncRows(count, pendingAmount, nextStart);
            }}
            className="h-8 text-xs"
            disabled={pendingAmount <= 0}
          />
        </div>
        <div className="flex items-end">
          <p
            className={cn(
              "text-[11px]",
              installmentCheck.ok ? "text-muted-foreground" : "font-medium text-destructive",
            )}
          >
            {pendingAmount <= 0
              ? "No pending — installments not required"
              : `Scheduled ₹${renewalTotal.toLocaleString("en-IN")}${
                  !installmentCheck.ok ? ` · ${installmentCheck.message}` : " (must match pending)"
                }`}
          </p>
        </div>
      </div>

      {pendingAmount > 0 ? (
        <div className="mt-3 space-y-1.5">
          <div className="text-xs font-semibold">Renewal installments</div>
          {rows.map((row, idx) => (
            <div key={`${row.dueDate}-${idx}`} className="grid grid-cols-[1fr_1fr] gap-2">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={row.amount || ""}
                onChange={(e) => {
                  const amount = Number(e.target.value) || 0;
                  setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, amount } : r)));
                }}
                className="h-8 text-xs"
                placeholder="Amount"
              />
              <DatePickerField
                value={row.dueDate}
                onChange={(dueDate) => {
                  setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, dueDate } : r)));
                }}
                compact
              />
            </div>
          ))}
        </div>
      ) : null}
    </EntityFormModal>
  );
}
