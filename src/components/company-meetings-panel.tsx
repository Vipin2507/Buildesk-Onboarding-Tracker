import { useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { EntityFormModal } from "@/components/entity-form-modal";
import { DatePickerField } from "@/components/date-picker-field";
import { Pill } from "@/components/status-pill";
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
import { useErpMeetingStore, useUserStore } from "@/stores";
import { assignableManagerUsers, resolveAssigneeLabel } from "@/lib/managers";
import { formatDateDmy, formatTime } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";

function toMeetingIso(date: string, time: string) {
  const normalized = time.trim() || "10:00";
  return `${date}T${normalized}:00.000Z`;
}

function meetingDatePart(iso: string) {
  return iso.slice(0, 10);
}

function meetingTimePart(iso: string) {
  if (!iso || iso.length < 16) return "10:00";
  return iso.slice(11, 16);
}

export function CompanyMeetingsPanel({ companyId }: { companyId: string }) {
  const meetings = useErpMeetingStore((s) => s.meetings);
  const addMeeting = useErpMeetingStore((s) => s.addMeeting);
  const updateMeeting = useErpMeetingStore((s) => s.updateMeeting);
  const retryGoogleCalendarSync = useErpMeetingStore((s) => s.retryGoogleCalendarSync);
  const users = useUserStore((s) => s.users);
  const { can, isAdmin } = usePermissions();
  const canManage = isAdmin || can("manageErpMeetings");

  const companyMeetings = useMemo(
    () =>
      meetings
        .filter((m) => m.companyId === companyId)
        .sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
    [meetings, companyId],
  );

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ErpMeeting | null>(null);
  const [title, setTitle] = useState("");
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

  const assignees = assignableManagerUsers(users);
  const upcoming = companyMeetings.filter(
    (m) => m.status === "scheduled" && m.startsAt.slice(0, 10) >= new Date().toISOString().slice(0, 10),
  ).length;

  function openCreate() {
    setEditing(null);
    setTitle("");
    setMeetingType("check_in");
    setFormat("online");
    setScheduledDate(new Date().toISOString().slice(0, 10));
    setStartTime("10:00");
    setEndTime("11:00");
    setStatus("scheduled");
    setHostUserId("");
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
    if (!title.trim() || !scheduledDate) {
      toast.error("Title and date are required");
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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {companyMeetings.length} meetings · {upcoming} upcoming
        </p>
        {canManage ? (
          <Button size="sm" className="h-8 gap-1 text-xs" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            Schedule meeting
          </Button>
        ) : null}
      </div>

      {companyMeetings.length === 0 ? (
        <EmptyState
          title="No meetings yet"
          description="Schedule onboarding calls, training, and reviews with this company."
          actionLabel={canManage ? "Schedule meeting" : undefined}
          onAction={canManage ? openCreate : undefined}
        />
      ) : (
        <div className="divide-y rounded-lg border">
          {companyMeetings.map((m) => (
            <div key={m.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5">
              <div className="min-w-0">
                <div className="font-medium">{m.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {formatDateDmy(m.startsAt)} · {formatTime(m.startsAt)}
                  {m.endsAt ? ` – ${formatTime(m.endsAt)}` : ""}
                  {" · "}
                  {ERP_MEETING_TYPE_LABELS[m.meetingType]} · {ERP_MEETING_FORMAT_LABELS[m.format]}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Host: {resolveAssigneeLabel(m.hostUserId, users) || "—"}
                  {m.attendeeName ? ` · ${m.attendeeName}` : ""}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(m.meetUrl || m.meetingLink) ? (
                  <a
                    href={m.meetUrl || m.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    Join Meet
                  </a>
                ) : m.format === "online" && m.googleSyncStatus === "error" ? (
                  <span className="text-[10px] text-destructive" title={m.googleSyncError}>
                    Sync failed
                  </span>
                ) : null}
                <Pill tone={m.status === "completed" ? "success" : m.status === "scheduled" ? "info" : "muted"}>
                  {m.status}
                </Pill>
                {canManage ? (
                  <>
                    {m.format === "online" &&
                    (m.status === "scheduled" || m.status === "postponed") ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        title="Retry calendar sync"
                        onClick={() =>
                          void retryGoogleCalendarSync(m.id).then((updated) => {
                            if (updated?.googleSyncStatus === "error" && updated.googleSyncError) {
                              toast.error(updated.googleSyncError);
                            } else if (updated?.googleSyncStatus === "synced") {
                              toast.success("Calendar synced");
                            }
                          })
                        }
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEdit(m)}>
                      Edit
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

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
    </div>
  );
}
