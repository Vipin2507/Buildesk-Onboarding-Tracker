import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  CalendarOff,
  Check,
  Clock,
  History,
  Inbox,
  LayoutList,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DatePickerField } from "@/components/date-picker-field";
import { DataTable } from "@/components/data-table";
import {
  DesignTicketKpiGrid,
  DesignTicketPageHeader,
  DesignTicketTabNav,
  TICKET_EASE,
} from "@/components/design-ticket/design-ticket-shared";
import { EmptyState } from "@/components/empty-state";
import { WeeklyHoursEditor } from "@/components/crm/weekly-hours-editor";
import { BookingBlocksPanel } from "@/components/crm/booking-blocks-panel";
import { ListToolbar } from "@/components/list-toolbar";
import { PageWrap } from "@/components/page-header";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isAdminRoleKey } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/stores/useAuthStore";
import { useBookingStore } from "@/stores/useBookingStore";
import { useCrmAccountStore } from "@/stores/useCrmAccountStore";
import { useUserStore } from "@/stores/useUserStore";
import {
  BOOKING_STATUS_LABEL,
  DEFAULT_BOOKING_TIMEZONE,
  type BookingAppointment,
  type BookingAppointmentStatus,
} from "@/types/booking";

const EASE = TICKET_EASE;
const POLL_MS = 15_000;

const BOOKING_TABS = [
  { id: "all", label: "All", icon: LayoutList },
  { id: "pending", label: "Pending", icon: Inbox },
  { id: "upcoming", label: "Upcoming", icon: Calendar },
  { id: "past", label: "Past", icon: History },
  { id: "closed", label: "Closed", icon: XCircle },
] as const;

const SETTINGS_TABS = [
  { id: "availability", label: "Availability", icon: Clock },
  { id: "blocked", label: "Blocked", icon: CalendarOff },
] as const;

const TABS = [...BOOKING_TABS, ...SETTINGS_TABS] as const;

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

const CLOSED_STATUSES: BookingAppointmentStatus[] = ["declined", "cancelled"];

export const Route = createFileRoute("/crm/bookings")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: TABS.some((t) => t.id === search.tab) ? (search.tab as TabId) : ("pending" as TabId),
  }),
  component: CrmBookingsPage,
});

function formatWhen(startsAt: string, endsAt?: string) {
  const date = startsAt.slice(0, 10);
  const start = startsAt.slice(11, 16);
  if (!endsAt) return `${date} · ${start}`;
  return `${date} · ${start} – ${endsAt.slice(11, 16)}`;
}

function slotDurationMinutes(startsAt: string, endsAt: string) {
  const start = new Date(startsAt.replace(" ", "T")).getTime();
  const end = new Date(endsAt.replace(" ", "T")).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "—";
  return `${Math.round((end - start) / 60_000)} min`;
}

function statusTone(status: BookingAppointmentStatus) {
  if (status === "confirmed") return "success" as const;
  if (status === "pending") return "warning" as const;
  if (status === "postponed") return "info" as const;
  if (status === "declined" || status === "cancelled") return "danger" as const;
  return "muted" as const;
}

