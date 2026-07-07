import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageWrap } from "@/components/page-header";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { EntityFormModal } from "@/components/entity-form-modal";
import { useTrainingStore, useEmployeeStore, useCompanyStore } from "@/stores";

export const Route = createFileRoute("/training")({
  component: Training,
});

function Training() {
  const sessions = useTrainingStore((s) => s.sessions);
  const addSession = useTrainingStore((s) => s.addSession);
  const updateSession = useTrainingStore((s) => s.updateSession);
  const deleteSession = useTrainingStore((s) => s.deleteSession);
  const employees = useEmployeeStore((s) => s.employees);
  const companies = useCompanyStore((s) => s.companies);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ type: "Admin", trainerId: employees[0]?.id ?? "", companyId: companies[0]?.id ?? "", date: "", attendance: "", recording: "", status: "Scheduled" as const });

  return (
    <PageWrap>
      <PageHeader title="Training" subtitle="Live and recorded sessions for every stakeholder team."
        actions={<Button className="gap-1.5 bg-primary" onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> Add Session</Button>}
      />
      <div className="card-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Session</th>
              <th className="px-4 py-2 text-left">Trainer</th>
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2 text-left">Attendance</th>
              <th className="px-4 py-2 text-left">Recording</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-t hover:bg-muted/40">
                <td className="px-4 py-3 font-medium">{s.type}</td>
                <td className="px-4 py-3">{employees.find((e) => e.id === s.trainerId)?.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.date}</td>
                <td className="px-4 py-3">{s.attendance}</td>
                <td className="px-4 py-3">
                  {s.recording !== "—" ? <a href={s.recording} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent-foreground hover:underline"><Video className="h-3.5 w-3.5" /> View</a> : "—"}
                </td>
                <td className="px-4 py-3"><Pill tone={s.status === "Completed" ? "success" : "warning"}>{s.status}</Pill></td>
                <td className="px-4 py-3 text-right">
                  <Button size="icon" variant="ghost" onClick={() => deleteSession(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <EntityFormModal open={modalOpen} onOpenChange={setModalOpen} title="Add Training Session" onSubmit={() => { addSession(form); toast.success("Session scheduled"); setModalOpen(false); }}>
        <div className="grid gap-2">
          <input placeholder="Type" className="h-9 rounded-md border px-3 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
          <select className="h-9 rounded-md border px-3 text-sm" value={form.trainerId} onChange={(e) => setForm({ ...form, trainerId: e.target.value })}>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <input type="date" className="h-9 rounded-md border px-3 text-sm" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
      </EntityFormModal>
    </PageWrap>
  );
}
