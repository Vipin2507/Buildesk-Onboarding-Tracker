import type { TrainingSession } from "@/types";
import { newId, nowIso } from "@/types";
import { seedTrainingSessions } from "@/data/seed";
import { logActivity } from "./useActivityStore";
import { createPersistedStore, touch } from "./persist";

type TrainingState = {
  sessions: TrainingSession[];
  addSession: (data: Omit<TrainingSession, "id" | "createdAt" | "updatedAt">) => TrainingSession;
  updateSession: (id: string, data: Partial<TrainingSession>) => void;
  deleteSession: (id: string) => TrainingSession | undefined;
};

export const useTrainingStore = createPersistedStore<TrainingState>("training-v2", (set, get) => ({
  sessions: seedTrainingSessions,

  addSession: (data) => {
    const now = nowIso();
    const session: TrainingSession = { ...data, id: newId(), createdAt: now, updatedAt: now };
    set((s) => ({ sessions: [...s.sessions, session] }));
    logActivity({ who: "You", what: `Scheduled ${session.type} training`, kind: "success", companyId: data.companyId, projectId: data.projectId });
    return session;
  },

  updateSession: (id, data) => {
    set((s) => ({ sessions: s.sessions.map((x) => (x.id === id ? touch({ ...x, ...data }) : x)) }));
    logActivity({ who: "You", what: "Updated training session", kind: "info" });
  },

  deleteSession: (id) => {
    const session = get().sessions.find((x) => x.id === id);
    set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) }));
    return session;
  },
}));
