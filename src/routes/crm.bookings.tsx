import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  CalendarOff,
  Check,
  Clock,
  Inbox,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DatePickerField } from "@/components/date-picker-field";
import {
  DesignTicketKpiGrid,
  DesignTicketPageHeader,
  DesignTicketTabNav,
  TICKET_EASE,
} from "@/components/design-ticket/design-ticket-shared";
import { EmptyState } from "@/components/empty-state";
import { PageWrap } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/stores/useAuthStore";
import { useBookingStore } from "@/stores/useBookingStore";
import { useCrmAccountStore } from "@/stores/useCrmAccountStore";
import { useUserStore } from "@/stores/useUserStore";
import { DEFAULT_BOOKING_TIMEZONE } from "@/types/booking";
import { cn } from "@/lib/utils";

const EASE = TICKET_EASE;

const TABS = [
  { id: "pending", label: "Pending", icon: Inbox },
  { id: "upcoming", label: "Upcoming", icon: Calendar },
  { id: "availability", label: "Availability", icon: Clock },
  { id: "blocked", label: "Blocked", icon: CalendarOff },
] as const;

type TabId = (typeof TABS)[number]["id"];

const WEEKDAYS = [
  { id: 1, label: "Mon" },
  { id: 2, label: "Tue" },
  { id: 3, label: "Wed" },
  { id: 4, label: "Thu" },
  { id: 5, label: "Fri" },
  { id: 6, label: "Sat" },
  { id: 0, label: "Sun" },
] as const;

export const Route = createFileRoute("/crm/bookings")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: TABS.some((t) => t.id === search.tab) ? (search.tab as TabId) : ("pending" as TabId),
  }),
  component: CrmBookingsPage,
});

function formatWhen(iso: string) {
  const date = iso.slice(0, 10);
  const time = iso.slice(11, 16);
  return `${date} · ${time}`;
}