function CrmBookingsPage() {
  const user = useCurrentUser();
  const isAdmin = isAdminRoleKey(user?.role);
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
  const postponeAppointment = useBookingStore((s) => s.postponeAppointment);
  const rescheduleAppointment = useBookingStore((s) => s.rescheduleAppointment);
  const listSlotsForEvent = useBookingStore((s) => s.listSlotsForEvent);
  const saveAvailabilityWindows = useBookingStore((s) => s.saveAvailabilityWindows);
  const addBlock = useBookingStore((s) => s.addBlock);
  const removeBlock = useBookingStore((s) => s.removeBlock);

  const accounts = useCrmAccountStore((s) => s.accounts);
  const users = useUserStore((s) => s.users);

  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
  const [savingHours, setSavingHours] = useState(false);
  const [addingBlock, setAddingBlock] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [hostFilter, setHostFilter] = useState("all");
  const [callTypeFilter, setCallTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      try {
        await refreshStaff();
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (/sign in required/i.test(msg)) return;
        console.warn("[bookings]", err);
      }
    }

    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refreshStaff, user]);

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

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "—";
  const hostName = (id: string) => users.find((u) => u.id === id)?.name ?? "—";
  const eventTitle = (id: string) => eventTypes.find((e) => e.id === id)?.title ?? "Call";

  const hostOptions = useMemo(() => {
    const ids = [...new Set(appointments.map((a) => a.hostUserId))];
    return ids
      .map((id) => ({ value: id, label: hostName(id) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [appointments, users]);

  const callTypeOptions = useMemo(
    () =>
      eventTypes
        .map((e) => ({ value: e.id, label: e.title }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [eventTypes],
  );

  const tabFiltered = useMemo(() => {
    return appointments.filter((a) => {
      if (tab === "pending") return a.status === "pending";
      if (tab === "upcoming") {
        return (
          (a.status === "confirmed" || a.status === "postponed") && a.startsAt >= now
        );
      }
      if (tab === "past") {
        return (
          (a.status === "confirmed" || a.status === "completed" || a.status === "postponed") &&
          a.startsAt < now
        );
      }
      if (tab === "closed") return CLOSED_STATUSES.includes(a.status) || a.status === "cancelled";
      return true;
    });
  }, [appointments, now, tab]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tabFiltered
      .filter((a) => {
        if (statusFilter !== "all" && a.status !== statusFilter) return false;
        if (accountFilter !== "all" && a.companyId !== accountFilter) return false;
        if (hostFilter !== "all" && a.hostUserId !== hostFilter) return false;
        if (callTypeFilter !== "all" && a.eventTypeId !== callTypeFilter) return false;
        const day = a.startsAt.slice(0, 10);
        if (dateFrom && day < dateFrom) return false;
        if (dateTo && day > dateTo) return false;
        if (!q) return true;
        return (
          a.guestName.toLowerCase().includes(q) ||
          a.guestEmail.toLowerCase().includes(q) ||
          (a.guestPhone ?? "").toLowerCase().includes(q) ||
          accountName(a.companyId).toLowerCase().includes(q) ||
          hostName(a.hostUserId).toLowerCase().includes(q) ||
          eventTitle(a.eventTypeId).toLowerCase().includes(q) ||
          (a.notes ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  }, [
    tabFiltered,
    query,
    statusFilter,
    accountFilter,
    hostFilter,
    callTypeFilter,
    dateFrom,
    dateTo,
    accounts,
    users,
    eventTypes,
  ]);

  const pendingCount = useMemo(
    () => appointments.filter((a) => a.status === "pending").length,
    [appointments],
  );
  const upcomingCount = useMemo(
    () =>
      appointments.filter(
        (a) =>
          (a.status === "confirmed" || a.status === "postponed") && a.startsAt >= now,
      ).length,
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

  const activeFilterCount = [
    statusFilter !== "all",
    accountFilter !== "all",
    hostFilter !== "all",
    callTypeFilter !== "all",
    Boolean(dateFrom),
    Boolean(dateTo),
  ].filter(Boolean).length;

  const isListTab = BOOKING_TABS.some((t) => t.id === tab);

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

  function clearFilters() {
    setQuery("");
    setStatusFilter("all");
    setAccountFilter("all");
    setHostFilter("all");
    setCallTypeFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  function renderActions(appt: BookingAppointment) {
    if (appt.status === "pending") {
      return (
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            className="h-7 gap-1 px-2 text-[10px]"
            onClick={(e) => {
              e.stopPropagation();
              void acceptAppointment(appt.id, noteById[appt.id])
                .then(() => toast.success("Booking approved"))
                .catch((err) => toast.error(err instanceof Error ? err.message : "Failed"));
            }}
          >
            <Check className="h-3 w-3" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-[10px]"
            onClick={(e) => {
              e.stopPropagation();
              void declineAppointment(appt.id, noteById[appt.id])
                .then(() => toast.success("Booking declined"))
                .catch((err) => toast.error(err instanceof Error ? err.message : "Failed"));
            }}
          >
            <X className="h-3 w-3" />
            Decline
          </Button>
        </div>
      );
    }
    if (
      (appt.status === "confirmed" || appt.status === "postponed") &&
      appt.startsAt >= now
    ) {
      return (
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[10px]"
            onClick={(e) => {
              e.stopPropagation();
              setExpandedId(appt.id);
              const d = appt.startsAt.slice(0, 10);
              void loadRescheduleSlots(appt.id, d);
            }}
          >
            Reschedule
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[10px]"
            onClick={(e) => {
              e.stopPropagation();
              void postponeAppointment(appt.id, noteById[appt.id])
                .then(() => toast.success("Booking postponed"))
                .catch((err) => toast.error(err instanceof Error ? err.message : "Failed"));
            }}
          >
            Postpone
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[10px]"
            onClick={(e) => {
              e.stopPropagation();
              void cancelAppointment(appt.id)
                .then(() => toast.success("Booking cancelled"))
                .catch((err) => toast.error(err instanceof Error ? err.message : "Failed"));
            }}
          >
            Cancel
          </Button>
        </div>
      );
    }
    return <span className="text-[10px] text-muted-foreground">—</span>;
  }

  return (
    <PageWrap compact>
      <DesignTicketPageHeader
        compact
        title="Bookings"
        subtitle="Review portal call requests, manage schedules, and set availability."
      />

      <DesignTicketKpiGrid
        size="compact"
        columns={4}
        items={[
          {
            id: "pending",
            label: "Pending",
            value: pendingCount,
            tone: "text-warning-foreground",
            onClick: () => void navigate({ search: { tab: "pending" } }),
          },
          {
            id: "upcoming",
            label: "Upcoming",
            value: upcomingCount,
            tone: "text-info",
            onClick: () => void navigate({ search: { tab: "upcoming" } }),
          },
          {
            id: "all",
            label: "Total",
            value: appointments.length,
            tone: "text-primary",
            onClick: () => void navigate({ search: { tab: "all" } }),
          },
          {
            id: "hours",
            label: "Hours set",
            value: myAvailability.filter((a) => a.isActive).length,
            tone: "text-success",
            onClick: () => void navigate({ search: { tab: "availability" } }),
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
          {isListTab && (
            <>
              <ListToolbar
                search={query}
                onSearchChange={setQuery}
                searchPlaceholder="Search guest, account, executive, call type…"
                resultCount={filtered.length}
                resultLabel="bookings"
                activeFilterCount={activeFilterCount}
                onClear={activeFilterCount > 0 || query ? clearFilters : undefined}
                dateRange={{
                  from: dateFrom,
                  to: dateTo,
                  onFromChange: setDateFrom,
                  onToChange: setDateTo,
                }}
                selects={[
                  ...(tab === "all"
                    ? [
                        {
                          id: "status",
                          label: "Status",
                          value: statusFilter,
                          onChange: setStatusFilter,
                          options: [
                            { value: "all", label: "All statuses" },
                            ...Object.entries(BOOKING_STATUS_LABEL).map(([value, label]) => ({
                              value,
                              label,
                            })),
                          ],
                        },
                      ]
                    : []),
                  {
                    id: "account",
                    label: "Account",
                    value: accountFilter,
                    onChange: setAccountFilter,
                    options: [
                      { value: "all", label: "All accounts" },
                      ...accounts.map((a) => ({ value: a.id, label: a.name })),
                    ],
                  },
                  ...(isAdmin
                    ? [
                        {
                          id: "host",
                          label: "Executive",
                          value: hostFilter,
                          onChange: setHostFilter,
                          options: [{ value: "all", label: "All executives" }, ...hostOptions],
                        },
                      ]
                    : []),
                  {
                    id: "callType",
                    label: "Call type",
                    value: callTypeFilter,
                    onChange: setCallTypeFilter,
                    options: [{ value: "all", label: "All types" }, ...callTypeOptions],
                  },
                ]}
              />

              {filtered.length === 0 ? (
                <EmptyState
                  title={
                    tab === "pending"
                      ? "No pending requests"
                      : tab === "upcoming"
                        ? "No upcoming calls"
                        : "No bookings match your filters"
                  }
                  description={
                    tab === "pending"
                      ? "Portal booking requests appear here and in your notification bell."
                      : "Try clearing filters or check another tab."
                  }
                />
              ) : (
                <div className="space-y-2">
                  <DataTable
                    data={filtered}
                    hideSearch
                    pageSize={12}
                    getRowId={(a) => a.id}
                    onRowClick={(a) =>
                      setExpandedId((prev) => (prev === a.id ? null : a.id))
                    }
                    columns={[
                      {
                        key: "guestName",
                        header: "Guest",
                        sortable: true,
                        render: (a) => (
                          <div>
                            <div className="font-medium">{a.guestName}</div>
                            <div className="text-[10px] text-muted-foreground">{a.guestEmail}</div>
                          </div>
                        ),
                      },
                      {
                        key: "companyId",
                        header: "Account",
                        sortable: true,
                        render: (a) => (
                          <span className="text-xs">{accountName(a.companyId)}</span>
                        ),
                      },
                      {
                        key: "eventTypeId",
                        header: "Call type",
                        render: (a) => (
                          <span className="text-xs">{eventTitle(a.eventTypeId)}</span>
                        ),
                      },
                      {
                        key: "startsAt",
                        header: "When",
                        sortable: true,
                        render: (a) => (
                          <div className="text-xs tabular-nums">
                            <div>{formatWhen(a.startsAt, a.endsAt)}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {slotDurationMinutes(a.startsAt, a.endsAt)}
                            </div>
                          </div>
                        ),
                      },
                      {
                        key: "hostUserId",
                        header: "Executive",
                        render: (a) => (
                          <span className="text-xs font-medium">{hostName(a.hostUserId)}</span>
                        ),
                      },
                      {
                        key: "status",
                        header: "Status",
                        sortable: true,
                        render: (a) => (
                          <Pill tone={statusTone(a.status)}>
                            {BOOKING_STATUS_LABEL[a.status]}
                          </Pill>
                        ),
                      },
                    ]}
                    actions={(a) => renderActions(a)}
                  />

                  {filtered.map((appt) =>
                    expandedId === appt.id ? (
                      <div key={`${appt.id}-detail`} className="card-soft space-y-2 p-3">
                        <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                          <Detail label="Guest">{appt.guestName}</Detail>
                          <Detail label="Email">{appt.guestEmail}</Detail>
                          <Detail label="Phone">{appt.guestPhone || "—"}</Detail>
                          <Detail label="Executive">{hostName(appt.hostUserId)}</Detail>
                          <Detail label="Account">{accountName(appt.companyId)}</Detail>
                          <Detail label="Call type">{eventTitle(appt.eventTypeId)}</Detail>
                          <Detail label="Scheduled">
                            {formatWhen(appt.startsAt, appt.endsAt)} (
                            {slotDurationMinutes(appt.startsAt, appt.endsAt)})
                          </Detail>
                          <Detail label="Status">
                            {BOOKING_STATUS_LABEL[appt.status]}
                          </Detail>
                        </div>
                        {appt.notes ? (
                          <p className="rounded-md bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
                            {appt.notes}
                          </p>
                        ) : null}
                        {appt.status === "pending" ? (
                          <Input
                            placeholder="Optional note to guest (included in status email)"
                            className="h-8 text-xs"
                            value={noteById[appt.id] ?? ""}
                            onChange={(e) =>
                              setNoteById((prev) => ({ ...prev, [appt.id]: e.target.value }))
                            }
                          />
                        ) : null}
                        {expandedId === appt.id &&
                        (appt.status === "confirmed" || appt.status === "postponed") &&
                        appt.startsAt >= now ? (
                          <div className="space-y-2 rounded-md border border-dashed p-2">
                            <div className="text-[10px] font-medium text-muted-foreground">
                              Reschedule
                            </div>
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
                                        setExpandedId(null);
                                      })
                                      .catch((err) =>
                                        toast.error(err instanceof Error ? err.message : "Failed"),
                                      );
                                  }}
                                >
                                  {slot.startsAt.slice(11, 16)}
                                </button>
                              ))}
                              {rescheduleSlots.length === 0 ? (
                                <span className="text-[10px] text-muted-foreground">
                                  No open slots
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null,
                  )}
                </div>
              )}
            </>
          )}

          {tab === "availability" && (
            <WeeklyHoursEditor
              timezone={timezone}
              onTimezoneChange={setTimezone}
              rows={WEEKDAYS.map((day) => {
                const draft = draftWindows.find((w) => w.weekday === day.id);
                return {
                  weekday: day.id,
                  label: day.label,
                  startTime: draft?.startTime ?? "10:00",
                  endTime: draft?.endTime ?? "17:00",
                  enabled: draft?.enabled ?? false,
                };
              })}
              onRowChange={(weekday, patch) => {
                setDraftWindows((prev) =>
                  prev.map((w) => (w.weekday === weekday ? { ...w, ...patch } : w)),
                );
              }}
              saving={savingHours}
              onSave={() => {
                setSavingHours(true);
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
                  )
                  .finally(() => setSavingHours(false));
              }}
            />
          )}

          {tab === "blocked" && (
            <BookingBlocksPanel
              blocks={myBlocks}
              blockStart={blockStart}
              blockEnd={blockEnd}
              blockReason={blockReason}
              onBlockStartChange={setBlockStart}
              onBlockEndChange={setBlockEnd}
              onBlockReasonChange={setBlockReason}
              adding={addingBlock}
              onAdd={() => {
                if (!blockStart || !blockEnd) {
                  toast.error("Start and end are required");
                  return;
                }
                const startsAt = blockStart.length === 16 ? `${blockStart}:00` : blockStart;
                const endsAt = blockEnd.length === 16 ? `${blockEnd}:00` : blockEnd;
                if (endsAt <= startsAt) {
                  toast.error("End must be after start");
                  return;
                }
                setAddingBlock(true);
                void addBlock({ startsAt, endsAt, reason: blockReason || undefined })
                  .then(() => {
                    toast.success("Block added");
                    setBlockStart("");
                    setBlockEnd("");
                    setBlockReason("");
                  })
                  .catch((err) =>
                    toast.error(err instanceof Error ? err.message : "Failed"),
                  )
                  .finally(() => setAddingBlock(false));
              }}
              onRemove={(id) => {
                void removeBlock(id)
                  .then(() => toast.success("Block removed"))
                  .catch((err) =>
                    toast.error(err instanceof Error ? err.message : "Failed"),
                  );
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </PageWrap>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 font-medium">{children}</div>
    </div>
  );
}
