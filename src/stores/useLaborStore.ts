import type { AttendanceRecord, Labor } from "@/types";
import { newId, nowIso } from "@/types";
import { seedAttendance, seedLabor } from "@/data/seed";
import { logActivity } from "./useActivityStore";
import { createPersistedStore, touch } from "./persist";

type LaborState = {
  labor: Labor[];
  attendance: AttendanceRecord[];

  addLabor: (data: Omit<Labor, "id" | "createdAt" | "updatedAt">) => Labor;
  updateLabor: (id: string, data: Partial<Labor>) => void;
  deleteLabor: (id: string) => Labor | undefined;

  simulateAttendanceUpload: (fileName: string) => void;
  deleteAttendance: (id: string) => void;
};

export const useLaborStore = createPersistedStore<LaborState>("labor", (set, get) => ({
  labor: seedLabor,
  attendance: seedAttendance,

  addLabor: (data) => {
    const now = nowIso();
    const item: Labor = { ...data, id: newId(), createdAt: now, updatedAt: now };
    set((s) => ({ labor: [...s.labor, item] }));
    logActivity({ who: "You", what: `Added labor ${item.name}`, kind: "success" });
    return item;
  },

  updateLabor: (id, data) => {
    set((s) => ({ labor: s.labor.map((l) => (l.id === id ? touch({ ...l, ...data }) : l)) }));
    logActivity({ who: "You", what: "Updated labor record", kind: "info" });
  },

  deleteLabor: (id) => {
    const item = get().labor.find((l) => l.id === id);
    set((s) => ({ labor: s.labor.filter((l) => l.id !== id) }));
    if (item) logActivity({ who: "You", what: `Deleted labor ${item.name}`, kind: "warning" });
    return item;
  },

  simulateAttendanceUpload: (fileName) => {
    const now = nowIso();
    const record: AttendanceRecord = {
      id: newId(),
      fileName,
      uploadedAt: now,
      recordCount: 100 + Math.floor(Math.random() * 100),
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ attendance: [record, ...s.attendance] }));
    logActivity({ who: "You", what: `Uploaded attendance ${fileName}`, kind: "success" });
  },

  deleteAttendance: (id) => {
    set((s) => ({ attendance: s.attendance.filter((a) => a.id !== id) }));
  },
}));
