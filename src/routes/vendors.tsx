import { createFileRoute } from '@tanstack/react-router'
import type { ReactNode } from "react";
import { useState } from "react";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PageHeader, PageWrap } from "@/components/page-header";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { CountUp } from "@/components/count-up";
import { EntityFormModal, ConfirmDeleteDialog } from "@/components/entity-form-modal";
import { useVendorStore, useProjectStore } from "@/stores";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/vendors")({
  component: Vendors,
});

const TABS = ["Materials", "Suppliers", "Contractors", "Purchase Orders", "Work Orders", "BOQ & Activities", "Approval Flows"] as const;

function Vendors() {
  const store = useVendorStore();
  const projects = useProjectStore((s) => s.projects);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Materials");
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const kpis = [
    { label: "Materials", value: store.materials.length },
    { label: "Suppliers", value: store.suppliers.length },
    { label: "Contractors", value: store.contractors.length },
    { label: "Open POs", value: store.purchaseOrders.filter((p) => p.status === "Pending").length },
  ];

  function handleAdd() {
    if (tab === "Materials") store.addMaterial({ name: formData.name ?? "New Material", category: formData.category ?? "General", unit: formData.unit ?? "Nos" });
    else if (tab === "Suppliers") store.addSupplier({ name: formData.name ?? "", contact: formData.contact ?? "", phone: formData.phone ?? "" });
    else if (tab === "Contractors") store.addContractor({ name: formData.name ?? "", contact: formData.contact ?? "", phone: formData.phone ?? "" });
    else if (tab === "Purchase Orders") store.addPurchaseOrder({ number: `PO-${Date.now()}`, supplierId: store.suppliers[0]?.id ?? "", projectId: projects[0]?.id, date: new Date().toISOString().slice(0, 10), status: "Pending", amount: 0 });
    else if (tab === "Work Orders") store.addWorkOrder({ number: `WO-${Date.now()}`, contractorId: store.contractors[0]?.id ?? "", projectId: projects[0]?.id, date: new Date().toISOString().slice(0, 10), status: "Pending", amount: 0 });
    else if (tab === "BOQ & Activities") store.addBOQ({ name: formData.name ?? "New BOQ", projectId: projects[0]?.id ?? "", status: "Draft" });
    toast.success("Created successfully");
    setModalOpen(false);
  }

  return (
    <PageWrap>
      <PageHeader title="Vendor Management" subtitle="Materials, suppliers, contractors and approval workflows."
        actions={<Button className="gap-1.5 bg-primary" onClick={() => { setFormData({}); setModalOpen(true); }}><Plus className="h-4 w-4" /> New</Button>}
      />
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card-soft p-4">
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className="text-2xl font-semibold"><CountUp to={k.value} /></div>
          </div>
        ))}
      </div>
      <div className="card-soft mb-4 flex flex-wrap gap-1 p-1">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("rounded-md px-3 py-1.5 text-sm font-medium", tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{t}</button>
        ))}
      </div>

      {tab === "Materials" && <Table rows={store.materials.map((m) => [m.name, m.category, m.unit, m.id])} cols={["Material", "Category", "Unit", ""]} onDelete={(id) => { store.deleteMaterial(id); toast.success("Deleted"); }} />}
      {tab === "Suppliers" && <Table rows={store.suppliers.map((s) => [s.name, s.contact, s.phone, s.id])} cols={["Supplier", "Contact", "Phone", ""]} onDelete={(id) => store.deleteSupplier(id)} />}
      {tab === "Contractors" && <Table rows={store.contractors.map((c) => [c.name, c.contact, c.phone, c.id])} cols={["Contractor", "Contact", "Phone", ""]} onDelete={(id) => store.deleteContractor(id)} />}
      {tab === "Purchase Orders" && <Table rows={store.purchaseOrders.map((p) => [p.number, store.suppliers.find((s) => s.id === p.supplierId)?.name ?? "", p.date, <Pill key={p.id} tone="warning">{p.status}</Pill>, p.id])} cols={["PO", "Supplier", "Date", "Status", ""]} onDelete={(id) => store.deletePurchaseOrder(id)} />}
      {tab === "Work Orders" && <Table rows={store.workOrders.map((w) => [w.number, store.contractors.find((c) => c.id === w.contractorId)?.name ?? "", w.date, <Pill key={w.id}>{w.status}</Pill>, w.id])} cols={["WO", "Contractor", "Date", "Status", ""]} onDelete={(id) => store.deleteWorkOrder(id)} />}
      {tab === "BOQ & Activities" && <Table rows={store.boqs.map((b) => [b.name, projects.find((p) => p.id === b.projectId)?.name ?? "", <Pill key={b.id}>{b.status}</Pill>, b.id])} cols={["BOQ", "Project", "Status", ""]} onDelete={(id) => store.deleteBOQ(id)} />}
      {tab === "Approval Flows" && <ApprovalFlows flows={store.approvalFlows} onReorder={(id, stages) => store.reorderApprovalStages(id, stages)} onAddStage={(id) => store.addApprovalStage(id, "New Stage")} />}

      <EntityFormModal open={modalOpen} onOpenChange={setModalOpen} title={`Add ${tab}`} onSubmit={handleAdd}>
        <div className="grid gap-2">
          <input placeholder="Name" className="h-9 rounded-md border px-3 text-sm" onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
          {(tab === "Suppliers" || tab === "Contractors") && (
            <>
              <input placeholder="Contact" className="h-9 rounded-md border px-3 text-sm" onChange={(e) => setFormData({ ...formData, contact: e.target.value })} />
              <input placeholder="Phone" className="h-9 rounded-md border px-3 text-sm" onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
            </>
          )}
          {tab === "Materials" && (
            <>
              <input placeholder="Category" className="h-9 rounded-md border px-3 text-sm" onChange={(e) => setFormData({ ...formData, category: e.target.value })} />
              <input placeholder="Unit" className="h-9 rounded-md border px-3 text-sm" onChange={(e) => setFormData({ ...formData, unit: e.target.value })} />
            </>
          )}
        </div>
      </EntityFormModal>
    </PageWrap>
  );
}

