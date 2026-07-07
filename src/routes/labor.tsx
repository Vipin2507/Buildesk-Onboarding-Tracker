import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageWrap } from "@/components/page-header";
import { CountUp } from "@/components/count-up";
import { UploadCard } from "@/components/upload-card";
import { Button } from "@/components/ui/button";
import { EntityFormModal } from "@/components/entity-form-modal";
import { useLaborStore } from "@/stores";
import { formatRelativeTime } from "@/types/common";

export const Route = createFileRoute("/labor")({
  component: Labor,
});

function Labor() {
  const labor = useLaborStore((s) => s.labor);
  const attendance = useLaborStore((s) => s.attendance);
  const addLabor = useLaborStore((s) => s.addLabor);
  const deleteLabor = useLaborStore((s) => s.deleteLabor);
  const simulateAttendanceUpload = useLaborStore((s) => s.simulateAttendanceUpload);
  const deleteAttendance = useLaborStore((s) => s.deleteAttendance);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", role: "Mason", phone: "" });

  const presentToday = Math.round(labor.length * 0.8);
  const kpis = [
    { label: "Total Labor", value: labor.length },
    { label: "Present Today", value: presentToday },
    { label: "Absent Today", value: labor.length - presentToday },
    { label: "Uploads", value: attendance.length },
  ];

  return (
    <PageWrap>
      <PageHeader title="Labor Management" subtitle="Track daily attendance across every project site." />
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card-soft p-4">
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className="text-2xl font-semibold"><CountUp to={k.value} /></div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-soft overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <h3 className="font-semibold">Labor Details</h3>
            <Button size="sm" className="gap-1.5 bg-primary" onClick={() => setModalOpen(true)}><Plus className="h-3.5 w-3.5" /> Add Labor</Button>
          </div>
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
                    <Button size="icon" variant="ghost" onClick={() => { deleteLabor(r.id); toast.success("Labor removed"); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <UploadCard title="Attendance Upload" description="Upload daily attendance sheet (Excel)." sampleName="attendance_sample.xlsx"
            onUpload={(name) => simulateAttendanceUpload(name)}
          />
          <div className="card-soft mt-4 overflow-hidden">
            <div className="p-4"><h3 className="font-semibold">Recent Attendance</h3></div>
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
                    <td className="px-4 py-2.5">{a.fileName}<div className="text-xs text-muted-foreground">{formatRelativeTime(a.uploadedAt)}</div></td>
                    <td className="px-4 py-2.5 text-right text-success">{a.recordCount}</td>
                    <td className="px-4 py-2.5 text-right"><Button size="icon" variant="ghost" onClick={() => deleteAttendance(a.id)}><Trash2 className="h-4 w-4" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <EntityFormModal open={modalOpen} onOpenChange={setModalOpen} title="Add Labor" onSubmit={() => { addLabor(form); toast.success("Labor added"); setModalOpen(false); }}>
        <div className="grid gap-2">
          <input placeholder="Name" className="h-9 rounded-md border px-3 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Role" className="h-9 rounded-md border px-3 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          <input placeholder="Phone" className="h-9 rounded-md border px-3 text-sm" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
      </EntityFormModal>
    </PageWrap>
  );
}