function CrmBookingsPage() {
  const user = useCurrentUser();
  const navigate = useNavigate({ from: "/crm/bookings" });
  const search = Route.useSearch();
  const tab = search.tab;

  const refreshStaff = useBookingStore((s) => s.refreshStaff);
  const appointments = useBookingStore((s) => s.appointments);
  const availability = useBookingStore((s) => s.availability);
  const blocks = useBookingStore((s) => s.blocks);
  const eventTypes = useBookingStore((s) => s.eventTypes);
  const acceptAppointment = useBookingStore((s) => s.acceptAppointment);
  const declineAppointment = useBookingStore((s) => s.declineAppointment);
  const cancelAppointment = useBookingStore((s) => s.cancelAppointment);
  const rescheduleAppointment = useBookingStore((s) => s.rescheduleAppointment);
  const listSlotsForEvent = useBookingStore((s) => s.listSlotsForEvent);
  const saveAvailabilityWindows = useBookingStore((s) => s.saveAvailabilityWindows);
  const addBlock = useBookingStore((s) => s.addBlock);
  const removeBlock = useBookingStore((s) => s.removeBlock);

  const accounts = useCrmAccountStore((s) => s.accounts);
  const users = useUserStore((s) => s.users);

  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleSlots, setRescheduleSlots] = useState<{ startsAt: string; endsAt: string }[]>(
    [],
  );
  const [timezone, setTimezone] = useState(user?.timezone || DEFAULT_BOOKING_TIMEZONE);
  const [draftWindows, setDraftWindows] = useState<
    { weekday: number; startTime: string; endTime: string; enabled: boolean }[]
  >([]);
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReason, setBlockReason] = useState("");

  useEffect(() => {
    void refreshStaff().catch((err) => {
      console.warn("[bookings]", err);
      toast.error("Failed to load bookings");
    });
  }, [refreshStaff]);

  useEffect(() => {
    const hostId = user?.id;
    if (!hostId) return;
    const mine = availability.filter((a) => a.hostUserId === hostId);
    if (mine[0]?.timezone) setTimezone(mine[0].timezone);
    setDraftWindows(
      WEEKDAYS.map((d) => {
        const row = mine.find((a) => a.weekday === d.id && a.isActive);
        return {
          weekday: d.id,
          startTime: row?.startTime ?? "10:00",
          endTime: row?.endTime ?? "17:00",
          enabled: Boolean(row),
        };
      }),
    );
  }, [availability, user?.id]);

  const now = useMemo(() => new Date().toISOString().slice(0, 19), [appointments]);

  const pending = useMemo(
    () => appointments.filter((a) => a.status === "pending").sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [appointments],
  );
  const upcoming = useMemo(
    () =>
      appointments
        .filter((a) => a.status === "confirmed" && a.startsAt >= now)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [appointments, now],
  );
  const myAvailability = useMemo(
    () => availability.filter((a) => a.hostUserId === user?.id),
    [availability, user?.id],
  );
  const myBlocks = useMemo(
    () => blocks.filter((b) => b.hostUserId === user?.id).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [blocks, user?.id],
  );

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? id.slice(0, 8);
  const hostName = (id: string) => users.find((u) => u.id === id)?.name ?? id.slice(0, 8);
  const eventTitle = (id: string) => eventTypes.find((e) => e.id === id)?.title ?? "Meeting";

  async function loadRescheduleSlots(appointmentId: string, date: string) {
    const appt = appointments.find((a) => a.id === appointmentId);
    if (!appt || !date) return;
    setRescheduleDate(date);
    try {
      const slots = await listSlotsForEvent(appt.eventTypeId, date, date);
      setRescheduleSlots(slots);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load slots");
      setRescheduleSlots([]);
    }
  }

  return (
    <PageWrap compact>
      <DesignTicketPageHeader
        compact
        title="Bookings"
        subtitle="Confirm portal requests, manage availability, and block time off."
      />

      <DesignTicketKpiGrid
        size="compact"
        columns={3}
        items={[
          { id: "pending", label: "Pending", value: pending.length, tone: "text-warning-foreground" },
          { id: "upcoming", label: "Upcoming", value: upcoming.length, tone: "text-info" },
          {
            id: "hours",
            label: "Hours set",
            value: myAvailability.filter((a) => a.isActive).length,
            tone: "text-success",
          },
        ]}
      />

      <DesignTicketTabNav
        compact
        tabs={TABS.map(({ id, label, icon }) => ({ id, label, icon }))}
        activeId={tab}
        onChange={(id) => void navigate({ search: { tab: id as TabId } })}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.28, ease: EASE }}
          className="space-y-3"
        >
          {tab === "pending" && (
            pending.length === 0 ? (
              <EmptyState title="No pending requests" description="Portal booking requests will show up here." />
            ) : (
              pending.map((appt) => (
                <div key={appt.id} className="card-soft space-y-2 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">{appt.guestName}</div>
                      <div className="text-xs text-muted-foreground">
                        {eventTitle(appt.eventTypeId)} · {accountName(appt.companyId)} ·{" "}
                        {formatWhen(appt.startsAt)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {appt.guestEmail}
                        {appt.guestPhone ? ` · ${appt.guestPhone}` : ""} · Host {hostName(appt.hostUserId)}
                      </div>
                      {appt.notes ? (
                        <p className="mt-1 text-xs text-muted-foreground">{appt.notes}</p>
                      ) : null}
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        className="h-8 gap-1 text-xs"
                        onClick={() => {
                          void acceptAppointment(appt.id, noteById[appt.id])
                            .then(() => toast.success("Booking confirmed"))
                            .catch((err) =>
                              toast.error(err instanceof Error ? err.message : "Failed"),
                            );
                        }}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 text-xs"
                        onClick={() => {
                          void declineAppointment(appt.id, noteById[appt.id])
                            .then(() => toast.success("Booking declined"))
                            .catch((err) =>
                              toast.error(err instanceof Error ? err.message : "Failed"),
                            );
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                        Decline
                      </Button>
                    </div>
                  </div>
                  <Input
                    placeholder="Optional note to guest"
                    className="h-8 text-xs"
                    value={noteById[appt.id] ?? ""}
                    onChange={(e) =>
                      setNoteById((prev) => ({ ...prev, [appt.id]: e.target.value }))
                    }
                  />
                </div>
              ))
            )
          )}

          {tab === "upcoming" && (
            upcoming.length === 0 ? (
              <EmptyState title="No upcoming meetings" description="Confirmed bookings appear here." />
            ) : (
              upcoming.map((appt) => (
                <div key={appt.id} className="card-soft space-y-2 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">{appt.guestName}</div>
                      <div className="text-xs text-muted-foreground">
                        {eventTitle(appt.eventTypeId)} · {accountName(appt.companyId)} ·{" "}
                        {formatWhen(appt.startsAt)}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => {
                          setRescheduleId(appt.id);
                          const d = appt.startsAt.slice(0, 10);
                          void loadRescheduleSlots(appt.id, d);
                        }}
                      >
                        Reschedule
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 text-xs"
                        onClick={() => {
                          void cancelAppointment(appt.id)
                            .then(() => toast.success("Booking cancelled"))
                            .catch((err) =>
                              toast.error(err instanceof Error ? err.message : "Failed"),
                            );
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                  {rescheduleId === appt.id && (
                    <div className="space-y-2 rounded-md border border-dashed p-2">
                      <DatePickerField
                        value={rescheduleDate}
                        onChange={(d) => void loadRescheduleSlots(appt.id, d)}
                        yearsBack={0}
                        yearsForward={1}
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {rescheduleSlots.map((slot) => (
                          <button
                            key={slot.startsAt}
                            type="button"
                            className="rounded-md border px-2 py-1 text-[10px] hover:border-primary"
                            onClick={() => {
                              void rescheduleAppointment(appt.id, slot.startsAt)
                                .then(() => {
                                  toast.success("Rescheduled");
                                  setRescheduleId(null);
                                })
                                .catch((err) =>
                                  toast.error(err instanceof Error ? err.message : "Failed"),
                                );
                            }}
                          >
                            {slot.startsAt.slice(11, 16)}
                          </button>
                        ))}
                        {rescheduleSlots.length === 0 && (
                          <span className="text-[10px] text-muted-foreground">No open slots</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )
          )}

          {tab === "availability" && (
            <div className="card-soft space-y-3 p-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground">Timezone</label>
                  <Input
                    className="h-8 w-[200px] text-xs"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    void saveAvailabilityWindows({
                      timezone,
                      windows: draftWindows
                        .filter((w) => w.enabled)
                        .map((w) => ({
                          weekday: w.weekday,
                          startTime: w.startTime,
                          endTime: w.endTime,
                          isActive: true,
                        })),
                    })
                      .then(() => toast.success("Availability saved"))
                      .catch((err) =>
                        toast.error(err instanceof Error ? err.message : "Failed to save"),
                      );
                  }}
                >
                  Save weekly hours
                </Button>
              </div>
              <div className="space-y-1.5">
                {WEEKDAYS.map((day) => {
                  const draft = draftWindows.find((w) => w.weekday === day.id);
                  if (!draft) return null;
                  return (
                    <div
                      key={day.id}
                      className="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5"
                    >
                      <label className="flex w-14 items-center gap-1.5 text-xs font-medium">
                        <input
                          type="checkbox"
                          checked={draft.enabled}
                          onChange={(e) =>
                            setDraftWindows((prev) =>
                              prev.map((w) =>
                                w.weekday === day.id ? { ...w, enabled: e.target.checked } : w,
                              ),
                            )
                          }
                        />
                        {day.label}
                      </label>
                      <Input
                        type="time"
                        className={cn("h-8 w-[110px] text-xs", !draft.enabled && "opacity-40")}
                        disabled={!draft.enabled}
                        value={draft.startTime}
                        onChange={(e) =>
                          setDraftWindows((prev) =>
                            prev.map((w) =>
                              w.weekday === day.id ? { ...w, startTime: e.target.value } : w,
                            ),
                          )
                        }
                      />
                      <span className="text-[10px] text-muted-foreground">to</span>
                      <Input
                        type="time"
                        className={cn("h-8 w-[110px] text-xs", !draft.enabled && "opacity-40")}
                        disabled={!draft.enabled}
                        value={draft.endTime}
                        onChange={(e) =>
                          setDraftWindows((prev) =>
                            prev.map((w) =>
                              w.weekday === day.id ? { ...w, endTime: e.target.value } : w,
                            ),
                          )
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "blocked" && (
            <div className="space-y-3">
              <div className="card-soft space-y-2 p-3">
                <div className="text-xs font-semibold">Add block</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Starts</label>
                    <Input
                      type="datetime-local"
                      className="h-8 text-xs"
                      value={blockStart}
                      onChange={(e) => setBlockStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Ends</label>
                    <Input
                      type="datetime-local"
                      className="h-8 text-xs"
                      value={blockEnd}
                      onChange={(e) => setBlockEnd(e.target.value)}
                    />
                  </div>
                </div>
                <Input
                  placeholder="Reason (vacation, focus…)"
                  className="h-8 text-xs"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                />
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    if (!blockStart || !blockEnd) {
                      toast.error("Start and end are required");
                      return;
                    }
                    const startsAt = blockStart.length === 16 ? `${blockStart}:00` : blockStart;
                    const endsAt = blockEnd.length === 16 ? `${blockEnd}:00` : blockEnd;
                    void addBlock({ startsAt, endsAt, reason: blockReason || undefined })
                      .then(() => {
                        toast.success("Block added");
                        setBlockStart("");
                        setBlockEnd("");
                        setBlockReason("");
                      })
                      .catch((err) =>
                        toast.error(err instanceof Error ? err.message : "Failed"),
                      );
                  }}
                >
                  Add block
                </Button>
              </div>

              {myBlocks.length === 0 ? (
                <EmptyState title="No blocks" description="Blocked dates won't offer open slots." />
              ) : (
                myBlocks.map((block) => (
                  <div
                    key={block.id}
                    className="card-soft flex items-center justify-between gap-2 p-3"
                  >
                    <div>
                      <div className="text-xs font-medium">
                        {formatWhen(block.startsAt)} → {formatWhen(block.endsAt)}
                      </div>
                      {block.reason ? (
                        <div className="text-[10px] text-muted-foreground">{block.reason}</div>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        void removeBlock(block.id)
                          .then(() => toast.success("Block removed"))
                          .catch((err) =>
                            toast.error(err instanceof Error ? err.message : "Failed"),
                          );
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </PageWrap>
  );
}
