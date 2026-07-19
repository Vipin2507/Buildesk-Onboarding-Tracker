import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, PageWrap } from "@/components/page-header";
import { ListToolbar } from "@/components/list-toolbar";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/status-pill";
import { EntityFormModal } from "@/components/entity-form-modal";
import { DatePickerField } from "@/components/date-picker-field";
import { CLIENT_VISIT_STATUSES, type ClientVisitStatus } from "@/types";
import { useClientVisitStore, useCompanyStore, useUserStore } from "@/stores";
import { assignableManagerUsers, resolveAssigneeLabel } from "@/lib/managers";
import { formatDateTime } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";

export const Route = createFileRoute("/client-visits")({
  component: ClientVisitsPage,
});

function ClientVisitsPage() {
  const visits = useClientVisitStore((s) => s.visits);
  const addVisit = useClientVisitStore((s) => s.addVisit);
  const companies = useCompanyStore((s) => s.companies);
  const users = useUserStore((s) => s.users);
  const { can, isAdmin } = usePermissions();
  const canManage = isAdmin || can("manageClientVisits");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<ClientVisitStatus>("scheduled");
  const [assignedUserId, setAssignedUserId] = useState("");

  const assignees = assignableManagerUsers(users);
  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return visits
      .filter((v) => {
        if (statusFilter === "upcoming") {
          if (v.status !== "scheduled" || v.scheduledAt.slice(0, 10) < today) return false;
        } else if (statusFilter !== "all" && v.status !== statusFilter) {
          return false;
        }
        if (companyFilter !== "all" && v.companyId !== companyFilter) return false;
        if (!q) return true;
        const companyName = companies.find((c) => c.id === v.companyId)?.name ?? "";
        return (
          v.purpose.toLowerCase().includes(q) ||
          companyName.toLowerCase().includes(q) ||
          (v.outcome ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  }, [visits, search, statusFilter, companyFilter, companies, today]);

  function submit() {
    if (!purpose.trim() || !companyId || !scheduledDate) {
      toast.error("Purpose, company, and date are required");
      return;
    }
    addVisit({
      companyId,
      purpose: purpose.trim(),
      scheduledAt: `${scheduledDate}T10:00:00.000Z`,
      status,
      assignedUserId: assignedUserId || undefined,
    });
    toast.success("Visit logged");
    setOpen(false);
    setPurpose("");
    setCompanyId("");
    setAssignedUserId("");
  }

  return (
    <PageWrap>
      <PageHeader
        title="Client Visits"
        subtitle={`${filtered.length} visits`}
        actions={
          canManage ? (
            <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Log visit
            </Button>
          ) : null
        }
      />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search visits…"
        resultCount={filtered.length}
        resultLabel="visits"
        selects={[
          {
            id: "status",
            label: "Status",
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "all", label: "All" },
              { value: "upcoming", label: "Upcoming" },
              ...CLIENT_VISIT_STATUSES.map((s) => ({ value: s, label: s })),
            ],
          },
          {
            id: "company",
            label: "Company",
            value: companyFilter,
            onChange: setCompanyFilter,
            options: [
              { value: "all", label: "All companies" },
              ...companies.map((c) => ({ value: c.id, label: c.name })),
            ],
          },
        ]}
      />

      <DataTable
        data={filtered}
        hideSearch
        getRowId={(v) => v.id}
        columns={[
          {
            key: "purpose",
            header: "Visit",
            render: (v) => (
              <div>
                <div className="font-medium">{v.purpose}</div>
                <div className="text-xs text-muted-foreground">
                  {companies.find((c) => c.id === v.companyId)?.name ?? "—"}
                </div>
              </div>
            ),
          },
          {
            key: "scheduledAt",
            header: "When",
            render: (v) => formatDateTime(v.scheduledAt),
          },
          {
            key: "status",
            header: "Status",
            render: (v) => <Pill tone={v.status === "completed" ? "success" : "muted"}>{v.status}</Pill>,
          },
          {
            key: "assignee",
            header: "Assigned",
            render: (v) => resolveAssigneeLabel(v.assignedUserId, users),
          },
          {
            key: "outcome",
            header: "Outcome",
            render: (v) => v.outcome || "—",
          },
          {
            key: "open",
            header: "",
            render: (v) => (
              <Button size="sm" variant="outline" asChild>
                <Link to="/companies/$companyId" params={{ companyId: v.companyId }} search={{ tab: "Visits" }}>
                  Open
                </Link>
              </Button>
            ),
          },
        ]}
      />

      <EntityFormModal
        open={open}
        onOpenChange={setOpen}
        title="Log client visit"
        submitLabel="Log visit"
        onSubmit={submit}
      >
        <div className="space-y-3">
          <label className="block text-xs font-medium">
            Purpose
            <input
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium">
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
        </div>
      </EntityFormModal>
    </PageWrap>
  );
}
