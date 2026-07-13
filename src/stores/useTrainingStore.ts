import type { TrainingSession } from "@/types";
import { newId, nowIso } from "@/types";
import { logActivity } from "./useActivityStore";
import { createStore, touch } from "./persist";
import {
  createTraining as apiCreate,
  updateTraining as apiUpdate,
  deleteTraining as apiDelete,
} from "@/lib/api";
import { serverSync } from "@/lib/sync";

type TrainingState = {
  sessions: TrainingSession[];
  addSession: (data: Omit<TrainingSession, "id" | "createdAt" | "updatedAt">) => TrainingSession;
  updateSession: (id: string, data: Partial<TrainingSession>) => void;
  deleteSession: (id: string) => TrainingSession | undefined;
};

export const useTrainingStore = createStore<TrainingState>((set, get) => ({
  sessions: [],

  addSession: (data) => {
    const now = nowIso();
    const session: TrainingSession = { ...data, id: newId(), createdAt: now, updatedAt: now };
    set((s) => ({ sessions: [...s.sessions, session] }));
    logActivity({
      who: "You",
      what: `Scheduled ${session.type} training`,
      kind: "success",
      companyId: data.companyId,
      projectId: data.projectId,
    });
    serverSync("createTraining", () =>
      apiCreate({
        data: {
          id: session.id,
          type: session.type,
          trainerId: session.trainerId,
          companyId: session.companyId,
          date: session.date,
          attendance: session.attendance,
          recording: session.recording,
          status: session.status,
        },
      }),
    );
    return session;
  },

  updateSession: (id, data) => {
    set((s) => ({ sessions: s.sessions.map((x) => (x.id === id ? touch({ ...x, ...data }) : x)) }));
    logActivity({ who: "You", what: "Updated training session", kind: "info" });
    serverSync("updateTraining", () => apiUpdate({ data: { id, patch: data } }));
  },

  deleteSession: (id) => {
    const session = get().sessions.find((x) => x.id === id);
    set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) }));
    if (session) serverSync("deleteTraining", () => apiDelete({ data: { id } }));
    return session;
  },
}));
