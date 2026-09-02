import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  CalendarOff,
  Check,
  Clock,
  Inbox,
  Mail,
  Phone,
  Plus,
  Search,
  User,
  Video,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { DatePickerField } from "@/components/date-picker-field";
import { DataTable } from "@/components/data-table";
import {
  DesignTicketDateField,
  DesignTicketFilterField,
  DesignTicketSelect,
} from "@/components/design-ticket/design-ticket-fields";
import {
  DesignTicketFilterBar,
  DesignTicketTabNav,
  TICKET_EASE,
} from "@/components/design-ticket/design-ticket-shared";
import { EmptyState } from "@/components/empty-state";
import { WeeklyHoursEditor } from "@/components/crm/weekly-hours-editor";
import { BookingBlocksPanel } from "@/components/crm/booking-blocks-panel";
import { BookingGoogleCalendarPanel } from "@/components/crm/booking-google-calendar-panel";
import { CreateCrmBookingDialog } from "@/components/crm/create-crm-booking-dialog";
import { PageWrap } from "@/components/page-header";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getGoogleCalendarConnectionStatus,
} from "@/lib/api";
import { isAdminRoleKey } from "@/lib/permissions";
import {
  crmBookingsSearchSchema,
  parseCrmBookingsTab,
  type CrmBookingsTabId,
} from "@/lib/crm-route-search";
import { filterCrmAccountsForUser, canCreateCrmMeeting } from "@/lib/crm-account-access";
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

const BOOKING_FILTER_CHIPS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "closed", label: "Closed" },
] as const;

type BookingFilterChipId = (typeof BOOKING_FILTER_CHIPS)[number]["id"];

const BOOKING_LIST_TAB_IDS = new Set<BookingFilterChipId>(
  BOOKING_FILTER_CHIPS.map((chip) => chip.id),
);

const SETTINGS_TABS = [
  { id: "availability", label: "Availability", icon: Clock },
  { id: "blocked", label: "Blocked", icon: CalendarOff },
  { id: "calendar", label: "Calendar", icon: Video },
] as const;

type TabId = CrmBookingsTabId;

type BookingFilterTone = "muted" | "warning" | "success" | "info" | "danger";

const BOOKING_FILTER_BOX_COUNT_TONE: Record<BookingFilterTone, string> = {
  muted: "text-foreground",
  warning: "text-amber-600 dark:text-amber-400",
  success: "text-emerald-600 dark:text-emerald-400",
  info: "text-primary",
  danger: "text-destructive",
};

function bookingFilterChipTone(id: BookingFilterChipId): BookingFilterTone {
  if (id === "pending") return "warning";
  if (id === "upcoming") return "info";
  if (id === "closed") return "danger";
  return "muted";
}

function matchesBookingTabFilter(
  appointment: BookingAppointment,
  tabId: BookingFilterChipId,
  now: string,
) {
  if (tabId === "pending") return appointment.status === "pending";
  if (tabId === "upcoming") {
    return (
      (appointment.status === "confirmed" || appointment.status === "postponed") &&
      appointment.startsAt >= now
    );
  }
  if (tabId === "past") {
    return (
      (appointment.status === "confirmed" ||
        appointment.status === "completed" ||
        appointment.status === "postponed") &&
      appointment.startsAt < now
    );
  }
  if (tabId === "closed") {
    return CLOSED_STATUSES.includes(appointment.status) || appointment.status === "cancelled";
  }
  return true;
}

type BookingToolbarFilters = {
  statusFilter: string;
  accountFilter: string;
  hostFilter: string;
  callTypeFilter: string;
  dateFrom: string;
  dateTo: string;
  tableSearch: string;
};

