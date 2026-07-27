import { useMemo, useState } from "react";
import {
  AlarmClock,
  CheckSquare,
  ClipboardList,
  MapPin,
  MessageSquareText,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";

import { EntityFormModal } from "@/components/entity-form-modal";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { buildPendingWorkItems, type PendingWorkItem } from "@/hooks/use-pending-work-summary";
import {
  useClientVisitStore,
  useCompanyStore,
  useCurrentUser,
  useOnboardingStore,
  useProjectStore,
  useTaskStore,
  useTicketStore,
  useUserStore,
} from "@/stores";
import type { FollowUpTask } from "@/types";

type PendingWork = PendingWorkItem;

function dueTone(dueDate?: string) {
  if (!dueDate) return "muted" as const;
  const today = new Date().toISOString().slice(0, 10);
  if (dueDate < today) return "danger" as const;
  if (dueDate === today) return "warning" as const;
  return "info" as const;
}

export function PendingWorkDashboard() {
  const currentUser = useCurrentUser();
  const users = useUserStore((s) => s.users);
  const tickets = useTicketStore((s) => s.tickets);
  const tasks = useTaskStore((s) => s.tasks);
  const updateTask = useTaskStore((s) => s.updateTask);
  const checklist = useOnboardingStore((s) => s.checklistItems);
  const visits = useClientVisitStore((s) => s.visits);
  const projects = useProjectStore((s) => s.projects);
  const companies = useCompanyStore((s) => s.companies);
  const [userFilter, setUserFilter] = useState(currentUser?.id ?? "all");
  const [kindFilter, setKindFilter] = useState<"all" | PendingWork["kind"]>("all");
  const [phaseFilter, setPhaseFilter] = useState<"all" | "collection" | "upload" | "live">("all");
  const [followUpTask, setFollowUpTask] = useState<FollowUpTask | null>(null);
  const [remark, setRemark] = useState("");

  const work = useMemo(
    () =>
      buildPendingWorkItems({
        tickets,
        tasks,
        checklist,
        visits,
        projects,
        companies,
      }),
    [tickets, tasks, checklist, visits, projects, companies],
  );

  const filtered = work.filter((item) => {
    if (userFilter !== "all" && item.assigneeUserId !== userFilter) return false;
    if (kindFilter !== "all" && item.kind !== kindFilter) return false;
    if (phaseFilter !== "all" && item.kind === "checklist") {
      const checklistItem = checklist.find((c) => c.id === item.id);
      if (!checklistItem) return false;
      if (phaseFilter === "collection" && checklistItem.collected) return false;
      if (phaseFilter === "upload" && (!checklistItem.collected || checklistItem.uploaded)) return false;
      if (phaseFilter === "live" && (!checklistItem.uploaded || checklistItem.live)) return false;
    }
    if (phaseFilter !== "all" && item.kind !== "checklist") return false;
    return true;
  });
  const today = new Date().toISOString().slice(0, 10);
  const overdue = filtered.filter((item) => item.dueDate && item.dueDate < today).length;
  const upcoming = filtered.filter((item) => item.dueDate && item.dueDate >= today).length;

  function saveFollowUp() {
    if (!followUpTask || !remark.trim()) {
      toast.error("Enter a follow-up update");
      return;
    }
    updateTask(followUpTask.id, { remark: remark.trim() });
    toast.success("Follow-up update recorded in CRM");
    setFollowUpTask(null);
    setRemark("");
  }

  return (
    <>
      <section className="mt-6 card-soft p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-semibold">Pending Activities</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Tickets, follow-ups, visit next actions, and incomplete checklists in one queue.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill tone={overdue ? "danger" : "muted"}>
              <AlarmClock className="h-3 w-3" /> {overdue} overdue
            </Pill>
            <Pill tone="info">{upcoming} upcoming</Pill>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm"
          >
            <option value="all">All users</option>
            {users
              .filter((user) => user.active)
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.id === currentUser?.id ? "My work" : user.name}
                </option>
              ))}
          </select>
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm"
          >
            <option value="all">All activity types</option>
            <option value="ticket">Tickets</option>
            <option value="task">Follow-up tasks</option>
            <option value="checklist">Checklists</option>
            <option value="visit-followup">Visit follow-ups</option>
          </select>
          {(kindFilter === "all" || kindFilter === "checklist") && (
            <select
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value as typeof phaseFilter)}
              className="h-9 rounded-md border border-input bg-card px-3 text-sm"
            >
              <option value="all">All checklist phases</option>
              <option value="collection">Awaiting collection</option>
              <option value="upload">Awaiting upload</option>
              <option value="live">Awaiting go-live</option>
            </select>
          )}
        </div>

        <div className="mt-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No pending work for this selection.
            </div>
          ) : (
            filtered.slice(0, 30).map((item) => {
              const Icon =
                item.kind === "ticket"
                  ? Ticket
                  : item.kind === "task"
                    ? CheckSquare
                    : item.kind === "visit-followup"
                      ? MapPin
                      : ClipboardList;
              return (
                <div
                  key={`${item.kind}-${item.id}`}
                  className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <a href={item.href} className="text-sm font-medium hover:underline">
                      {item.title}
                    </a>
                    <div className="truncate text-xs capitalize text-muted-foreground">
                      {item.subtitle}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill tone={dueTone(item.dueDate)}>
                      {item.dueDate
                        ? item.dueDate < today
                          ? `Overdue · ${item.dueDate}`
                          : item.dueDate
                        : "No due date"}
                    </Pill>
                    {item.task ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => {
                          setFollowUpTask(item.task!);
                          setRemark("");
                        }}
                      >
                        <MessageSquareText className="h-3.5 w-3.5" />
                        Update
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <EntityFormModal
        open={Boolean(followUpTask)}
        onOpenChange={(open) => {
          if (!open) setFollowUpTask(null);
        }}
        title="Follow-up Update"
        onSubmit={saveFollowUp}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {["Follow-up taken", "Customer contacted", "Discussion completed"].map((preset) => (
              <Button
                key={preset}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setRemark(preset)}
              >
                {preset}
              </Button>
            ))}
          </div>
          <textarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            rows={4}
            placeholder="Record discussion notes, outcome, or next action…"
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted-foreground">
            This update is saved as an immutable CRM event for reporting and audit history.
          </p>
        </div>
      </EntityFormModal>
    </>
  );
}
