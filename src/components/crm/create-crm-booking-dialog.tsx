import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  DesignTicketSearchableSelect,
  DesignTicketSelect,
} from "@/components/design-ticket/design-ticket-fields";
import {
  DesignTicketFormField,
  ticketFieldClass,
  ticketTextareaClass,
} from "@/components/design-ticket/design-ticket-shared";
import { DatePickerField } from "@/components/date-picker-field";
import { EntityFormModal } from "@/components/entity-form-modal";
import { Button } from "@/components/ui/button";
import { browserWallClockIso } from "@/lib/booking-slots";
import { resolveCrmSalesManagerDefaults } from "@/lib/crm-sales-manager-defaults";
import { todayYmd } from "@/lib/task-scheduling";
import { crmTaskAssigneeUsers } from "@/lib/task-defaults";
import { cn, isValidEmail } from "@/lib/utils";
import { useBookingStore } from "@/stores/useBookingStore";
import type { CrmAccount } from "@/types/crm-account";
import type { BookingEventType, BookingSlot } from "@/types/booking";
import type { User } from "@/types";

function formatSlotLabel(startsAt: string) {
  const time = startsAt.slice(11, 16);
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function accountGuestDefaults(account: CrmAccount | undefined) {
  if (!account) {
    return { guestName: "", guestEmail: "", guestPhone: "" };
  }
  const guestName =
    account.ownerName?.trim() ||
    account.pocName?.trim() ||
    account.contact?.trim() ||
    "";
  const guestEmail =
    account.ownerEmail?.trim() ||
    account.pocEmail?.trim() ||
    account.email?.trim() ||
    "";
  const guestPhone =
    account.ownerPhone?.trim() ||
    account.pocMobile?.trim() ||
    account.phone?.trim() ||
    "";
  return { guestName, guestEmail, guestPhone };
}

export function CreateCrmBookingDialog({
  open,
  onOpenChange,
  accounts,
  users,
  currentUserId,
  isAdmin,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: CrmAccount[];
  users: User[];
  currentUserId?: string;
  isAdmin: boolean;
  onCreated?: () => void;
}) {
  const ensureDefaults = useBookingStore((s) => s.ensureDefaults);
  const eventTypes = useBookingStore((s) => s.eventTypes);
  const listSlotsForEvent = useBookingStore((s) => s.listSlotsForEvent);
  const createCrmBooking = useBookingStore((s) => s.createCrmBooking);

  const [companyId, setCompanyId] = useState("");
  const [eventTypeId, setEventTypeId] = useState("");
  const [hostUserId, setHostUserId] = useState("");
  const [date, setDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);

  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => a.name.localeCompare(b.name)),
    [accounts],
  );

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === companyId),
    [accounts, companyId],
  );

  const executiveOptions = useMemo(() => crmTaskAssigneeUsers(users), [users]);

  const companyEventTypes = useMemo(
    () =>
      eventTypes
        .filter((e) => e.companyId === companyId && e.isActive)
        .sort((a, b) => a.title.localeCompare(b.title)),
    [eventTypes, companyId],
  );

  const effectiveHostUserId = isAdmin ? hostUserId : currentUserId ?? "";

  useEffect(() => {
    if (!open) return;
    const firstAccount = sortedAccounts[0]?.id ?? "";
    setCompanyId(firstAccount);
    setEventTypeId("");
    setHostUserId("");
    setDate("");
    setSelectedSlot(null);
    setSlots([]);
    setNotes("");
    const account = sortedAccounts.find((a) => a.id === firstAccount);
    const guest = accountGuestDefaults(account);
    setGuestName(guest.guestName);
    setGuestEmail(guest.guestEmail);
    setGuestPhone(guest.guestPhone);
  }, [open, sortedAccounts]);

  useEffect(() => {
    if (!open || !companyId) return;
    let cancelled = false;
    setBootstrapping(true);
    void ensureDefaults(companyId)
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setBootstrapping(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, companyId, ensureDefaults]);

  useEffect(() => {
    if (!open || !companyId) return;
    const defaults = resolveCrmSalesManagerDefaults(selectedAccount, users);
    if (isAdmin) {
      setHostUserId(defaults.userId ?? "");
    }
    const guest = accountGuestDefaults(selectedAccount);
    setGuestName(guest.guestName);
    setGuestEmail(guest.guestEmail);
    setGuestPhone(guest.guestPhone);
    setEventTypeId("");
    setDate("");
    setSelectedSlot(null);
    setSlots([]);
  }, [open, companyId, selectedAccount, users, isAdmin]);

  useEffect(() => {
    if (!open || !companyId || companyEventTypes.length === 0) {
      setEventTypeId("");
      return;
    }
    setEventTypeId((prev) =>
      prev && companyEventTypes.some((e) => e.id === prev) ? prev : companyEventTypes[0]!.id,
    );
  }, [open, companyId, companyEventTypes]);

  useEffect(() => {
    if (!open || !eventTypeId || !date || !effectiveHostUserId) {
      setSlots([]);
      setSelectedSlot(null);
      return;
    }

    let cancelled = false;
    setLoadingSlots(true);
    void listSlotsForEvent(eventTypeId, date, date, effectiveHostUserId)
      .then((rows) => {
        if (cancelled) return;
        const future = rows.filter((slot) => slot.startsAt >= browserWallClockIso());
        setSlots(future);
        setSelectedSlot((prev) =>
          prev && future.some((s) => s.startsAt === prev.startsAt) ? prev : null,
        );
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : "Failed to load slots");
        setSlots([]);
        setSelectedSlot(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, eventTypeId, date, effectiveHostUserId, listSlotsForEvent]);

  async function submit() {
    if (!companyId) {
      toast.error("Choose an account");
      return;
    }
    if (!eventTypeId) {
      toast.error("Choose a call type");
      return;
    }
    if (!date || !selectedSlot) {
      toast.error("Choose a date and time slot");
      return;
    }
    if (selectedSlot.startsAt < browserWallClockIso()) {
      toast.error("Choose a future time slot");
      return;
    }
    if (!guestName.trim()) {
      toast.error("Guest name is required");
      return;
    }
    if (!guestEmail.trim() || !isValidEmail(guestEmail)) {
      toast.error("Valid guest email is required");
      return;
    }
    if (isAdmin && !hostUserId) {
      toast.error("Choose an executive");
      return;
    }

    setSaving(true);
    try {
      await createCrmBooking({
        companyId,
        eventTypeId,
        hostUserId: isAdmin ? hostUserId : undefined,
        startsAt: selectedSlot.startsAt,
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim(),
        guestPhone: guestPhone.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success("Meeting created");
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create meeting");
    } finally {
      setSaving(false);
    }
  }

  const selectedType = companyEventTypes.find((e) => e.id === eventTypeId) as
    | BookingEventType
    | undefined;

  return (
    <EntityFormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Create meeting"
      submitLabel={saving ? "Creating…" : "Create meeting"}
      submitDisabled={saving || bootstrapping}
      contentClassName="max-w-xl"
      onSubmit={() => void submit()}
    >
      <div className="grid gap-4">
        <DesignTicketFormField label="Account" required>
          <DesignTicketSearchableSelect
            value={companyId}
            placeholder="Search account..."
            emptyLabel="No accounts found"
            options={sortedAccounts.map((a) => ({ value: a.id, label: a.name }))}
            onChange={setCompanyId}
          />
        </DesignTicketFormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <DesignTicketFormField label="Call type" required>
            <DesignTicketSelect
              value={eventTypeId}
              placeholder={bootstrapping ? "Loading…" : "Select call type"}
              options={companyEventTypes.map((e) => ({ value: e.id, label: e.title }))}
              onChange={setEventTypeId}
              disabled={!companyId || bootstrapping || companyEventTypes.length === 0}
            />
          </DesignTicketFormField>

          {isAdmin ? (
            <DesignTicketFormField label="Executive" required>
              <DesignTicketSelect
                value={hostUserId}
                placeholder="Select executive"
                options={executiveOptions.map((u) => ({ value: u.id, label: u.name }))}
                onChange={setHostUserId}
              />
            </DesignTicketFormField>
          ) : null}
        </div>

        <DesignTicketFormField label="Date" required>
          <DatePickerField
            value={date}
            onChange={(next) => {
              setDate(next);
              setSelectedSlot(null);
            }}
            min={todayYmd()}
            yearsBack={0}
            yearsForward={1}
            modal
            className={ticketFieldClass}
          />
        </DesignTicketFormField>

        {date ? (
          <DesignTicketFormField label="Time slot" required>
            {loadingSlots ? (
              <p className="text-xs text-muted-foreground">Loading available slots…</p>
            ) : slots.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No open slots for {selectedType?.title ?? "this call type"} on this date.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {slots.map((slot) => {
                  const active = selectedSlot?.startsAt === slot.startsAt;
                  return (
                    <Button
                      key={slot.startsAt}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      className={cn("h-8 px-2.5 text-xs tabular-nums", active && "shadow-sm")}
                      onClick={() => setSelectedSlot(slot)}
                    >
                      {formatSlotLabel(slot.startsAt)}
                    </Button>
                  );
                })}
              </div>
            )}
          </DesignTicketFormField>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <DesignTicketFormField label="Guest name" required>
            <input
              className={ticketFieldClass}
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Customer name"
            />
          </DesignTicketFormField>
          <DesignTicketFormField label="Guest email" required>
            <input
              type="email"
              className={ticketFieldClass}
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="customer@company.com"
            />
          </DesignTicketFormField>
        </div>

        <DesignTicketFormField label="Guest phone">
          <input
            className={ticketFieldClass}
            value={guestPhone}
            onChange={(e) => setGuestPhone(e.target.value)}
            placeholder="Optional"
          />
        </DesignTicketFormField>

        <DesignTicketFormField label="Notes">
          <textarea
            className={ticketTextareaClass}
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional context for the call"
          />
        </DesignTicketFormField>
      </div>
    </EntityFormModal>
  );
}