function matchesBookingToolbarFilters(
  appointment: BookingAppointment,
  filters: BookingToolbarFilters,
  lookup: {
    accountName: (id: string) => string;
    hostName: (id: string) => string;
    eventTitle: (id: string) => string;
  },
) {
  if (filters.statusFilter !== "all" && appointment.status !== filters.statusFilter) {
    return false;
  }
  if (filters.accountFilter !== "all" && appointment.companyId !== filters.accountFilter) {
    return false;
  }
  if (filters.hostFilter !== "all" && appointment.hostUserId !== filters.hostFilter) {
    return false;
  }
  if (filters.callTypeFilter !== "all" && appointment.eventTypeId !== filters.callTypeFilter) {
    return false;
  }
  const day = appointment.startsAt.slice(0, 10);
  if (filters.dateFrom && day < filters.dateFrom) return false;
  if (filters.dateTo && day > filters.dateTo) return false;
  const q = filters.tableSearch.trim().toLowerCase();
  if (!q) return true;
  return (
    appointment.guestName.toLowerCase().includes(q) ||
    appointment.guestEmail.toLowerCase().includes(q) ||
    (appointment.guestPhone ?? "").toLowerCase().includes(q) ||
    lookup.accountName(appointment.companyId).toLowerCase().includes(q) ||
    lookup.hostName(appointment.hostUserId).toLowerCase().includes(q) ||
    lookup.eventTitle(appointment.eventTypeId).toLowerCase().includes(q) ||
    (appointment.notes ?? "").toLowerCase().includes(q)
  );
}

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
  validateSearch: (search) => crmBookingsSearchSchema.parse(search),
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

function showBookingApproveToast(
  updated: BookingAppointment,
  currentUserId: string | undefined,
  googleConnected: boolean,
  executiveName: string,
) {
  if (updated.meetUrl) {
    toast.success("Meeting approved · added to Google Calendar with Meet link");
    return;
  }
  if (updated.googleSyncStatus === "error" && updated.googleSyncError) {
    toast.error(`Approved, but calendar sync failed: ${updated.googleSyncError}`);
    return;
  }
  const isHost = updated.hostUserId === currentUserId;
  if (isHost && !googleConnected) {
    toast.warning(
      "Meeting approved — connect Google Calendar under the Calendar tab, then retry sync",
    );
    return;
  }
  if (!isHost && !googleConnected) {
    toast.warning(
      `Meeting approved — connect Google Calendar or ask ${executiveName} to connect, then retry sync`,
    );
    return;
  }
  toast.success("Meeting approved");
}

