import type {
  ApprovalFlow,
  BOQ,
  Contractor,
  Material,
  PurchaseOrder,
  Supplier,
  WorkOrder,
} from "@/types";
import { newId, nowIso } from "@/types";
import { logActivity } from "./useActivityStore";
import { createStore, touch } from "./persist";
import { mutateVendorEntity } from "@/lib/api";
import { serverSync } from "@/lib/sync";

type VendorEntity =
  | "materials"
  | "suppliers"
  | "contractors"
  | "purchaseOrders"
  | "workOrders"
  | "boqs"
  | "approvalFlows";

type VendorState = {
  materials: Material[];
  suppliers: Supplier[];
  contractors: Contractor[];
  purchaseOrders: PurchaseOrder[];
  workOrders: WorkOrder[];
  boqs: BOQ[];
  approvalFlows: ApprovalFlow[];

  addMaterial: (data: Omit<Material, "id" | "createdAt" | "updatedAt">) => void;
  updateMaterial: (id: string, data: Partial<Material>) => void;
  deleteMaterial: (id: string) => Material | undefined;

  addSupplier: (data: Omit<Supplier, "id" | "createdAt" | "updatedAt">) => void;
  updateSupplier: (id: string, data: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => Supplier | undefined;

  addContractor: (data: Omit<Contractor, "id" | "createdAt" | "updatedAt">) => void;
  updateContractor: (id: string, data: Partial<Contractor>) => void;
  deleteContractor: (id: string) => Contractor | undefined;

  addPurchaseOrder: (data: Omit<PurchaseOrder, "id" | "createdAt" | "updatedAt">) => void;
  updatePurchaseOrder: (id: string, data: Partial<PurchaseOrder>) => void;
  deletePurchaseOrder: (id: string) => void;

  addWorkOrder: (data: Omit<WorkOrder, "id" | "createdAt" | "updatedAt">) => void;
  updateWorkOrder: (id: string, data: Partial<WorkOrder>) => void;
  deleteWorkOrder: (id: string) => void;

  addBOQ: (data: Omit<BOQ, "id" | "createdAt" | "updatedAt">) => void;
  updateBOQ: (id: string, data: Partial<BOQ>) => void;
  deleteBOQ: (id: string) => void;

  addApprovalStage: (flowId: string, stage: string) => void;
  removeApprovalStage: (flowId: string, index: number) => void;
  reorderApprovalStages: (flowId: string, stages: string[]) => void;
};

function crudAdd<T extends { id: string; createdAt: string; updatedAt: string }>(
  data: Omit<T, "id" | "createdAt" | "updatedAt">,
): T {
  const now = nowIso();
  return { ...data, id: newId(), createdAt: now, updatedAt: now } as T;
}

function sync(
  entity: VendorEntity,
  action: "create" | "update" | "delete",
  id?: string,
  values?: Record<string, unknown>,
) {
  serverSync(`vendor:${entity}`, () =>
    mutateVendorEntity({ data: { entity, action, id, values } }),
  );
}

function syncFlow(flowId: string) {
  queueMicrotask(() => {
    const flow = useVendorStore.getState().approvalFlows.find((f) => f.id === flowId);
    if (!flow) return;
    sync("approvalFlows", "update", flowId, { name: flow.name, stages: flow.stages });
  });
}

export const useVendorStore = createStore<VendorState>((set, get) => ({
  materials: [],
  suppliers: [],
  contractors: [],
  purchaseOrders: [],
  workOrders: [],
  boqs: [],
  approvalFlows: [],

  addMaterial: (data) => {
    const m = crudAdd<Material>(data);
    set((s) => ({ materials: [...s.materials, m] }));
    logActivity({ who: "You", what: `Added material ${m.name}`, kind: "success" });
    sync("materials", "create", m.id, { ...data });
  },
  updateMaterial: (id, data) => {
    set((s) => ({ materials: s.materials.map((m) => (m.id === id ? touch({ ...m, ...data }) : m)) }));
    logActivity({ who: "You", what: "Updated material", kind: "info" });
    sync("materials", "update", id, data);
  },
  deleteMaterial: (id) => {
    const m = get().materials.find((x) => x.id === id);
    set((s) => ({ materials: s.materials.filter((x) => x.id !== id) }));
    if (m) {
      logActivity({ who: "You", what: `Deleted material ${m.name}`, kind: "warning" });
      sync("materials", "delete", id);
    }
    return m;
  },

  addSupplier: (data) => {
    const s = crudAdd<Supplier>(data);
    set((st) => ({ suppliers: [...st.suppliers, s] }));
    logActivity({ who: "You", what: `Added supplier ${s.name}`, kind: "success" });
    sync("suppliers", "create", s.id, { ...data });
  },
  updateSupplier: (id, data) => {
    set((s) => ({ suppliers: s.suppliers.map((x) => (x.id === id ? touch({ ...x, ...data }) : x)) }));
    sync("suppliers", "update", id, data);
  },
  deleteSupplier: (id) => {
    const s = get().suppliers.find((x) => x.id === id);
    set((st) => ({ suppliers: st.suppliers.filter((x) => x.id !== id) }));
    if (s) sync("suppliers", "delete", id);
    return s;
  },

  addContractor: (data) => {
    const c = crudAdd<Contractor>(data);
    set((s) => ({ contractors: [...s.contractors, c] }));
    logActivity({ who: "You", what: `Added contractor ${c.name}`, kind: "success" });
    sync("contractors", "create", c.id, { ...data });
  },
  updateContractor: (id, data) => {
    set((s) => ({ contractors: s.contractors.map((x) => (x.id === id ? touch({ ...x, ...data }) : x)) }));
    sync("contractors", "update", id, data);
  },
  deleteContractor: (id) => {
    const c = get().contractors.find((x) => x.id === id);
    set((s) => ({ contractors: s.contractors.filter((x) => x.id !== id) }));
    if (c) sync("contractors", "delete", id);
    return c;
  },

  addPurchaseOrder: (data) => {
    const po = crudAdd<PurchaseOrder>(data);
    set((s) => ({ purchaseOrders: [...s.purchaseOrders, po] }));
    logActivity({ who: "You", what: `Created PO ${po.number}`, kind: "success" });
    sync("purchaseOrders", "create", po.id, { ...data });
  },
  updatePurchaseOrder: (id, data) => {
    set((s) => ({
      purchaseOrders: s.purchaseOrders.map((x) => (x.id === id ? touch({ ...x, ...data }) : x)),
    }));
    sync("purchaseOrders", "update", id, data);
  },
  deletePurchaseOrder: (id) => {
    set((s) => ({ purchaseOrders: s.purchaseOrders.filter((x) => x.id !== id) }));
    sync("purchaseOrders", "delete", id);
  },

  addWorkOrder: (data) => {
    const wo = crudAdd<WorkOrder>(data);
    set((s) => ({ workOrders: [...s.workOrders, wo] }));
    logActivity({ who: "You", what: `Created WO ${wo.number}`, kind: "success" });
    sync("workOrders", "create", wo.id, { ...data });
  },
  updateWorkOrder: (id, data) => {
    set((s) => ({ workOrders: s.workOrders.map((x) => (x.id === id ? touch({ ...x, ...data }) : x)) }));
    sync("workOrders", "update", id, data);
  },
  deleteWorkOrder: (id) => {
    set((s) => ({ workOrders: s.workOrders.filter((x) => x.id !== id) }));
    sync("workOrders", "delete", id);
  },

  addBOQ: (data) => {
    const b = crudAdd<BOQ>(data);
    set((s) => ({ boqs: [...s.boqs, b] }));
    logActivity({ who: "You", what: `Created BOQ ${b.name}`, kind: "success" });
    sync("boqs", "create", b.id, { ...data });
  },
  updateBOQ: (id, data) => {
    set((s) => ({ boqs: s.boqs.map((x) => (x.id === id ? touch({ ...x, ...data }) : x)) }));
    sync("boqs", "update", id, data);
  },
  deleteBOQ: (id) => {
    set((s) => ({ boqs: s.boqs.filter((x) => x.id !== id) }));
    sync("boqs", "delete", id);
  },

  addApprovalStage: (flowId, stage) => {
    set((s) => ({
      approvalFlows: s.approvalFlows.map((f) =>
        f.id === flowId ? touch({ ...f, stages: [...f.stages, stage] }) : f,
      ),
    }));
    syncFlow(flowId);
  },
  removeApprovalStage: (flowId, index) => {
    set((s) => ({
      approvalFlows: s.approvalFlows.map((f) =>
        f.id === flowId ? touch({ ...f, stages: f.stages.filter((_, i) => i !== index) }) : f,
      ),
    }));
    syncFlow(flowId);
  },
  reorderApprovalStages: (flowId, stages) => {
    set((s) => ({
      approvalFlows: s.approvalFlows.map((f) => (f.id === flowId ? touch({ ...f, stages }) : f)),
    }));
    syncFlow(flowId);
  },
}));
