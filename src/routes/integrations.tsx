import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageWrap } from "@/components/page-header";
import { Pill } from "@/components/status-pill";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { EntityFormModal } from "@/components/entity-form-modal";
import { useIntegrationStore } from "@/stores";

export const Route = createFileRoute("/integrations")({
  component: Integrations,
});

function Integrations() {
  const integrations = useIntegrationStore((s) => s.integrations);
  const triggers = useIntegrationStore((s) => s.triggers);
  const toggleIntegration = useIntegrationStore((s) => s.toggleIntegration);
  const toggleTrigger = useIntegrationStore((s) => s.toggleTrigger);
  const addTrigger = useIntegrationStore((s) => s.addTrigger);
  const deleteTrigger = useIntegrationStore((s) => s.deleteTrigger);
  const updateTrigger = useIntegrationStore((s) => s.updateTrigger);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", event: "", channel: "Email" });

  return (
    <PageWrap>
      <PageHeader title="Integrations & Triggers" subtitle="Connect external systems and configure automated messages."
        actions={<Button className="bg-primary" onClick={() => setModalOpen(true)}>+ Add Trigger</Button>}
      />
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Integrations</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {integrations.map((i) => (
          <div key={i.id} className="card-soft p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{i.name}</div>
                <div className="text-xs text-muted-foreground">{i.description}</div>
              </div>
              <Switch checked={i.connected} onCheckedChange={() => { toggleIntegration(i.id, "connected"); toast.success(`${i.name} updated`); }} />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={i.tested} onChange={() => toggleIntegration(i.id, "tested")} className="h-3.5 w-3.5" />
              <span className="text-muted-foreground">Tested</span>
            </label>
          </div>
        ))}
      </div>
      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Trigger Management</h2>
      <div className="card-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Trigger</th>
              <th className="px-4 py-2 text-left">Event</th>
              <th className="px-4 py-2 text-left">Channel</th>
              <th className="px-4 py-2 text-left">Active</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {triggers.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{t.event}</td>
                <td className="px-4 py-3"><Pill tone="accent">{t.channel}</Pill></td>
                <td className="px-4 py-3"><Switch checked={t.active} onCheckedChange={() => toggleTrigger(t.id)} /></td>
                <td className="px-4 py-3 text-right">
                  <Button size="icon" variant="ghost" onClick={() => deleteTrigger(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <EntityFormModal open={modalOpen} onOpenChange={setModalOpen} title="Add Trigger" onSubmit={() => { addTrigger({ ...form, active: true }); toast.success("Trigger added"); setModalOpen(false); }}>
        <div className="grid gap-2">
          <input placeholder="Name" className="h-9 rounded-md border px-3 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Event" className="h-9 rounded-md border px-3 text-sm" value={form.event} onChange={(e) => setForm({ ...form, event: e.target.value })} />
          <input placeholder="Channel" className="h-9 rounded-md border px-3 text-sm" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} />
        </div>
      </EntityFormModal>
    </PageWrap>
  );
}
