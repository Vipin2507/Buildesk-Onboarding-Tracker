import type { FollowUpTask } from "@/types";
import { newId, nowIso } from "@/types";
import { createStore, touch } from "./persist";
import {
  cancelFollowUpTask as apiCancel,
  createFollowUpTask as apiCreate,
  updateFollowUpTask as apiUpdate,
} from "@/lib/api";
import { serverSyncWithRollback } from "@/lib/sync";

type TaskState = {
  tasks: FollowUpTask[];
  setTasks: (tasks: FollowUpTask[]) => void;
  addTask: (
    data: Omit<FollowUpTask, "id" | "createdAt" | "updatedAt" | "completedAt">,
  ) => FollowUpTask;
  updateTask: (
    id: string,
    data: Partial<FollowUpTask> & { remark?: string },
  ) => void;
  cancelTask: (id: string, reason?: string) => void;
  getById: (id: string) => FollowUpTask | undefined;
  getByCompany: (companyId: string) => FollowUpTask[];
};

export const useTaskStore = createStore<TaskState>((set, get) => ({
  tasks: [],

  setTasks: (tasks) => set({ tasks }),

  addTask: (data) => {
    const now = nowIso();
    const task: FollowUpTask = {
      ...data,
      id: newId(),
      completedAt: data.status === "completed" ? now : undefined,
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ tasks: [task, ...s.tasks] }));
    serverSyncWithRollback(
      "createFollowUpTask",
      () =>
        apiCreate({
          data: {
            id: task.id,
            companyId: task.companyId,
            onboardingProjectId: task.onboardingProjectId,
            postSalesProjectId: task.postSalesProjectId,
            sourceVisitId: task.sourceVisitId,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            progressPercent: task.progressPercent,
            dueDate: task.dueDate,
            assigneeUserId: task.assigneeUserId,
          },
        }).then((saved) => {
          if (saved) {
            set((s) => ({
              tasks: s.tasks.map((t) => (t.id === task.id ? saved : t)),
            }));
          }
          return saved;
        }),
      () => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== task.id) })),
    );
    return task;
  },

  updateTask: (id, data) => {
    const previous = get().getById(id);
    if (!previous) return;
    const { remark, ...patch } = data;
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id
          ? touch({
              ...t,
              ...patch,
              completedAt:
                patch.status === "completed"
                  ? t.completedAt || nowIso()
                  : patch.status
                    ? undefined
                    : t.completedAt,
            })
          : t,
      ),
    }));
    serverSyncWithRollback(
      "updateFollowUpTask",
      () =>
        apiUpdate({
          data: {
            id,
            patch: {
              ...patch,
              remark,
            },
          },
        }).then((saved) => {
          if (saved) {
            set((s) => ({
              tasks: s.tasks.map((t) => (t.id === id ? saved : t)),
            }));
          }
          return saved;
        }),
      () =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? previous : t)),
        })),
    );
  },

  cancelTask: (id, reason) => {
    const previous = get().getById(id);
    if (!previous) return;
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? touch({ ...t, status: "cancelled" }) : t)),
    }));
    serverSyncWithRollback(
      "cancelFollowUpTask",
      () => apiCancel({ data: { id, reason } }),
      () =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? previous : t)),
        })),
    );
  },

  getById: (id) => get().tasks.find((t) => t.id === id),
  getByCompany: (companyId) => get().tasks.filter((t) => t.companyId === companyId),
}));
