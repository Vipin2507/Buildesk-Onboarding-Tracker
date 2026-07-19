import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/date-picker-field";
import { Pill } from "@/components/status-pill";
import { EntityFormModal } from "@/components/entity-form-modal";
import type { CompanyModule, ModuleKey, ModuleSubscriptionStatus } from "@/types";
import { MODULE_SUBSCRIPTION_STATUSES } from "@/types";
import { useCrmEventStore } from "@/stores";
import { formatDate } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";

function daysRemaining(validUntil?: string) {
  if (!validUntil) return null;
  const ms = new Date(validUntil).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

export function ModuleSubscriptionPanel({
  companyId,
  module,
}: {
  companyId: string;
  module: CompanyModule;
}) {
  const upsertSubscription = useCrmEventStore((s) => s.upsertSubscription);
  const subscriptions = useCrmEventStore((s) => s.subscriptions);
  const subscriptionEvents = useCrmEventStore((s) => s.subscriptionEvents);
  const { can, isAdmin } = usePermissions();
  const canManage = isAdmin || can("manageModuleSubscriptions");

  const sub = useMemo(
    () =>
      subscriptions.find(
        (s) => s.companyId === companyId && s.moduleKey === module.moduleKey,
      ) ?? null,
    [subscriptions, companyId, module.moduleKey],
  );

  const status: ModuleSubscriptionStatus =
    sub?.status ?? module.subscriptionStatus ?? (module.optedIn ? "active" : "inactive");
  const startDate = sub?.startDate ?? module.subscriptionStartDate ?? module.optedOnDate;
  const validUntil = sub?.validUntil ?? module.subscriptionValidUntil;
  const remaining = daysRemaining(validUntil);

  const history = useMemo(
    () =>
      subscriptionEvents
        .filter((e) => e.companyId === companyId && e.moduleKey === module.moduleKey)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 8),
    [subscriptionEvents, companyId, module.moduleKey],
  );

  const [open, setOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<ModuleSubscriptionStatus>(status);
  const [nextStart, setNextStart] = useState(startDate ?? "");
  const [nextValidUntil, setNextValidUntil] = useState(validUntil ?? "");
  const [reason, setReason] = useState("");

  function openEditor(preset?: ModuleSubscriptionStatus) {
    setNextStatus(preset ?? status);
    setNextStart(startDate ?? new Date().toISOString().slice(0, 10));
    setNextValidUntil(validUntil ?? "");
    setReason("");
    setOpen(true);
  }

  function submit() {
    if (!nextStart) {
      toast.error("Start date is required");
      return;
    }
    upsertSubscription({
      companyId,
      moduleKey: module.moduleKey as ModuleKey,
      status: nextStatus,
      startDate: nextStart,
      validUntil: nextValidUntil || null,
      reason: reason.trim() || undefined,
    });
    toast.success("Subscription updated");
    setOpen(false);
  }

  return (
    <div className="card-soft space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold">Module subscription</h4>
          <p className="text-xs text-muted-foreground">
            Independent commercial term — separate from Live / progress.
          </p>
        </div>
        <Pill
          tone={
            status === "active"
              ? "success"
              : status === "expired" || status === "cancelled"
                ? "danger"
                : "muted"
          }
        >
          {status}
        </Pill>
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <div className="text-xs text-muted-foreground">Start</div>
          <div>{startDate ? formatDate(startDate) : "—"}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Valid until</div>
          <div>{validUntil ? formatDate(validUntil) : "No end date"}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Days remaining</div>
          <div>
            {remaining == null ? "—" : remaining < 0 ? `Expired ${Math.abs(remaining)}d ago` : `${remaining}d`}
          </div>
        </div>
      </div>

      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => openEditor("active")}>
            Activate / Renew
          </Button>
          <Button size="sm" variant="outline" onClick={() => openEditor("paused")}>
            Pause
          </Button>
          <Button size="sm" variant="outline" onClick={() => openEditor("cancelled")}>
            Cancel
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openEditor()}>
            Edit dates
          </Button>
        </div>
      ) : null}

      {history.length > 0 ? (
        <div className="border-t pt-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Subscription history
          </div>
          <div className="space-y-1.5">
            {history.map((h) => (
              <div key={h.id} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{h.newStatus}</span>
                {" · "}
                {h.actorName}
                {" · "}
                {formatDate(h.createdAt.slice(0, 10))}
                {h.reason ? ` — ${h.reason}` : ""}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <EntityFormModal
        open={open}
        onOpenChange={setOpen}
        title={`Update ${module.label} subscription`}
        submitLabel="Save subscription"
        onSubmit={submit}
      >
        <div className="space-y-3">
          <label className="block text-xs font-medium">
            Status
            <select
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value as ModuleSubscriptionStatus)}
            >
              {MODULE_SUBSCRIPTION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium">
            Start date
            <div className="mt-1">
              <DatePickerField value={nextStart} onChange={setNextStart} modal yearsBack={10} yearsForward={2} />
            </div>
          </label>
          <label className="block text-xs font-medium">
            Valid until
            <div className="mt-1">
              <DatePickerField
                value={nextValidUntil}
                onChange={setNextValidUntil}
                modal
                yearsBack={1}
                yearsForward={10}
              />
            </div>
          </label>
          <label className="block text-xs font-medium">
            Reason / notes
            <textarea
              className="mt-1 min-h-16 w-full rounded-md border px-3 py-2 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        </div>
      </EntityFormModal>
    </div>
  );
}
