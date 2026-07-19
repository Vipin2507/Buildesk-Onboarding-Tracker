import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { EntityFormModal } from "@/components/entity-form-modal";
import { DatePickerField } from "@/components/date-picker-field";
import { Pill } from "@/components/status-pill";
import {
  CLIENT_VISIT_STATUSES,
  type ClientVisit,
  type ClientVisitStatus,
} from "@/types";
import { useClientVisitStore, useTaskStore, useUserStore } from "@/stores";
import { assignableManagerUsers, resolveAssigneeLabel } from "@/lib/managers";
import { formatDate, formatDateTime } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";

export function CompanyVisitsPanel({ companyId }: { companyId: string }) {
  const visits = useClientVisitStore((s) => s.visits);
  const addVisit = useClientVisitStore((s) => s.addVisit);
  const updateVisit = useClientVisitStore((s) => s.updateVisit);
  const addTask = useTaskStore((s) => s.addTask);
  const users = useUserStore((s) => s.users);
  const { can, isAdmin } = usePermissions();
  const canManage = isAdmin || can("manageClientVisits");

  const companyVisits = useMemo(
    () =>
      visits
        .filter((v) => v.companyId === companyId)
        .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)),
    [visits, companyId],
  );

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClientVisit | null>(null);
  const [purpose, setPurpose] = useState("");
  const [visitType, setVisitType] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [status, setStatus] = useState<ClientVisitStatus>("scheduled");
  const [location, setLocation] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [outcome, setOutcome] = useState("");
  const [remarks, setRemarks] = useState("");
  const [notes, setNotes] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");

  const assignees = assignableManagerUsers(users);
  const completed = companyVisits.filter((v) => v.status === "completed").length;

  function openCreate() {
    setEditing(null);
    setPurpose("");
    setVisitType("");
    setScheduledDate(new Date().toISOString().slice(0, 10));
    setStatus("scheduled");
    setLocation("");
    setAssignedUserId("");
    setContactName("");
    setContactPhone("");
    setOutcome("");
    setRemarks("");
    setNotes("");
    setNextAction("");
    setNextFollowUpDate("");
    setOpen(true);
  }

  function openEdit(visit: ClientVisit) {
    setEditing(visit);
    setPurpose(visit.purpose);
    setVisitType(visit.visitType ?? "");
    setScheduledDate(visit.scheduledAt.slice(0, 10));
    setStatus(visit.status);
    setLocation(visit.location ?? "");
    setAssignedUserId(visit.assignedUserId ?? "");
    setContactName(visit.contactName ?? "");
    setContactPhone(visit.contactPhone ?? "");
    setOutcome(visit.outcome ?? "");
    setRemarks(visit.remarks ?? "");
    setNotes(visit.notes ?? "");
    setNextAction(visit.nextAction ?? "");
    setNextFollowUpDate(visit.nextFollowUpDate ?? "");
    setOpen(true);
  }

  function submit() {
    if (!purpose.trim() || !scheduledDate) {
      toast.error("Purpose and visit date are required");
      return;
    }
    const scheduledAt = `${scheduledDate}T10:00:00.000Z`;
    if (editing) {
      updateVisit(editing.id, {
        purpose: purpose.trim(),
        visitType: visitType.trim() || undefined,
        scheduledAt,
        status,
        location: location.trim() || undefined,
        assignedUserId: assignedUserId || undefined,
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        outcome: outcome.trim() || undefined,
        remarks: remarks.trim() || undefined,
        notes: notes.trim() || undefined,
        nextAction: nextAction.trim() || undefined,
        nextFollowUpDate: nextFollowUpDate || undefined,
      });
      toast.success("Visit updated");
    } else {
      addVisit({
        companyId,
        purpose: purpose.trim(),
        visitType: visitType.trim() || undefined,
        scheduledAt,
        status,
        location: location.trim() || undefined,
        assignedUserId: assignedUserId || undefined,
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        outcome: outcome.trim() || undefined,
        remarks: remarks.trim() || undefined,
        notes: notes.trim() || undefined,
        nextAction: nextAction.trim() || undefined,
        nextFollowUpDate: nextFollowUpDate || undefined,
      });
      toast.success("Visit logged");
    }
    setOpen(false);
  }

  function createFollowUp(visit: ClientVisit) {
    addTask({
      companyId,
      sourceVisitId: visit.id,
      title: visit.nextAction?.trim() || `Follow up: ${visit.purpose}`,
      description: visit.outcome || visit.remarks,
      status: "open",
      priority: "medium",
      progressPercent: 0,
      dueDate: visit.nextFollowUpDate,
      assigneeUserId: visit.assignedUserId,
    });
    toast.success("Follow-up task created from visit");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Client Visits</h3>
          <p className="text-xs text-muted-foreground">
            {companyVisits.length} total · {completed} completed
          </p>
        </div>
        {canManage ? (
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" /> Log visit
          </Button>
        ) : null}
      </div>

      {companyVisits.length === 0 ? (
        <EmptyState
          title="No visits logged"
          description="Record client visits with purpose, outcome, and next actions."
          actionLabel={canManage ? "+ Log visit" : undefined}
          onAction={canManage ? openCreate : undefined}
        />
      ) : (
        <div className="space-y-2">
          {companyVisits.map((visit) => (
            <div key={visit.id} className="card-soft space-y-2 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <button type="button" className="min-w-0 text-left" onClick={() => canManage && openEdit(visit)}>
                  <div className="font-medium">{visit.purpose}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(visit.scheduledAt)} ·{" "}
                    {resolveAssigneeLabel(visit.assignedUserId, users)}
                    {visit.location ? ` · ${visit.location}` : ""}
                  </div>
                </button>
                <Pill tone={visit.status === "completed" ? "success" : "muted"}>{visit.status}</Pill>
              </div>
              {visit.outcome ? (
                <p className="text-sm text-muted-foreground">Outcome: {visit.outcome}</p>
              ) : null}
              {visit.nextAction ? (
                <p className="text-sm">Next: {visit.nextAction}
                  {visit.nextFollowUpDate ? ` by ${formatDate(visit.nextFollowUpDate)}` : ""}
                </p>
              ) : null}
              {canManage && visit.status === "completed" ? (
                <Button size="sm" variant="outline" onClick={() => createFollowUp(visit)}>
                  Create follow-up task
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <EntityFormModal
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Update visit" : "Log client visit"}
        submitLabel={editing ? "Save" : "Log visit"}
        onSubmit={submit}
      >
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          <label className="block text-xs font-medium">
            Purpose
            <input
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium">
              Visit date
              <div className="mt-1">
                <DatePickerField
                  value={scheduledDate}
                  onChange={setScheduledDate}
                  modal
                  yearsBack={5}
                  yearsForward={2}
                />
              </div>
            </label>
            <label className="block text-xs font-medium">
              Status
              <select
                className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as ClientVisitStatus)}
              >
                {CLIENT_VISIT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-xs font-medium">
            Type
            <input
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              value={visitType}
              onChange={(e) => setVisitType(e.target.value)}
              placeholder="Demo / Review / Training"
            />
          </label>
          <label className="block text-xs font-medium">
            Location
            <input
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium">
            Assigned to
            <select
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              value={assignedUserId}
              onChange={(e) => setAssignedUserId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {assignees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium">
              Contact name
              <input
                className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </label>
            <label className="block text-xs font-medium">
              Contact phone
              <input
                className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </label>
          </div>
          <label className="block text-xs font-medium">
            Outcome
            <textarea
              className="mt-1 min-h-16 w-full rounded-md border px-3 py-2 text-sm"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium">
            Remarks
            <textarea
              className="mt-1 min-h-16 w-full rounded-md border px-3 py-2 text-sm"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium">
            Supporting notes
            <textarea
              className="mt-1 min-h-16 w-full rounded-md border px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium">
            Next action
            <input
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium">
            Next follow-up date
            <div className="mt-1">
              <DatePickerField
                value={nextFollowUpDate}
                onChange={setNextFollowUpDate}
                modal
                yearsBack={0}
                yearsForward={2}
              />
            </div>
          </label>
        </div>
      </EntityFormModal>
    </div>
  );
}
