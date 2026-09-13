import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { LayoutList, Plus, RefreshCw, Search, Video } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { PageWrap } from "@/components/page-header";
import {
  DesignTicketDateField,
  DesignTicketFilterField,
  DesignTicketSelect,
} from "@/components/design-ticket/design-ticket-fields";
import { DesignTicketFilterBar } from "@/components/design-ticket/design-ticket-shared";
import { DatePickerField } from "@/components/date-picker-field";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { EntityFormModal } from "@/components/entity-form-modal";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { inDateRange } from "@/components/list-toolbar";
import { usePermissions } from "@/hooks/use-permissions";
import { assignableManagerUsers, resolveAssigneeLabel } from "@/lib/managers";
import { cn, formatDateDmy, formatTime } from "@/lib/utils";
import { GoogleCalendarConnectPanel } from "@/components/google-calendar-connect-panel";
import { useAuthStore, useCompanyStore, useErpMeetingStore, useUserStore } from "@/stores";
import {
  ERP_MEETING_FORMATS,
  ERP_MEETING_FORMAT_LABELS,
  ERP_MEETING_STATUSES,
  ERP_MEETING_TYPES,
  ERP_MEETING_TYPE_LABELS,
  type ErpMeeting,
  type ErpMeetingFormat,
  type ErpMeetingStatus,
  type ErpMeetingType,
} from "@/types";

const meetingsSearchSchema = z.object({
  tab: z.enum(["all", "calendar"]).optional(),
  meetingId: z.string().optional(),
  google: z.enum(["connected", "error"]).optional(),
  googleError: z.string().optional(),
});

export const Route = createFileRoute("/meetings")({
  validateSearch: (search) => meetingsSearchSchema.parse(search),
  component: ErpMeetingsPage,
});

type StatusFilter = "all" | "upcoming" | ErpMeetingStatus;

const STATUS_PILLS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming" },
  { id: "scheduled", label: "Scheduled" },
  { id: "completed", label: "Completed" },
  { id: "postponed", label: "Postponed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "no_show", label: "No show" },
];

function toMeetingIso(date: string, time: string) {
  return `${date}T${(time.trim() || "10:00")}:00.000Z`;
}

function meetingDatePart(iso: string) {
  return iso.slice(0, 10);
}

function meetingTimePart(iso: string) {
  if (!iso || iso.length < 16) return "10:00";
  return iso.slice(11, 16);
}

const VIEW_TABS = [
  { id: "all", label: "Meetings", icon: LayoutList },
  { id: "calendar", label: "Calendar", icon: Video },
] as const;

function ErpMeetingsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/meetings" });
  const viewTab = search.tab ?? "all";
  const { meetingId: linkedMeetingId, google, googleError } = search;
  const tableRef = useRef<HTMLDivElement>(null);

  const meetings = useErpMeetingStore((s) => s.meetings);
  const addMeeting = useErpMeetingStore((s) => s.addMeeting);
  const updateMeeting = useErpMeetingStore((s) => s.updateMeeting);
  const retryGoogleCalendarSync = useErpMeetingStore((s) => s.retryGoogleCalendarSync);
  const companies = useCompanyStore((s) => s.companies);
  const users = useUserStore((s) => s.users);
  const currentUser = useAuthStore((s) => s.user);
  const { can, isAdmin } = usePermissions();
  const canManage = isAdmin || can("manageErpMeetings");

  useEffect(() => {
    if (!google) return;
    void navigate({
      search: (prev) => ({
        ...prev,
        google: undefined,
        googleError: undefined,
      }),
      replace: true,
    });
  }, [google, navigate]);

  const today = new Date().toISOString().slice(0, 10);
  const assignees = assignableManagerUsers(users);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [hostFilter, setHostFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tableSearch, setTableSearch] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ErpMeeting | null>(null);
  const [title, setTitle] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [meetingType, setMeetingType] = useState<ErpMeetingType>("check_in");
  const [format, setFormat] = useState<ErpMeetingFormat>("online");
  const [scheduledDate, setScheduledDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [status, setStatus] = useState<ErpMeetingStatus>("scheduled");
  const [hostUserId, setHostUserId] = useState("");
  const [attendeeName, setAttendeeName] = useState("");
  const [attendeeEmail, setAttendeeEmail] = useState("");
  const [location, setLocation] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState("");

  const toolbarScoped = useMemo(() => {
    return meetings.filter((m) => {
      if (companyFilter !== "all" && m.companyId !== companyFilter) return false;
      if (typeFilter !== "all" && m.meetingType !== typeFilter) return false;
      if (formatFilter !== "all" && m.format !== formatFilter) return false;
      if (hostFilter === "unassigned" && m.hostUserId) return false;
      if (hostFilter !== "all" && hostFilter !== "unassigned" && m.hostUserId !== hostFilter) {
        return false;
      }
      if (!inDateRange(m.startsAt.slice(0, 10), dateFrom, dateTo)) return false;
      return true;
    });
  }, [meetings, companyFilter, typeFilter, formatFilter, hostFilter, dateFrom, dateTo]);

  function pillCount(id: StatusFilter) {
    if (id === "all") return toolbarScoped.length;
    if (id === "upcoming") {
      return toolbarScoped.filter(
        (m) => m.status === "scheduled" && m.startsAt.slice(0, 10) >= today,
      ).length;
    }
    return toolbarScoped.filter((m) => m.status === id).length;
  }

  const filtered = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    return toolbarScoped.filter((m) => {
      if (statusFilter === "upcoming") {
        if (m.status !== "scheduled" || m.startsAt.slice(0, 10) < today) return false;
      } else if (statusFilter !== "all" && m.status !== statusFilter) {
        return false;
      }
      if (linkedMeetingId && m.id !== linkedMeetingId) return false;
      if (!q) return true;
      const companyName = companies.find((c) => c.id === m.companyId)?.name ?? "";
      const hay = [m.title, companyName, m.attendeeName, m.attendeeEmail, m.notes, m.outcome]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [toolbarScoped, statusFilter, tableSearch, companies, today, linkedMeetingId]);

  const tableRows = useMemo(
    () => filtered.map((m) => ({ ...m, startsAt: m.startsAt || "" })),
    [filtered],
  );

  const activeFilterCount = [
    statusFilter !== "all",
    companyFilter !== "all",
    typeFilter !== "all",
    formatFilter !== "all",
    hostFilter !== "all",
    Boolean(dateFrom),
    Boolean(dateTo),
    Boolean(tableSearch.trim()),
  ].filter(Boolean).length;

  function clearFilters() {
    setStatusFilter("all");
    setCompanyFilter("all");
    setTypeFilter("all");
    setFormatFilter("all");
    setHostFilter("all");
    setDateFrom("");
    setDateTo("");
    setTableSearch("");
  }

  function setViewTab(next: "all" | "calendar") {
    void navigate({
      search: (prev) => ({
        ...prev,
        tab: next === "all" ? undefined : next,
      }),
      replace: true,
    });
  }

  async function handleRetrySync(meeting: ErpMeeting) {
    const updated = await retryGoogleCalendarSync(meeting.id);
    if (!updated) {
      toast.error("Calendar sync failed");
      return;
    }
    if (updated.googleSyncStatus === "error" && updated.googleSyncError) {
      toast.error(updated.googleSyncError);
      return;
    }
    toast.success("Calendar synced");
  }

  function openCreate() {
    setEditing(null);
    setTitle("");
    setCompanyId(companies[0]?.id ?? "");
    setMeetingType("check_in");
    setFormat("online");
    setScheduledDate(today);
    setStartTime("10:00");
    setEndTime("11:00");
    setStatus("scheduled");
    setHostUserId(currentUser?.id ?? "");
    setAttendeeName("");
    setAttendeeEmail("");
    setLocation("");
    setMeetingLink("");
    setNotes("");
    setOutcome("");
    setOpen(true);
  }

  function openEdit(meeting: ErpMeeting) {
    setEditing(meeting);
    setTitle(meeting.title);
    setCompanyId(meeting.companyId);
    setMeetingType(meeting.meetingType);
    setFormat(meeting.format);
    setScheduledDate(meetingDatePart(meeting.startsAt));
    setStartTime(meetingTimePart(meeting.startsAt));
    setEndTime(meeting.endsAt ? meetingTimePart(meeting.endsAt) : "11:00");
    setStatus(meeting.status);
    setHostUserId(meeting.hostUserId ?? "");
    setAttendeeName(meeting.attendeeName ?? "");
    setAttendeeEmail(meeting.attendeeEmail ?? "");
    setLocation(meeting.location ?? "");
    setMeetingLink(meeting.meetingLink ?? "");
    setNotes(meeting.notes ?? "");
    setOutcome(meeting.outcome ?? "");
    setOpen(true);
  }

  function submit() {
    if (!title.trim() || !companyId || !scheduledDate) {
      toast.error("Title, company, and date are required");
      return;
    }
    const payload = {
      companyId,
      title: title.trim(),
      startsAt: toMeetingIso(scheduledDate, startTime),
      endsAt: endTime ? toMeetingIso(scheduledDate, endTime) : undefined,
      status,
      meetingType,
      format,
      hostUserId: hostUserId || undefined,
      attendeeName: attendeeName.trim() || undefined,
      attendeeEmail: attendeeEmail.trim() || undefined,
      location: location.trim() || undefined,
      meetingLink: meetingLink.trim() || undefined,
      notes: notes.trim() || undefined,
      outcome: outcome.trim() || undefined,
    };
    if (editing) {
      updateMeeting(editing.id, payload);
      toast.success("Meeting updated");
    } else {
      addMeeting(payload);
      toast.success("Meeting scheduled");
    }
    setOpen(false);
  }

  return (
    <PageWrap compact flushTop>
      <div className="mb-0 border-b border-border pb-2 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base font-medium tracking-tight">Meetings</h1>
            <p className="text-xs text-muted-foreground">
              ERP onboarding meetings — separate from CRM portal bookings
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex rounded-lg border bg-card p-0.5">
              {VIEW_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = viewTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setViewTab(tab.id)}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
            {canManage && viewTab === "all" ? (
              <Button size="sm" className="h-8 gap-1 bg-primary px-3 text-xs" onClick={openCreate}>
                <Plus className="h-3.5 w-3.5" />
                Schedule meeting
              </Button>
            ) : null}
          </div>
        </div>

        {viewTab === "calendar" ? (
          <div className="mt-3">
            <GoogleCalendarConnectPanel
              variant="erp"
              flash={google}
              flashError={googleError}
            />
          </div>
        ) : null}

        {viewTab === "all" ? (
        <div
          role="tablist"
          aria-label="Meeting filters"
          className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-7"
        >
          {STATUS_PILLS.map((pill) => {
            const active = statusFilter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatusFilter(pill.id)}
                className={cn(
                  "flex min-w-0 flex-col rounded-lg border bg-card px-2.5 py-2 text-left shadow-sm transition-all",
                  "hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  active
                    ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                    : "border-border/80",
                )}
              >
                <span className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {pill.label}
                </span>
                <span className="mt-1 text-lg font-semibold tabular-nums leading-none text-foreground">
                  {pillCount(pill.id)}
                </span>
              </button>
            );
          })}
        </div>
        ) : null}
      </div>

      {viewTab === "all" ? (
      <div className="-mx-3 sm:-mx-4 lg:-mx-5">
        <div className="px-3 sm:px-4 lg:px-5">
          <DesignTicketFilterBar
            variant="inline"
            compact
            className="xl:grid-cols-4"
            activeFilterCount={activeFilterCount}
            onClear={clearFilters}
            onApply={() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })}
            resultCount={filtered.length}
            resultLabel={filtered.length === 1 ? "meeting" : "meetings"}
            trailing={
              <div className="relative min-w-[140px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Search meetings…"
                  aria-label="Search meetings"
                  className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
            }
          >
            <DesignTicketFilterField label="Company" compact>
              <DesignTicketSelect
                compact
                value={companyFilter}
                onChange={setCompanyFilter}
                options={[
                  { value: "all", label: "All companies" },
                  ...companies.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </DesignTicketFilterField>
            <DesignTicketFilterField label="Type" compact>
              <DesignTicketSelect
                compact
                value={typeFilter}
                onChange={setTypeFilter}
                options={[
                  { value: "all", label: "All types" },
                  ...ERP_MEETING_TYPES.map((t) => ({
                    value: t,
                    label: ERP_MEETING_TYPE_LABELS[t],
                  })),
                ]}
              />
            </DesignTicketFilterField>
            <DesignTicketFilterField label="Format" compact>
              <DesignTicketSelect
                compact
                value={formatFilter}
                onChange={setFormatFilter}
                options={[
                  { value: "all", label: "All formats" },
                  ...ERP_MEETING_FORMATS.map((f) => ({
                    value: f,
                    label: ERP_MEETING_FORMAT_LABELS[f],
                  })),
                ]}
              />
            </DesignTicketFilterField>
            <DesignTicketFilterField label="Host" compact>
              <DesignTicketSelect
                compact
                value={hostFilter}
                onChange={setHostFilter}
                options={[
                  { value: "all", label: "All hosts" },
                  { value: "unassigned", label: "Unassigned" },
                  ...assignees.map((u) => ({ value: u.id, label: u.name })),
                ]}
              />
            </DesignTicketFilterField>
            <DesignTicketDateField
              compact
              displayFormat="dd/MM/yyyy"
              label="From"
              value={dateFrom}
              onChange={setDateFrom}
              placeholder="DD/MM/YYYY"
            />
            <DesignTicketDateField
              compact
              displayFormat="dd/MM/yyyy"
              label="To"
              value={dateTo}
              onChange={setDateTo}
              placeholder="DD/MM/YYYY"
            />
          </DesignTicketFilterBar>

          <div ref={tableRef}>
            {filtered.length === 0 ? (
              <div className="px-0 py-2">
                <EmptyState
                  title={meetings.length === 0 ? "No meetings yet" : "No matches"}
                  description={
                    meetings.length === 0
                      ? "Schedule kickoffs, training sessions, and review calls with client companies."
                      : "Try another filter or clear your search."
                  }
                  actionLabel={canManage && meetings.length === 0 ? "Schedule meeting" : "Clear filters"}
                  onAction={canManage && meetings.length === 0 ? openCreate : clearFilters}
                />
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="bg-card [&_tbody_tr]:bg-card [&_thead]:bg-card"
              >
                <DataTable
                  flush
                  data={tableRows}
                  initialSortKey="startsAt"
                  initialSortDir="desc"
                  getRowId={(m) => m.id}
                  hideSearch
                  searchQuery={tableSearch}
                  onSearchQueryChange={setTableSearch}
                  pageSize={15}
                  density="compact"
                  columns={[
                    {
                      key: "title",
                      header: "Meeting",
                      sortable: true,
                      render: (m) => (
                        <div>
                          <div className="font-medium">{m.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {companies.find((c) => c.id === m.companyId)?.name ?? "—"}
                          </div>
                        </div>
                      ),
                    },
                    {
                      key: "meetingType",
                      header: "Type",
                      sortable: true,
                      render: (m) => (
                        <span className="text-xs">{ERP_MEETING_TYPE_LABELS[m.meetingType]}</span>
                      ),
                    },
                    {
                      key: "format",
                      header: "Format",
                      sortable: true,
                      render: (m) => (
                        <span className="text-xs">{ERP_MEETING_FORMAT_LABELS[m.format]}</span>
                      ),
                    },
                    {
                      key: "startsAt",
                      header: "When",
                      sortable: true,
                      render: (m) => (
                        <div className="text-xs tabular-nums text-muted-foreground">
                          <div className="whitespace-nowrap">{formatDateDmy(m.startsAt)}</div>
                          <div className="whitespace-nowrap">
                            {formatTime(m.startsAt)}
                            {m.endsAt ? ` – ${formatTime(m.endsAt)}` : ""}
                          </div>
                        </div>
                      ),
                    },
                    {
                      key: "hostUserId",
                      header: "Host",
                      sortable: true,
                      render: (m) => (
                        <span className="text-xs">
                          {resolveAssigneeLabel(m.hostUserId, users) || "—"}
                        </span>
                      ),
                    },
                    {
                      key: "status",
                      header: "Status",
                      sortable: true,
                      render: (m) => (
                        <Pill
                          tone={
                            m.status === "completed"
                              ? "success"
                              : m.status === "scheduled"
                                ? "info"
                                : "muted"
                          }
                        >
                          {m.status}
                        </Pill>
                      ),
                    },
                    {
                      key: "attendee",
                      header: "Attendee",
                      render: (m) => (
                        <span className="text-xs text-muted-foreground">{m.attendeeName || "—"}</span>
                      ),
                    },
                    {
                      key: "meetUrl",
                      header: "Meet",
                      render: (m) => {
                        const link = m.meetUrl || m.meetingLink;
                        if (!link) {
                          if (m.format === "online" && m.googleSyncStatus === "error") {
                            return (
                              <span className="text-[10px] text-destructive" title={m.googleSyncError}>
                                Sync failed
                              </span>
                            );
                          }
                          return <span className="text-xs text-muted-foreground">—</span>;
                        }
                        return (
                          <a
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Join
                          </a>
                        );
                      },
                    },
                  ]}
                  actions={
                    canManage
                      ? (m) => (
                          <div className="flex justify-end gap-0.5">
                            {m.format === "online" &&
                            (m.status === "scheduled" || m.status === "postponed") ? (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                title="Retry calendar sync"
                                onClick={() => void handleRetrySync(m)}
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => openEdit(m)}
                            >
                              Edit
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                              <Link
                                to="/companies/$companyId"
                                params={{ companyId: m.companyId }}
                                search={{ tab: "Meetings" }}
                              >
                                Open
                              </Link>
                            </Button>
                          </div>
                        )
                      : undefined
                  }
                />
              </motion.div>
            )}
          </div>
        </div>
      </div>
      ) : null}

      <EntityFormModal
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit meeting" : "Schedule meeting"}
        submitLabel={editing ? "Save" : "Schedule"}
        onSubmit={submit}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium sm:col-span-2">
            Title
            <input
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium sm:col-span-2">
            Company
            <select
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              <option value="">Select company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium">
            Type
            <select
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              value={meetingType}
              onChange={(e) => setMeetingType(e.target.value as ErpMeetingType)}
            >
              {ERP_MEETING_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ERP_MEETING_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium">
            Format
            <select
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              value={format}
              onChange={(e) => setFormat(e.target.value as ErpMeetingFormat)}
            >
              {ERP_MEETING_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {ERP_MEETING_FORMAT_LABELS[f]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium">
            Date
            <div className="mt-1">
              <DatePickerField
                modal
                compact
                displayFormat="dd/MM/yyyy"
                value={scheduledDate}
                onChange={setScheduledDate}
              />
            </div>
          </label>
          <label className="block text-xs font-medium">
            Status
            <select
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as ErpMeetingStatus)}
            >
              {ERP_MEETING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium">
            Start time
            <input
              type="time"
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium">
            End time
            <input
              type="time"
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium">
            Host
            <select
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              value={hostUserId}
              onChange={(e) => setHostUserId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {assignees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium">
            Attendee name
            <input
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              value={attendeeName}
              onChange={(e) => setAttendeeName(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium sm:col-span-2">
            Attendee email
            <input
              type="email"
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              value={attendeeEmail}
              onChange={(e) => setAttendeeEmail(e.target.value)}
            />
          </label>
          {format === "in_person" ? (
            <label className="block text-xs font-medium sm:col-span-2">
              Location
              <input
                className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </label>
          ) : null}
          {format === "online" ? (
            <label className="block text-xs font-medium sm:col-span-2">
              Meeting link
              <input
                className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                placeholder="https://…"
              />
            </label>
          ) : null}
          <label className="block text-xs font-medium sm:col-span-2">
            Notes
            <textarea
              className="mt-1 min-h-[72px] w-full rounded-md border px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          {editing ? (
            <label className="block text-xs font-medium sm:col-span-2">
              Outcome
              <textarea
                className="mt-1 min-h-[72px] w-full rounded-md border px-3 py-2 text-sm"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
              />
            </label>
          ) : null}
        </div>
      </EntityFormModal>
    </PageWrap>
  );
}
