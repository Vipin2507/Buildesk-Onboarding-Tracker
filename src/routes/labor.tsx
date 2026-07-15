import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageWrap } from "@/components/page-header";
import { CountUp } from "@/components/count-up";
import { UploadCard } from "@/components/upload-card";
import { Button } from "@/components/ui/button";
import { EntityFormModal } from "@/components/entity-form-modal";
import { useCompanyStore, useLaborStore, useProjectStore } from "@/stores";
import { formatRelativeTime } from "@/types/common";

const searchSchema = z.object({
  companyId: z.string().optional(),
});

export const Route = createFileRoute("/labor")({
  validateSearch: (search) => searchSchema.parse(search),
  component: Labor,
});

function Labor() {
  const { companyId } = Route.useSearch();
  const company = useCompanyStore((s) => s.companies.find((c) => c.id === companyId));
  const allProjects = useProjectStore((s) => s.projects);
  const projectIds = useMemo(() => {
    if (!companyId) return null;
    return new Set(allProjects.filter((p) => p.companyId === companyId).map((p) => p.id));
  }, [allProjects, companyId]);

  const allLabor = useLaborStore((s) => s.labor);
  const allAttendance = useLaborStore((s) => s.attendance);
  const labor = useMemo(() => {
    if (!projectIds) return allLabor;
    return allLabor.filter((r) => !r.projectId || projectIds.has(r.projectId));
  }, [allLabor, projectIds]);
  const attendance = useMemo(() => {
    if (!projectIds) return allAttendance;
    return allAttendance.filter((a) => !a.projectId || projectIds.has(a.projectId));
  }, [allAttendance, projectIds]);

  const addLabor = useLaborStore((s) => s.addLabor);
  const deleteLabor = useLaborStore((s) => s.deleteLabor);
  const simulateAttendanceUpload = useLaborStore((s) => s.simulateAttendanceUpload);
  const deleteAttendance = useLaborStore((s) => s.deleteAttendance);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", role: "Mason", phone: "" });

  const latestAttendance = attendance[0];
  const presentToday = latestAttendance
    ? Math.min(labor.length, latestAttendance.recordCount)
    : 0;
  const kpis = [
    { label: "Total Labor", value: labor.length },
    { label: latestAttendance ? "Present (last upload)" : "Present Today", value: presentToday },
    { label: "Absent", value: Math.max(0, labor.length - presentToday) },
    { label: "Uploads", value: attendance.length },
  ];

  return (
    <PageWrap>
      <PageHeader
        title="Labor Management"
        subtitle={
          company
            ? `Attendance for ${company.name} project sites.`
            : "Track daily attendance across every project site."
        }
        actions={
          companyId ? (
            <Button size="sm" variant="outline" asChild>
              <Link
                to="/companies/$companyId/modules/$moduleKey"
                params={{ companyId, moduleKey: "labor-management" }}
              >
                Module hub
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card-soft p-3 sm:p-4">
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className="text-xl font-semibold sm:text-2xl"><CountUp to={k.value} /></div>
          </div>
        ))}
      </div>
      {!latestAttendance ? (
        <p className="mb-4 text-xs text-muted-foreground">
          Present/Absent counts stay at 0 until an attendance sheet is uploaded — they are no longer estimated.
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-soft overflow-hidden">
          <div className="flex items-center justify-between gap-2 p-4">
            <h3 className="font-semibold">Labor Details</h3>
            <Button size="sm" className="gap-1.5 bg-primary" onClick={() => setModalOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Labor
            </Button>
          </div>
          <div className="space-y-2.5 px-3 pb-3 md:hidden">
            {labor.map((r) => (
              <div key={r.id} className="rounded-xl border border-border p-3.5">
                <div className="font-medium">{r.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{r.role} · {r.phone}</div>
                <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2">
                  <span className="font-mono text-[10px] text-muted-foreground">{r.id}</span>
                  <Button size="icon" variant="ghost" onClick={() => { deleteLabor(r.id); toast.success("Labor removed"); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">ID</th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Role</th>
                  <th className="px-4 py-2 text-left">Phone</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {labor.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/40">
                    <td className="px-4 py-2.5 font-mono text-xs">{r.id}</td>
                    <td className="px-4 py-2.5 font-medium">{r.name}</td>
                    <td className="px-4 py-2.5">{r.role}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.phone}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Button size="icon" variant="ghost" onClick={() => { deleteLabor(r.id); toast.success("Labor removed"); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <UploadCard
            title="Attendance Upload"
            description="Upload daily attendance sheet (Excel)."
            sampleName="attendance_sample.xlsx"
            onUpload={(name) => simulateAttendanceUpload(name)}
          />
          <div className="card-soft mt-4 overflow-hidden">
            <div className="p-4"><h3 className="font-semibold">Recent Attendance</h3></div>
            <div className="space-y-2 px-3 pb-3 md:hidden">
              {attendance.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{a.fileName}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatRelativeTime(a.uploadedAt)} · {a.recordCount} records
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => deleteAttendance(a.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">File</th>
                    <th className="px-4 py-2 text-right">Records</th>
                    <th className="px-4 py-2 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((a) => (
                    <tr key={a.id} className="border-t">
                      <td className="px-4 py-2.5">
                        {a.fileName}
                        <div className="text-xs text-muted-foreground">{formatRelativeTime(a.uploadedAt)}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-success">{a.recordCount}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Button size="icon" variant="ghost" onClick={() => deleteAttendance(a.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <EntityFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title="Add Labor"
        onSubmit={() => {
          addLabor({
            ...form,
            projectId: companyId ? allProjects.find((p) => p.companyId === companyId)?.id : undefined,
          });
          toast.success("Labor added");
          setModalOpen(false);
        }}
      >
        <div className="grid gap-2">
          <input placeholder="Name" className="h-9 rounded-md border px-3 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Role" className="h-9 rounded-md border px-3 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          <input placeholder="Phone" className="h-9 rounded-md border px-3 text-sm" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
      </EntityFormModal>
    </PageWrap>
  );
}
