import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  DesignTicketSection,
  DesignTicketTabNav,
  ticketFieldClass,
  ticketSelectClass,
} from "@/components/design-ticket/design-ticket-shared";
import { ConfirmDeleteDialog, EntityFormModal } from "@/components/entity-form-modal";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { getCrmPicklistValues } from "@/stores/useCrmMasterStore";
import { useCrmOnboardingStore } from "@/stores";
import { cn } from "@/lib/utils";
import type { CrmAccountProject, CrmMasterDictItem, CrmMasterTeam } from "@/types/crm-master";

const fieldClass = cn(ticketFieldClass, "h-8 text-xs");
const selectClass = cn(ticketSelectClass, "h-8 text-xs");

type DataSubTab = "projects" | "sources" | "statuses" | "followUps" | "teams";

const SUB_TABS: { id: DataSubTab; label: string }[] = [
  { id: "projects", label: "Projects" },
  { id: "sources", label: "Sources" },
  { id: "statuses", label: "Stages" },
  { id: "followUps", label: "Follow-ups" },
  { id: "teams", label: "Teams" },
];

export function CrmMastersDataPanel({ companyId }: { companyId: string }) {
  const record = useCrmOnboardingStore((s) => s.getByCompanyId(companyId))!;
  const upsertMasterProject = useCrmOnboardingStore((s) => s.upsertMasterProject);
  const deleteMasterProject = useCrmOnboardingStore((s) => s.deleteMasterProject);
  const upsertMasterDictItem = useCrmOnboardingStore((s) => s.upsertMasterDictItem);
  const deleteMasterDictItem = useCrmOnboardingStore((s) => s.deleteMasterDictItem);
  const upsertMasterTeam = useCrmOnboardingStore((s) => s.upsertMasterTeam);
  const deleteMasterTeam = useCrmOnboardingStore((s) => s.deleteMasterTeam);

  const [sub, setSub] = useState<DataSubTab>("projects");
  const [projectOpen, setProjectOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<CrmAccountProject | null>(null);
  const [projectForm, setProjectForm] = useState({
    name: "",
    type: "Residential",
    city: "",
    units: "",
    totalTowers: "",
    totalFloors: "",
    status: "not_started" as CrmAccountProject["status"],
  });

  const [dictOpen, setDictOpen] = useState(false);
  const [editingDict, setEditingDict] = useState<CrmMasterDictItem | null>(null);
  const [dictValue, setDictValue] = useState("");
  const [dictActive, setDictActive] = useState(true);

  const [teamOpen, setTeamOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<CrmMasterTeam | null>(null);
  const [teamForm, setTeamForm] = useState({ name: "", role: "", memberCount: "" });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    kind: DataSubTab;
    id: string;
    label: string;
  } | null>(null);

  const projectTypes = useMemo(() => {
    const fromConfig = getCrmPicklistValues("project-types");
    return fromConfig.length ? fromConfig : ["Residential", "Commercial", "Township", "Mixed-use", "Villas"];
  }, []);

  const teamRoles = useMemo(() => {
    const fromConfig = getCrmPicklistValues("team-roles");
    return fromConfig.length ? fromConfig : ["Admin", "Sales Manager", "Sales Executive"];
  }, []);

  const projects = record.masterProjects ?? [];
  const sources = record.masterSources ?? [];
  const statuses = record.masterStatuses ?? [];
  const followUps = record.masterFollowUps ?? [];
  const teams = record.masterTeams ?? [];

  function openCreateProject() {
    setEditingProject(null);
    setProjectForm({
      name: "",
      type: projectTypes[0] ?? "Residential",
      city: "",
      units: "",
      totalTowers: "",
      totalFloors: "",
      status: "not_started",
    });
    setProjectOpen(true);
  }

  function openEditProject(p: CrmAccountProject) {
    setEditingProject(p);
    setProjectForm({
      name: p.name,
      type: p.type,
      city: p.city,
      units: p.units != null ? String(p.units) : "",
      totalTowers: p.totalTowers != null ? String(p.totalTowers) : "",
      totalFloors: p.totalFloors != null ? String(p.totalFloors) : "",
      status: p.status,
    });
    setProjectOpen(true);
  }

  function saveProject() {
    if (projectForm.name.trim().length < 2) {
      toast.error("Project name is required");
      return;
    }
    if (projectForm.city.trim().length < 2) {
      toast.error("City is required");
      return;
    }
    upsertMasterProject(companyId, {
      id: editingProject?.id,
      name: projectForm.name.trim(),
      type: projectForm.type,
      city: projectForm.city.trim(),
      units: projectForm.units ? Number(projectForm.units) : undefined,
      totalTowers: projectForm.totalTowers ? Number(projectForm.totalTowers) : undefined,
      totalFloors: projectForm.totalFloors ? Number(projectForm.totalFloors) : undefined,
      status: projectForm.status,
    });
    toast.success(editingProject ? "Project updated" : "Project added");
    setProjectOpen(false);
  }

  function openCreateDict() {
    setEditingDict(null);
    setDictValue("");
    setDictActive(true);
    setDictOpen(true);
  }

  function openEditDict(item: CrmMasterDictItem) {
    setEditingDict(item);
    setDictValue(item.value);
    setDictActive(item.active);
    setDictOpen(true);
  }

  function saveDict() {
    if (dictValue.trim().length < 1) {
      toast.error("Value is required");
      return;
    }
    const kind =
      sub === "sources" ? "sources" : sub === "statuses" ? "statuses" : "followUps";
    const list =
      kind === "sources" ? sources : kind === "statuses" ? statuses : followUps;
    upsertMasterDictItem(companyId, kind, {
      id: editingDict?.id,
      value: dictValue.trim(),
      active: dictActive,
      sortOrder: editingDict?.sortOrder ?? list.length + 1,
    });
    toast.success(editingDict ? "Value updated" : "Value added");
    setDictOpen(false);
  }

  function openCreateTeam() {
    setEditingTeam(null);
    setTeamForm({ name: "", role: teamRoles[0] ?? "", memberCount: "" });
    setTeamOpen(true);
  }

  function openEditTeam(t: CrmMasterTeam) {
    setEditingTeam(t);
    setTeamForm({
      name: t.name,
      role: t.role ?? "",
      memberCount: t.memberCount != null ? String(t.memberCount) : "",
    });
    setTeamOpen(true);
  }

  function saveTeam() {
    if (teamForm.name.trim().length < 2) {
      toast.error("Team name is required");
      return;
    }
    upsertMasterTeam(companyId, {
      id: editingTeam?.id,
      name: teamForm.name.trim(),
      role: teamForm.role.trim() || undefined,
      memberCount: teamForm.memberCount ? Number(teamForm.memberCount) : undefined,
    });
    toast.success(editingTeam ? "Team updated" : "Team added");
    setTeamOpen(false);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    if (pendingDelete.kind === "projects") {
      deleteMasterProject(companyId, pendingDelete.id);
    } else if (pendingDelete.kind === "teams") {
      deleteMasterTeam(companyId, pendingDelete.id);
    } else {
      const kind =
        pendingDelete.kind === "sources"
          ? "sources"
          : pendingDelete.kind === "statuses"
            ? "statuses"
            : "followUps";
      deleteMasterDictItem(companyId, kind, pendingDelete.id);
    }
    toast.success("Deleted");
    setDeleteOpen(false);
    setPendingDelete(null);
  }

  const dictList =
    sub === "sources" ? sources : sub === "statuses" ? statuses : followUps;

  return (
    <div className="space-y-2.5">
      <DesignTicketTabNav
        compact
        tabs={SUB_TABS.map((t) => ({
          id: t.id,
          label: `${t.label} (${
            t.id === "projects"
              ? projects.length
              : t.id === "teams"
                ? teams.length
                : t.id === "sources"
                  ? sources.length
                  : t.id === "statuses"
                    ? statuses.length
                    : followUps.length
          })`,
        }))}
        activeId={sub}
        onChange={(id) => setSub(id as DataSubTab)}
      />

      {sub === "projects" ? (
        <DesignTicketSection
          compact
          title="Project masters"
          action={
            <Button size="sm" className="h-7 gap-1 text-xs bg-primary" onClick={openCreateProject}>
              <Plus className="h-3.5 w-3.5" />
              Add project
            </Button>
          }
        >
          <p className="mb-2 text-[10px] text-muted-foreground">
            Same scale fields as ERP projects — towers, floors, and units — scoped to this CRM account.
          </p>
          {projects.length === 0 ? (
            <div className="rounded-lg border border-dashed px-3 py-8 text-center text-xs text-muted-foreground">
              No projects yet. Add the first project master for this account.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="border-b text-[10px] uppercase text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Project</th>
                    <th className="px-2 py-2 font-medium">Type</th>
                    <th className="px-2 py-2 font-medium">Units</th>
                    <th className="px-2 py-2 font-medium">Towers</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.id} className="border-b border-border/60">
                      <td className="px-2 py-2">
                        <div className="font-medium">{p.name}</div>
                        <div className="text-[10px] text-muted-foreground">{p.city}</div>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">{p.type}</td>
                      <td className="px-2 py-2 tabular-nums">{p.units ?? "—"}</td>
                      <td className="px-2 py-2 tabular-nums">{p.totalTowers ?? "—"}</td>
                      <td className="px-2 py-2">
                        <Pill
                          tone={
                            p.status === "completed"
                              ? "success"
                              : p.status === "in_progress"
                                ? "warning"
                                : "muted"
                          }
                        >
                          {p.status.replace("_", " ")}
                        </Pill>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => openEditProject(p)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => {
                            setPendingDelete({ kind: "projects", id: p.id, label: p.name });
                            setDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DesignTicketSection>
      ) : null}

      {sub === "sources" || sub === "statuses" || sub === "followUps" ? (
        <DesignTicketSection
          compact
          title={
            sub === "sources"
              ? "Source masters"
              : sub === "statuses"
                ? "Stage masters"
                : "Follow-up masters"
          }
          action={
            <Button size="sm" className="h-7 gap-1 text-xs bg-primary" onClick={openCreateDict}>
              <Plus className="h-3.5 w-3.5" />
              Add value
            </Button>
          }
        >
          <p className="mb-2 text-[10px] text-muted-foreground">
            Configure account dictionaries used by lead intake and follow-ups.
          </p>
          {dictList.length === 0 ? (
            <div className="rounded-lg border border-dashed px-3 py-8 text-center text-xs text-muted-foreground">
              No values yet.
            </div>
          ) : (
            <div className="space-y-1.5">
              {dictList
                .slice()
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((item) => (
                  <div
                    key={item.id}
                    className="card-soft flex items-center justify-between gap-2 p-2.5"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium">{item.value}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {item.active ? "Active" : "Inactive"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => openEditDict(item)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => {
                          setPendingDelete({ kind: sub, id: item.id, label: item.value });
                          setDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </DesignTicketSection>
      ) : null}

      {sub === "teams" ? (
        <DesignTicketSection
          compact
          title="Teams"
          action={
            <Button size="sm" className="h-7 gap-1 text-xs bg-primary" onClick={openCreateTeam}>
              <Plus className="h-3.5 w-3.5" />
              Add team
            </Button>
          }
        >
          <p className="mb-2 text-[10px] text-muted-foreground">
            Team and role masters for this account&apos;s CRM users.
          </p>
          {teams.length === 0 ? (
            <div className="rounded-lg border border-dashed px-3 py-8 text-center text-xs text-muted-foreground">
              No teams yet.
            </div>
          ) : (
            <div className="space-y-1.5">
              {teams.map((t) => (
                <div key={t.id} className="card-soft flex items-center justify-between gap-2 p-2.5">
                  <div className="min-w-0">
                    <div className="text-xs font-medium">{t.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {t.role || "No role"}
                      {t.memberCount != null ? ` · ${t.memberCount} members` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => openEditTeam(t)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => {
                        setPendingDelete({ kind: "teams", id: t.id, label: t.name });
                        setDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DesignTicketSection>
      ) : null}

      <EntityFormModal
        open={projectOpen}
        onOpenChange={setProjectOpen}
        title={editingProject ? "Edit project" : "Add project"}
        submitLabel={editingProject ? "Save" : "Create"}
        onSubmit={saveProject}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium">Name</label>
            <input
              className={fieldClass}
              value={projectForm.name}
              onChange={(e) => setProjectForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Type</label>
            <select
              className={selectClass}
              value={projectForm.type}
              onChange={(e) => setProjectForm((f) => ({ ...f, type: e.target.value }))}
            >
              {projectTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">City</label>
            <input
              className={fieldClass}
              value={projectForm.city}
              onChange={(e) => setProjectForm((f) => ({ ...f, city: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Units</label>
            <input
              type="number"
              min={0}
              className={fieldClass}
              value={projectForm.units}
              onChange={(e) => setProjectForm((f) => ({ ...f, units: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Towers</label>
            <input
              type="number"
              min={0}
              className={fieldClass}
              value={projectForm.totalTowers}
              onChange={(e) => setProjectForm((f) => ({ ...f, totalTowers: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Floors</label>
            <input
              type="number"
              min={0}
              className={fieldClass}
              value={projectForm.totalFloors}
              onChange={(e) => setProjectForm((f) => ({ ...f, totalFloors: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Status</label>
            <select
              className={selectClass}
              value={projectForm.status}
              onChange={(e) =>
                setProjectForm((f) => ({
                  ...f,
                  status: e.target.value as CrmAccountProject["status"],
                }))
              }
            >
              <option value="not_started">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      </EntityFormModal>

      <EntityFormModal
        open={dictOpen}
        onOpenChange={setDictOpen}
        title={editingDict ? "Edit value" : "Add value"}
        submitLabel={editingDict ? "Save" : "Add"}
        onSubmit={saveDict}
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Value</label>
            <input
              className={fieldClass}
              value={dictValue}
              onChange={(e) => setDictValue(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={dictActive} onCheckedChange={setDictActive} size="sm" />
            Active
          </label>
        </div>
      </EntityFormModal>

      <EntityFormModal
        open={teamOpen}
        onOpenChange={setTeamOpen}
        title={editingTeam ? "Edit team" : "Add team"}
        submitLabel={editingTeam ? "Save" : "Create"}
        onSubmit={saveTeam}
      >
        <div className="grid gap-3">
          <div>
            <label className="text-xs font-medium">Team name</label>
            <input
              className={fieldClass}
              value={teamForm.name}
              onChange={(e) => setTeamForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Role</label>
            <select
              className={selectClass}
              value={teamForm.role}
              onChange={(e) => setTeamForm((f) => ({ ...f, role: e.target.value }))}
            >
              <option value="">Select role</option>
              {teamRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Members</label>
            <input
              type="number"
              min={0}
              className={fieldClass}
              value={teamForm.memberCount}
              onChange={(e) => setTeamForm((f) => ({ ...f, memberCount: e.target.value }))}
            />
          </div>
        </div>
      </EntityFormModal>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete master item?"
        description={
          pendingDelete
            ? `Remove “${pendingDelete.label}” from this account’s masters.`
            : "This item will be removed."
        }
        confirmLabel="Delete"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
