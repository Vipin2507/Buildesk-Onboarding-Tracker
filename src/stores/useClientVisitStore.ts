import type { ClientVisit } from "@/types";
import { newId, nowIso } from "@/types";
import { createStore, touch } from "./persist";
import {
  createClientVisit as apiCreate,
  updateClientVisit as apiUpdate,
} from "@/lib/api";
import { serverSyncWithRollback } from "@/lib/sync";

type VisitState = {
  visits: ClientVisit[];
  setVisits: (visits: ClientVisit[]) => void;
  addVisit: (data: Omit<ClientVisit, "id" | "createdAt" | "updatedAt">) => ClientVisit;
  updateVisit: (id: string, data: Partial<ClientVisit>) => void;
  getById: (id: string) => ClientVisit | undefined;
  getByCompany: (companyId: string) => ClientVisit[];
};

export const useClientVisitStore = createStore<VisitState>((set, get) => ({
  visits: [],

  setVisits: (visits) => set({ visits }),

  addVisit: (data) => {
    const now = nowIso();
    const visit: ClientVisit = {
      ...data,
      id: newId(),
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ visits: [visit, ...s.visits] }));
    serverSyncWithRollback(
      "createClientVisit",
      () =>
        apiCreate({
          data: {
            id: visit.id,
            companyId: visit.companyId,
            onboardingProjectId: visit.onboardingProjectId,
            postSalesProjectId: visit.postSalesProjectId,
            scheduledAt: visit.scheduledAt,
            startedAt: visit.startedAt,
            endedAt: visit.endedAt,
            status: visit.status,
            visitType: visit.visitType,
            purpose: visit.purpose,
            location: visit.location,
            assignedUserId: visit.assignedUserId,
            contactName: visit.contactName,
            contactPhone: visit.contactPhone,
            outcome: visit.outcome,
            remarks: visit.remarks,
            notes: visit.notes,
            nextAction: visit.nextAction,
            nextFollowUpDate: visit.nextFollowUpDate,
          },
        }).then((saved) => {
          if (saved) {
            set((s) => ({
              visits: s.visits.map((v) => (v.id === visit.id ? saved : v)),
            }));
          }
          return saved;
        }),
      () => set((s) => ({ visits: s.visits.filter((v) => v.id !== visit.id) })),
    );
    return visit;
  },

  updateVisit: (id, data) => {
    const previous = get().getById(id);
    if (!previous) return;
    set((s) => ({
      visits: s.visits.map((v) => (v.id === id ? touch({ ...v, ...data }) : v)),
    }));
    serverSyncWithRollback(
      "updateClientVisit",
      () =>
        apiUpdate({
          data: { id, patch: data },
        }).then((saved) => {
          if (saved) {
            set((s) => ({
              visits: s.visits.map((v) => (v.id === id ? saved : v)),
            }));
          }
          return saved;
        }),
      () =>
        set((s) => ({
          visits: s.visits.map((v) => (v.id === id ? previous : v)),
        })),
    );
  },

  getById: (id) => get().visits.find((v) => v.id === id),
  getByCompany: (companyId) => get().visits.filter((v) => v.companyId === companyId),
}));