function CrmBookingsPage() {
  const user = useCurrentUser();
  const isAdmin = isAdminRoleKey(user?.role);
  const navigate = useNavigate({ from: "/crm/bookings" });
  const search = Route.useSearch();
  const tab = parseCrmBookingsTab(search.tab);

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
  const retryGoogleCalendarSync = useBookingStore((s) => s.retryGoogleCalendarSync);
  const listSlotsForEvent = useBookingStore((s) => s.listSlotsForEvent);
  const saveAvailabilityWindows = useBookingStore((s) => s.saveAvailabilityWindows);
  const addBlock = useBookingStore((s) => s.addBlock);
  const removeBlock = useBookingStore((s) => s.removeBlock);

  const accounts = useCrmAccountStore((s) => s.accounts);
  const users = useUserStore((s) => s.users);

  const visibleAccounts = useMemo(
    () => filterCrmAccountsForUser(accounts, user),
    [accounts, user],
  );
  const canCreateMeeting = canCreateCrmMeeting(user);

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
  const [googleConnected, setGoogleConnected] = useState(false);

  const tableRef = useRef<HTMLDivElement>(null);

  const [tableSearch, setTableSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [hostFilter, setHostFilter] = useState("all");
  const [callTypeFilter, setCallTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    void getGoogleCalendarConnectionStatus()
      .then((s) => setGoogleConnected(s.connected))
      .catch(() => setGoogleConnected(false));
  }, [tab, search.google]);

  useEffect(() => {
    if (!search.google) return;
    const timer = window.setTimeout(() => {
      void navigate({
        search: { tab: search.tab },
        replace: true,
      });
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [search.google, search.tab, navigate]);
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

  const listFilters = useMemo(
    () => ({
      statusFilter,
      accountFilter,
      hostFilter,
      callTypeFilter,
      dateFrom,
      dateTo,
      tableSearch,
    }),
    [
      statusFilter,
      accountFilter,
      hostFilter,
      callTypeFilter,
      dateFrom,
      dateTo,
      tableSearch,
    ],
  );

  const filterLookup = useMemo(
    () => ({ accountName, hostName, eventTitle }),
    [accounts, users, eventTypes],
  );

  const toolbarScoped = useMemo(
    () =>
      appointments.filter((a) => matchesBookingToolbarFilters(a, listFilters, filterLookup)),
    [appointments, listFilters, filterLookup],
  );

  const listTab = BOOKING_LIST_TAB_IDS.has(tab as BookingFilterChipId)
    ? (tab as BookingFilterChipId)
    : "pending";

  const filtered = useMemo(() => {
    return toolbarScoped
      .filter((a) => matchesBookingTabFilter(a, listTab, now))
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  }, [toolbarScoped, listTab, now]);

  function bookingFilterChipCount(id: BookingFilterChipId) {
    return toolbarScoped.filter((a) => matchesBookingTabFilter(a, id, now)).length;
  }

  const activeFilterCount = [
    statusFilter !== "all",
    accountFilter !== "all",
    hostFilter !== "all",
    callTypeFilter !== "all",
    Boolean(dateFrom),
    Boolean(dateTo),
  ].filter(Boolean).length;

  const isListTab = BOOKING_LIST_TAB_IDS.has(tab as BookingFilterChipId);

  function applyFilters() {
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const myAvailability = useMemo(
    () => availability.filter((a) => a.hostUserId === user?.id),
    [availability, user?.id],
  );
  const myBlocks = useMemo(
    () => blocks.filter((b) => b.hostUserId === user?.id).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [blocks, user?.id],
  );

  const hoursSetCount = myAvailability.filter((a) => a.isActive).length;

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
    setTableSearch("");
    setStatusFilter("all");
    setAccountFilter("all");
    setHostFilter("all");
    setCallTypeFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  function renderMeetButton(meetUrl: string) {
    return (
      <Button
        size="sm"
        className="h-7 gap-1 px-2 text-[10px]"
        asChild
        onClick={(e) => e.stopPropagation()}
      >
        <a href={meetUrl} target="_blank" rel="noreferrer">
          <Video className="h-3 w-3" />
          Join Meet
        </a>
      </Button>
    );
  }

  function renderActions(appt: BookingAppointment) {
    const meetBtn = appt.meetUrl ? renderMeetButton(appt.meetUrl) : null;

    if (appt.status === "pending") {
      return (
        <div className="flex flex-wrap items-center gap-1">
          {meetBtn}
          <Button
            size="sm"
            className="h-7 gap-1 px-2 text-[10px]"
            onClick={(e) => {
              e.stopPropagation();
              void acceptAppointment(appt.id, noteById[appt.id])
                .then((updated) => {
                  showBookingApproveToast(
                    updated,
                    user?.id,
                    googleConnected,
                    hostName(appt.hostUserId),
                  );
                })
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
                .then(() => toast.success("Meeting declined"))
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
        <div className="flex flex-wrap items-center gap-1">
          {meetBtn}
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
                .then(() => toast.success("Meeting postponed"))
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
                .then(() => toast.success("Meeting cancelled"))
                .catch((err) => toast.error(err instanceof Error ? err.message : "Failed"));
            }}
          >
            Cancel
          </Button>
        </div>
      );
    }
    if (meetBtn) {
      return <div className="flex flex-wrap items-center gap-1">{meetBtn}</div>;
    }
    return <span className="text-[10px] text-muted-foreground">—</span>;
  }

  return (
    <PageWrap compact flushTop>
      <div className="mb-0 border-b border-border pb-2 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base font-medium tracking-tight">Meetings</h1>
            <p className="text-xs text-muted-foreground">
              {isListTab
                ? `${filtered.length} ${filtered.length === 1 ? "meeting" : "meetings"}`
                : "Manage availability, blocks, and calendar sync"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {canCreateMeeting ? (
              <Button
                size="sm"
                className="h-8 gap-1 bg-primary px-3 text-xs"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Create meeting
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-stretch">
          <div
            role="tablist"
            aria-label="Meeting filters"
            className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-5"
          >
            {BOOKING_FILTER_CHIPS.map((chip) => {
              const tone = bookingFilterChipTone(chip.id);
              const active = isListTab && listTab === chip.id;
              const count = bookingFilterChipCount(chip.id);
              return (
                <button
                  key={chip.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => void navigate({ search: { tab: chip.id } })}
                  className={cn(
                    "flex min-w-0 flex-col rounded-lg border bg-card px-2.5 py-2 text-left shadow-sm transition-all",
                    "hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    active
                      ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                      : "border-border/80",
                  )}
                >
                  <span className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {chip.label}
                  </span>
                  <span
                    className={cn(
                      "mt-1 text-lg font-semibold tabular-nums leading-none",
                      BOOKING_FILTER_BOX_COUNT_TONE[tone],
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => void navigate({ search: { tab: "availability" } })}
            className={cn(
              "flex shrink-0 flex-col justify-center rounded-lg border bg-card px-3 py-2 text-left shadow-sm transition-all lg:min-w-[5.5rem]",
              "hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              tab === "availability"
                ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                : "border-border/80",
            )}
          >
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Hours set
            </span>
            <span className="mt-1 text-lg font-semibold tabular-nums leading-none text-emerald-600 dark:text-emerald-400">
              {hoursSetCount}
            </span>
          </button>
        </div>

        <div className="mt-2">
          <DesignTicketTabNav
            compact
            tabs={SETTINGS_TABS.map(({ id, label, icon }) => ({ id, label, icon }))}
            activeId={isListTab ? "" : tab}
            onChange={(id) => void navigate({ search: { tab: id as TabId } })}
          />
        </div>
      </div>

      <CreateCrmBookingDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        accounts={visibleAccounts}
        users={users}
        currentUserId={user?.id}
        currentUserName={user?.name}
        isAdmin={isAdmin}
        onCreated={() => void refreshStaff()}
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
              <div className="-mx-3 sm:-mx-4 lg:-mx-5">
                <div className="px-3 sm:px-4 lg:px-5">
                  <DesignTicketFilterBar
                    variant="inline"
                    compact
                    className="xl:grid-cols-4"
                    activeFilterCount={activeFilterCount}
                    onClear={clearFilters}
                    onApply={applyFilters}
                    resultCount={filtered.length}
                    resultLabel={filtered.length === 1 ? "meeting" : "meetings"}
                    trailing={
                      <div className="relative min-w-[140px] flex-1 sm:max-w-xs">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <input
                          value={tableSearch}
                          onChange={(e) => setTableSearch(e.target.value)}
                          placeholder="Search guest, account, executive…"
                          aria-label="Search meetings"
                          className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-ring/40"
                        />
                      </div>
                    }
                  >
                    {listTab === "all" ? (
                      <DesignTicketFilterField label="Status" compact>
                        <DesignTicketSelect
                          compact
                          value={statusFilter}
                          onChange={setStatusFilter}
                          options={[
                            { value: "all", label: "All statuses" },
                            ...Object.entries(BOOKING_STATUS_LABEL).map(([value, label]) => ({
                              value,
                              label,
                            })),
                          ]}
                        />
                      </DesignTicketFilterField>
                    ) : null}
                    <DesignTicketFilterField label="Account" compact>
                      <DesignTicketSelect
                        compact
                        value={accountFilter}
                        onChange={setAccountFilter}
                        options={[
                          { value: "all", label: "All accounts" },
                          ...visibleAccounts.map((a) => ({ value: a.id, label: a.name })),
                        ]}
                      />
                    </DesignTicketFilterField>
                    {isAdmin ? (
                      <DesignTicketFilterField label="Executive" compact>
                        <DesignTicketSelect
                          compact
                          value={hostFilter}
                          onChange={setHostFilter}
                          options={[
                            { value: "all", label: "All executives" },
                            ...hostOptions,
                          ]}
                        />
                      </DesignTicketFilterField>
                    ) : null}
                    <DesignTicketFilterField label="Call type" compact>
                      <DesignTicketSelect
                        compact
                        value={callTypeFilter}
                        onChange={setCallTypeFilter}
                        options={[
                          { value: "all", label: "All types" },
                          ...callTypeOptions,
                        ]}
                      />
                    </DesignTicketFilterField>
                    <DesignTicketDateField
                      compact
                      label="From"
                      value={dateFrom}
                      onChange={setDateFrom}
                      placeholder="From"
                    />
                    <DesignTicketDateField
                      compact
                      label="To"
                      value={dateTo}
                      onChange={setDateTo}
                      placeholder="To"
                    />
                  </DesignTicketFilterBar>
                </div>

                <div ref={tableRef} className="min-w-0">
                  {filtered.length === 0 ? (
                    <div className="px-3 sm:px-4 lg:px-5">
                      <EmptyState
                        title={
                          listTab === "pending"
                            ? "No pending requests"
                            : listTab === "upcoming"
                              ? "No upcoming calls"
                              : "No meetings match your filters"
                        }
                        description={
                          listTab === "pending"
                            ? "Portal meeting requests appear here and in your notification bell."
                            : "Try clearing filters or check another tab."
                        }
                        actionLabel={
                          activeFilterCount > 0 || tableSearch ? "Clear filters" : undefined
                        }
                        onAction={
                          activeFilterCount > 0 || tableSearch ? clearFilters : undefined
                        }
                      />
                    </div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="space-y-2 bg-card [&_tbody_tr]:bg-card [&_thead]:bg-card"
                    >
                      <DataTable
                        flush
                        density="compact"
                        data={filtered}
                        hideSearch
                        pageSize={12}
                        getRowId={(a) => a.id}
                        onRowClick={(a) => {
                          if (expandedId === a.id) {
                            setExpandedId(null);
                            return;
                          }
                          setExpandedId(a.id);
                          if (
                            (a.status === "confirmed" || a.status === "postponed") &&
                            a.startsAt >= now
                          ) {
                            void loadRescheduleSlots(a.id, a.startsAt.slice(0, 10));
                          }
                        }}
                        columns={[
                      {
                        key: "guestName",
                        header: "Guest",
                        sortable: true,
                        render: (a) => (
                          <div className="min-w-[8rem]">
                            <div className="font-medium">{a.guestName}</div>
                            <a
                              href={`mailto:${a.guestEmail}`}
                              className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Mail className="h-3 w-3" />
                              {a.guestEmail}
                            </a>
                            {a.additionalGuestEmails?.length ? (
                              <div className="mt-0.5 space-y-0.5 text-[10px] text-muted-foreground">
                                {a.additionalGuestEmails.map((email) => (
                                  <a
                                    key={email}
                                    href={`mailto:${email}`}
                                    className="block hover:text-primary hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    + {email}
                                  </a>
                                ))}
                              </div>
                            ) : null}
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
                      <BookingDetailPanel
                        key={`${appt.id}-detail`}
                        appt={appt}
                        now={now}
                        note={noteById[appt.id] ?? ""}
                        onNoteChange={(v) =>
                          setNoteById((prev) => ({ ...prev, [appt.id]: v }))
                        }
                        accountName={accountName(appt.companyId)}
                        executiveName={hostName(appt.hostUserId)}
                        callType={eventTitle(appt.eventTypeId)}
                        googleConnected={googleConnected}
                        userId={user?.id}
                        onAccept={() =>
                          void acceptAppointment(appt.id, noteById[appt.id])
                            .then((updated) => {
                              showBookingApproveToast(
                                updated,
                                user?.id,
                                googleConnected,
                                hostName(appt.hostUserId),
                              );
                            })
                            .catch((err) =>
                              toast.error(err instanceof Error ? err.message : "Failed"),
                            )
                        }
                        onDecline={() =>
                          void declineAppointment(appt.id, noteById[appt.id])
                            .then(() => toast.success("Meeting declined"))
                            .catch((err) =>
                              toast.error(err instanceof Error ? err.message : "Failed"),
                            )
                        }
                        onPostpone={() =>
                          void postponeAppointment(appt.id, noteById[appt.id])
                            .then(() => toast.success("Meeting postponed"))
                            .catch((err) =>
                              toast.error(err instanceof Error ? err.message : "Failed"),
                            )
                        }
                        onCancel={() =>
                          void cancelAppointment(appt.id)
                            .then(() => toast.success("Meeting cancelled"))
                            .catch((err) =>
                              toast.error(err instanceof Error ? err.message : "Failed"),
                            )
                        }
                        onRetrySync={() =>
                          void retryGoogleCalendarSync(appt.id)
                            .then((updated) => {
                              if (updated.meetUrl) {
                                toast.success("Calendar event & Meet link created");
                              } else if (updated.googleSyncError) {
                                toast.error(updated.googleSyncError);
                              } else {
                                toast.message(
                                  "Sync attempted — connect Google Calendar under the Calendar tab if needed",
                                );
                              }
                            })
                            .catch((err) =>
                              toast.error(
                                err instanceof Error ? err.message : "Calendar sync failed",
                              ),
                            )
                        }
                        rescheduleDate={rescheduleDate}
                        rescheduleSlots={rescheduleSlots}
                        onRescheduleDateChange={(d) => void loadRescheduleSlots(appt.id, d)}
                        onRescheduleSlot={(startsAt) =>
                          void rescheduleAppointment(appt.id, startsAt)
                            .then(() => {
                              toast.success("Rescheduled");
                              setExpandedId(null);
                            })
                            .catch((err) =>
                              toast.error(err instanceof Error ? err.message : "Failed"),
                            )
                        }
                      />
                    ) : null,
                  )}
                    </motion.div>
                  )}
                </div>
              </div>
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

          {tab === "calendar" && (
            <BookingGoogleCalendarPanel
              flash={search.google}
              flashError={search.googleError}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </PageWrap>
  );
}

function BookingDetailPanel({
  appt,
  now,
  note,
  onNoteChange,
  accountName,
  executiveName,
  callType,
  googleConnected,
  userId,
  onAccept,
  onDecline,
  onPostpone,
  onCancel,
  onRetrySync,
  rescheduleDate,
  rescheduleSlots,
  onRescheduleDateChange,
  onRescheduleSlot,
}: {
  appt: BookingAppointment;
  now: string;
  note: string;
  onNoteChange: (v: string) => void;
  accountName: string;
  executiveName: string;
  callType: string;
  googleConnected: boolean;
  userId?: string;
  onAccept: () => void;
  onDecline: () => void;
  onPostpone: () => void;
  onCancel: () => void;
  onRetrySync: () => void;
  rescheduleDate: string;
  rescheduleSlots: { startsAt: string; endsAt: string }[];
  onRescheduleDateChange: (d: string) => void;
  onRescheduleSlot: (startsAt: string) => void;
}) {
  const canReschedule =
    (appt.status === "confirmed" || appt.status === "postponed") && appt.startsAt >= now;

  return (
    <div className="card-soft overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/20 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={statusTone(appt.status)}>{BOOKING_STATUS_LABEL[appt.status]}</Pill>
          <span className="text-xs font-medium text-muted-foreground">{callType}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {appt.meetUrl ? (
            <Button size="sm" className="h-7 gap-1 px-2.5 text-[10px]" asChild>
              <a href={appt.meetUrl} target="_blank" rel="noreferrer">
                <Video className="h-3 w-3" />
                Join Meet
              </a>
            </Button>
          ) : null}
          {appt.status === "pending" ? (
            <>
              <Button size="sm" className="h-7 gap-1 px-2.5 text-[10px]" onClick={onAccept}>
                <Check className="h-3 w-3" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 px-2.5 text-[10px]"
                onClick={onDecline}
              >
                <X className="h-3 w-3" />
                Decline
              </Button>
            </>
          ) : canReschedule ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-[10px]"
                onClick={onPostpone}
              >
                Postpone
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-[10px]"
                onClick={onCancel}
              >
                Cancel
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 p-4 lg:grid-cols-2">
        <BookingDetailSection icon={User} title="Guest">
          <div className="text-sm font-semibold">{appt.guestName}</div>
          <a
            href={`mailto:${appt.guestEmail}`}
            className="mt-1 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="break-all">{appt.guestEmail}</span>
          </a>
          {appt.guestPhone ? (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              {appt.guestPhone}
            </div>
          ) : null}
        </BookingDetailSection>

        <BookingDetailSection icon={Calendar} title="Schedule">
          <div className="text-sm font-medium">{formatWhen(appt.startsAt, appt.endsAt)}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {slotDurationMinutes(appt.startsAt, appt.endsAt)} · {executiveName}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{accountName}</div>
        </BookingDetailSection>

        {appt.meetUrl ? (
          <BookingDetailSection icon={Video} title="Google Meet" variant="accent" className="lg:col-span-2">
            <div className="rounded-md border bg-background px-2.5 py-2 font-mono text-[11px] leading-relaxed text-primary break-all">
              {appt.meetUrl}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Button size="sm" className="h-7 gap-1 px-2.5 text-[10px]" asChild>
                <a href={appt.meetUrl} target="_blank" rel="noreferrer">
                  <Video className="h-3 w-3" />
                  Open Meet
                </a>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-[10px]"
                onClick={() => {
                  void navigator.clipboard.writeText(appt.meetUrl!);
                  toast.success("Meet link copied");
                }}
              >
                Copy link
              </Button>
            </div>
          </BookingDetailSection>
        ) : appt.googleSyncStatus === "error" && appt.googleSyncError ? (
          <BookingDetailSection icon={Video} title="Calendar sync" variant="danger" className="lg:col-span-2">
            <p className="text-xs leading-relaxed text-destructive">{appt.googleSyncError}</p>
            {(appt.status === "confirmed" || appt.status === "postponed") && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2.5 h-7 text-[10px]"
                onClick={onRetrySync}
              >
                Retry calendar sync
              </Button>
            )}
          </BookingDetailSection>
        ) : (appt.status === "confirmed" || appt.status === "postponed") && !appt.meetUrl ? (
          <BookingDetailSection icon={Video} title="Google Meet" variant="muted" className="lg:col-span-2">
            <p className="text-xs leading-relaxed text-muted-foreground">
              No calendar event yet.
              {!googleConnected && appt.hostUserId === userId
                ? " Connect Google Calendar under the Calendar tab."
                : " Use retry sync after connecting."}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2.5 h-7 text-[10px]"
              onClick={onRetrySync}
            >
              Retry calendar sync
            </Button>
          </BookingDetailSection>
        ) : null}

        {appt.notes ? (
          <BookingDetailSection icon={Inbox} title="Notes" className="lg:col-span-2">
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">{appt.notes}</p>
          </BookingDetailSection>
        ) : null}

        {appt.status === "pending" ? (
          <div className="lg:col-span-2">
            <Input
              placeholder="Optional note to guest (included in status email)"
              className="h-8 text-xs"
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
            />
          </div>
        ) : null}

        {canReschedule ? (
          <BookingDetailSection icon={Clock} title="Reschedule" variant="dashed" className="lg:col-span-2">
            <DatePickerField
              value={rescheduleDate}
              onChange={onRescheduleDateChange}
              yearsBack={0}
              yearsForward={1}
            />
            <div className="mt-3">
              {!rescheduleDate ? (
                <p className="text-[10px] text-muted-foreground">
                  Pick a date to see available times.
                </p>
              ) : rescheduleSlots.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">
                  No open slots on {rescheduleDate}. Try another date.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {rescheduleSlots.map((slot) => (
                    <button
                      key={slot.startsAt}
                      type="button"
                      className="rounded-md border bg-background px-2.5 py-1.5 text-[10px] font-medium transition-colors hover:border-primary hover:bg-primary/5"
                      onClick={() => onRescheduleSlot(slot.startsAt)}
                    >
                      {slot.startsAt.slice(11, 16)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </BookingDetailSection>
        ) : null}
      </div>
    </div>
  );
}

function BookingDetailSection({
  icon: Icon,
  title,
  children,
  variant = "default",
  className,
}: {
  icon: typeof User;
  title: string;
  children: React.ReactNode;
  variant?: "default" | "accent" | "danger" | "muted" | "dashed";
  className?: string;
}) {
  const styles = {
    default: "border bg-background",
    accent: "border border-primary/20 bg-primary/5",
    danger: "border border-destructive/30 bg-destructive/5",
    muted: "border border-dashed bg-muted/20",
    dashed: "border border-dashed bg-background",
  };

  const titleStyles = {
    default: "text-muted-foreground",
    accent: "text-primary",
    danger: "text-destructive",
    muted: "text-muted-foreground",
    dashed: "text-muted-foreground",
  };

  return (
    <div className={cn("rounded-lg p-3", styles[variant], className)}>
      <div
        className={cn(
          "mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide",
          titleStyles[variant],
        )}
      >
        <Icon className="h-3 w-3 shrink-0" />
        {title}
      </div>
      {children}
    </div>
  );
}
