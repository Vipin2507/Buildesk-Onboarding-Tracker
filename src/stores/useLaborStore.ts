import type { AttendanceRecord, Labor } from "@/types";
import { newId, nowIso } from "@/types";
import { logActivity } from "./useActivityStore";
import { createPersistedStore, touch } from "./persist";
import { mutateLabor } from "@/lib/api";
import { serverSync } from "@/lib/sync";

type LaborState = {
  labor: Labor[];
  attendance: AttendanceRecord[];

  addLabor: (data: Omit<Labor, "id" | "createdAt" | "updatedAt">) => Labor;
  updateLabor: (id: string, data: Partial<Labor>) => void;
  deleteLabor: (id: string) => Labor | undefined;

  simulateAttendanceUpload: (fileName: string) => void;
  deleteAttendance: (id: string) => void;
};

export const useLaborStore = createPersistedStore<LaborState>("labor-v2", (set, get) => ({
  labor: [],
  attendance: [],

  addLabor: (data) => {
    const now = nowIso();
    const item: Labor = { ...data, id: newId(), createdAt: now, updatedAt: now };
    set((s) => ({ labor: [...s.labor, item] }));
    logActivity({ who: "You", what: `Added labor ${item.name}`, kind: "success" });
    serverSync("createLabor", () =>
      mutateLabor({ data: { action: "create", id: item.id, values: { ...data } } }),
    );
    return item;
  },

  updateLabor: (id, data) => {
    set((s) => ({ labor: s.labor.map((l) => (l.id === id ? touch({ ...l, ...data }) : l)) }));
    logActivity({ who: "You", what: "Updated labor record", kind: "info" });
    serverSync("updateLabor", () => mutateLabor({ data: { action: "update", id, values: data } }));
  },

  deleteLabor: (id) => {
    const item = get().labor.find((l) => l.id === id);
    set((s) => ({ labor: s.labor.filter((l) => l.id !== id) }));
    if (item) {
      logActivity({ who: "You", what: `Deleted labor ${item.name}`, kind: "warning" });
      serverSync("deleteLabor", () => mutateLabor({ data: { action: "delete", id } }));
    }
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
    serverSync("attendance", () =>
      mutateLabor({
        data: {
          action: "addAttendance",
          id: record.id,
          values: { fileName, recordCount: record.recordCount },
        },
      }),
    );
  },

  deleteAttendance: (id) => {
    set((s) => ({ attendance: s.attendance.filter((a) => a.id !== id) }));
  },
}));