function Table({ rows, cols, onDelete }: { rows: (string | ReactNode)[][]; cols: string[]; onDelete?: (id: string) => void }) {
  return (
    <div className="card-soft overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{cols.map((c) => <th key={c} className="px-4 py-2.5 text-left font-medium">{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t hover:bg-muted/40">
              {r.slice(0, -1).map((cell, j) => <td key={j} className="px-4 py-3">{cell}</td>)}
              {onDelete && <td className="px-4 py-3 text-right"><Button size="icon" variant="ghost" onClick={() => onDelete(String(r[r.length - 1]))}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ApprovalFlows({ flows, onReorder, onAddStage }: { flows: { id: string; name: string; stages: string[] }[]; onReorder: (id: string, stages: string[]) => void; onAddStage: (id: string) => void }) {
  const sensors = useSensors(useSensor(PointerSensor));
  return (
    <div className="space-y-4">
      {flows.map((f) => (
        <div key={f.id} className="card-soft p-5">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-semibold">{f.name}</h4>
            <Button size="sm" variant="ghost" onClick={() => onAddStage(f.id)}>+ Add Stage</Button>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e: DragEndEvent) => {
            const { active, over } = e;
            if (!over || active.id === over.id) return;
            const oldIndex = f.stages.indexOf(String(active.id));
            const newIndex = f.stages.indexOf(String(over.id));
            onReorder(f.id, arrayMove(f.stages, oldIndex, newIndex));
          }}>
            <SortableContext items={f.stages} strategy={verticalListSortingStrategy}>
              <div className="flex flex-wrap items-center gap-2">
                {f.stages.map((s, i) => <SortableStage key={s} id={s} index={i} />)}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      ))}
    </div>
  );
}

function SortableStage({ id, index }: { id: string; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
      <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" {...attributes} {...listeners} />
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white">{index + 1}</span>
      {id}
    </div>
  );
}
