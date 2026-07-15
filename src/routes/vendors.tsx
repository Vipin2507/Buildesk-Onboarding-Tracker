import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { z } from "zod";
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
import { useVendorStore, useProjectStore, useCompanyStore } from "@/stores";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  companyId: z.string().optional(),
});

export const Route = createFileRoute("/vendors")({
  validateSearch: (search) => searchSchema.parse(search),
  component: Vendors,
});

const TABS = ["Materials", "Suppliers", "Contractors", "Purchase Orders", "Work Orders", "BOQ & Activities", "Approval Flows"] as const;

function Vendors() {
  const { companyId } = Route.useSearch();
  const store = useVendorStore();
  const allProjects = useProjectStore((s) => s.projects);
  const company = useCompanyStore((s) => s.companies.find((c) => c.id === companyId));
  const projects = useMemo(() => {
    if (!companyId) return allProjects;
    return allProjects.filter((p) => p.companyId === companyId);
  }, [allProjects, companyId]);
  const projectIds = useMemo(() => new Set(projects.map((p) => p.id)), [projects]);
  const purchaseOrders = useMemo(() => {
    if (!companyId) return store.purchaseOrders;
    return store.purchaseOrders.filter((p) => p.projectId && projectIds.has(p.projectId));
  }, [store.purchaseOrders, companyId, projectIds]);
  const workOrders = useMemo(() => {
    if (!companyId) return store.workOrders;
    return store.workOrders.filter((w) => w.projectId && projectIds.has(w.projectId));
  }, [store.workOrders, companyId, projectIds]);
  const boqs = useMemo(() => {
    if (!companyId) return store.boqs;
    return store.boqs.filter((b) => projectIds.has(b.projectId));
  }, [store.boqs, companyId, projectIds]);

  const [tab, setTab] = useState<(typeof TABS)[number]>("Materials");
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const defaultProjectId = projects[0]?.id;

  const kpis = [
    { label: "Materials", value: store.materials.length },
    { label: "Suppliers", value: store.suppliers.length },
    { label: "Contractors", value: store.contractors.length },
    { label: "Open POs", value: purchaseOrders.filter((p) => p.status === "Pending").length },
  ];

  function handleAdd() {
    if (tab === "Materials") store.addMaterial({ name: formData.name ?? "New Material", category: formData.category ?? "General", unit: formData.unit ?? "Nos" });
    else if (tab === "Suppliers") store.addSupplier({ name: formData.name ?? "", contact: formData.contact ?? "", phone: formData.phone ?? "" });
    else if (tab === "Contractors") store.addContractor({ name: formData.name ?? "", contact: formData.contact ?? "", phone: formData.phone ?? "" });
    else if (tab === "Purchase Orders") store.addPurchaseOrder({ number: `PO-${Date.now()}`, supplierId: store.suppliers[0]?.id ?? "", projectId: defaultProjectId, date: new Date().toISOString().slice(0, 10), status: "Pending", amount: 0 });
    else if (tab === "Work Orders") store.addWorkOrder({ number: `WO-${Date.now()}`, contractorId: store.contractors[0]?.id ?? "", projectId: defaultProjectId, date: new Date().toISOString().slice(0, 10), status: "Pending", amount: 0 });
    else if (tab === "BOQ & Activities") store.addBOQ({ name: formData.name ?? "New BOQ", projectId: defaultProjectId ?? "", status: "Draft" });
    toast.success("Created successfully");
    setModalOpen(false);
  }

  return (
    <PageWrap>
      <PageHeader
        title="Vendor Management"
        subtitle={
          company
            ? `Materials & procurements for ${company.name}. Project-linked POs/WOs/BOQs are company-filtered.`
            : "Materials, suppliers, contractors and approval workflows."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {companyId ? (
              <Button size="sm" variant="outline" asChild>
                <Link to="/companies/$companyId/modules/$moduleKey" params={{ companyId, moduleKey: "vendor-management" }}>
                  Module hub
                </Link>
              </Button>
            ) : null}
            <Button className="gap-1.5 bg-primary" onClick={() => { setFormData({}); setModalOpen(true); }}>
              <Plus className="h-4 w-4" /> New
            </Button>
          </div>
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
      <div className="card-soft mb-4 -mx-1 flex gap-1 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:overflow-visible">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("min-h-10 shrink-0 rounded-md px-3 py-2 text-sm font-medium", tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{t}</button>
        ))}
      </div>

      {tab === "Materials" && <Table rows={store.materials.map((m) => [m.name, m.category, m.unit, m.id])} cols={["Material", "Category", "Unit", ""]} onDelete={(id) => { store.deleteMaterial(id); toast.success("Deleted"); }} />}
      {tab === "Suppliers" && <Table rows={store.suppliers.map((s) => [s.name, s.contact, s.phone, s.id])} cols={["Supplier", "Contact", "Phone", ""]} onDelete={(id) => store.deleteSupplier(id)} />}
      {tab === "Contractors" && <Table rows={store.contractors.map((c) => [c.name, c.contact, c.phone, c.id])} cols={["Contractor", "Contact", "Phone", ""]} onDelete={(id) => store.deleteContractor(id)} />}
      {tab === "Purchase Orders" && <Table rows={purchaseOrders.map((p) => [p.number, store.suppliers.find((s) => s.id === p.supplierId)?.name ?? "", p.date, <Pill key={p.id} tone="warning">{p.status}</Pill>, p.id])} cols={["PO", "Supplier", "Date", "Status", ""]} onDelete={(id) => store.deletePurchaseOrder(id)} />}
      {tab === "Work Orders" && <Table rows={workOrders.map((w) => [w.number, store.contractors.find((c) => c.id === w.contractorId)?.name ?? "", w.date, <Pill key={w.id}>{w.status}</Pill>, w.id])} cols={["WO", "Contractor", "Date", "Status", ""]} onDelete={(id) => store.deleteWorkOrder(id)} />}
      {tab === "BOQ & Activities" && <Table rows={boqs.map((b) => [b.name, projects.find((p) => p.id === b.projectId)?.name ?? "", <Pill key={b.id}>{b.status}</Pill>, b.id])} cols={["BOQ", "Project", "Status", ""]} onDelete={(id) => store.deleteBOQ(id)} />}
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

function Table({ rows, cols, onDelete }: { rows: (string | ReactNode)[][]; cols: string[]; onDelete: (id: string) => void }) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  return (
    <>
      <div className="card-soft overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>{cols.map((c) => <th key={c} className="px-4 py-2 text-left">{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const id = String(r[r.length - 1]);
                return (
                  <tr key={id} className="border-t hover:bg-muted/40">
                    {r.slice(0, -1).map((cell, i) => <td key={i} className="px-4 py-2.5">{cell}</td>)}
                    <td className="px-4 py-2.5 text-right">
                      <Button size="icon" variant="ghost" onClick={() => setDeleteId(id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="space-y-2 p-3 md:hidden">
          {rows.map((r) => {
            const id = String(r[r.length - 1]);
            return (
              <div key={id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                <div className="min-w-0 text-sm font-medium">{r[0]}</div>
                <Button size="icon" variant="ghost" onClick={() => setDeleteId(id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            );
          })}
        </div>
      </div>
      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete item?"
        description="This cannot be undone."
        onConfirm={() => {
          if (deleteId) {
            onDelete(deleteId);
            setDeleteId(null);
            toast.success("Deleted");
          }
        }}
      />
    </>
  );
}

function ApprovalFlows({
  flows,
  onReorder,
  onAddStage,
}: {
  flows: { id: string; name: string; stages: string[] }[];
  onReorder: (id: string, stages: string[]) => void;
  onAddStage: (id: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  return (
    <div className="space-y-4">
      {flows.map((flow) => (
        <div key={flow.id} className="card-soft p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">{flow.name}</h3>
            <Button size="sm" variant="outline" onClick={() => onAddStage(flow.id)}><Plus className="mr-1 h-3.5 w-3.5" /> Stage</Button>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(e: DragEndEvent) => {
              const { active, over } = e;
              if (!over || active.id === over.id) return;
              const oldIndex = flow.stages.indexOf(String(active.id));
              const newIndex = flow.stages.indexOf(String(over.id));
              if (oldIndex < 0 || newIndex < 0) return;
              onReorder(flow.id, arrayMove(flow.stages, oldIndex, newIndex));
            }}
          >
            <SortableContext items={flow.stages} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {flow.stages.map((stage) => (
                  <SortableStage key={stage} id={stage} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      ))}
    </div>
  );
}

function SortableStage({ id }: { id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      <span className="flex-1">{id}</span>
      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
    </div>
  );
}
