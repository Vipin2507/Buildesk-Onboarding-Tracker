import type { FollowUpTask } from "@/types";
import { newId, nowIso } from "@/types";
import { createStore, touch } from "./persist";
import {
  cancelErpFollowUpTask as apiCancel,
  completeErpFollowUpTask as apiComplete,
  createErpFollowUpTask as apiCreate,
  deleteErpFollowUpTask as apiDelete,
  updateErpFollowUpTask as apiUpdate,
} from "@/lib/api";
import { serverSyncWithRollback } from "@/lib/sync";

type ErpTaskState = {
  tasks: FollowUpTask[];
  setTasks: (tasks: FollowUpTask[]) => void;
  addTask: (
    data: Omit<FollowUpTask, "id" | "createdAt" | "updatedAt" | "completedAt" | "completedByUserId" | "productScope">,
  ) => FollowUpTask;
  updateTask: (
    id: string,
    data: Partial<FollowUpTask> & { remark?: string },
  ) => void;
  completeTask: (id: string, remark?: string) => void;
  cancelTask: (id: string, reason?: string) => void;
  deleteTask: (id: string) => void;
  getById: (id: string) => FollowUpTask | undefined;
  getByCompany: (companyId: string) => FollowUpTask[];
};

function taskPayload(task: Partial<FollowUpTask>) {
  return {
    companyId: task.companyId!,
    onboardingProjectId: task.onboardingProjectId,
    postSalesProjectId: task.postSalesProjectId,
    sourceVisitId: task.sourceVisitId,
    title: task.title!,
    description: task.description,
    status: task.status,
    priority: task.priority,
    progressPercent: task.progressPercent,
    dueDate: task.dueDate,
    taskType: task.taskType,
    startTime: task.startTime,
    endTime: task.endTime,
    durationMinutes: task.durationMinutes,
    extraTimeMinutes: task.extraTimeMinutes,
    latestRemark: task.latestRemark,
    assigneeUserId: task.assigneeUserId,
    assigneeUserIds: task.assigneeUserIds,
    source: task.source,
  };
}

export const useErpTaskStore = createStore<ErpTaskState>((set, get) => ({
  tasks: [],

  setTasks: (tasks) => set({ tasks }),

  addTask: (data) => {
    const now = nowIso();
    const assigneeUserIds =
      data.assigneeUserIds?.length
        ? data.assigneeUserIds
        : data.assigneeUserId
          ? [data.assigneeUserId]
          : [];
    const task: FollowUpTask = {
      ...data,
      productScope: "erp",
      assigneeUserIds,
      assigneeUserId: assigneeUserIds[0] ?? data.assigneeUserId,
      id: newId(),
      completedAt: data.status === "completed" ? now : undefined,
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ tasks: [task, ...s.tasks] }));
    serverSyncWithRollback(
      "createErpFollowUpTask",
      () =>
        apiCreate({
          data: { id: task.id, ...taskPayload(task) },
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
    const assigneeUserIds =
      patch.assigneeUserIds ??
      (patch.assigneeUserId ? [patch.assigneeUserId] : previous.assigneeUserIds);
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id
          ? touch({
              ...t,
              ...patch,
              assigneeUserIds,
              assigneeUserId: assigneeUserIds?.[0] ?? patch.assigneeUserId ?? t.assigneeUserId,
              latestRemark: remark?.trim() ? remark.trim() : patch.latestRemark ?? t.latestRemark,
              completedAt:
                patch.status === "completed"
                  ? t.completedAt || nowIso()
                  : patch.status !== undefined
                    ? undefined
                    : t.completedAt,
            })
          : t,
      ),
    }));
    serverSyncWithRollback(
      "updateErpFollowUpTask",
      () =>
        apiUpdate({
          data: {
            id,
            patch: {
              ...patch,
              assigneeUserIds,
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

  completeTask: (id, remark) => {
    const previous = get().getById(id);
    if (!previous) return;
    const now = nowIso();
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id
          ? touch({
              ...t,
              status: "completed",
              progressPercent: 100,
              completedAt: now,
            })
          : t,
      ),
    }));
    serverSyncWithRollback(
      "completeErpFollowUpTask",
      () =>
        apiComplete({ data: { id, remark } }).then((saved) => {
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
      "cancelErpFollowUpTask",
      () => apiCancel({ data: { id, reason } }),
      () =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? previous : t)),
        })),
    );
  },

  deleteTask: (id) => {
    const previous = get().getById(id);
    if (!previous) return;
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    serverSyncWithRollback(
      "deleteErpFollowUpTask",
      () => apiDelete({ data: { id } }),
      () => set((s) => ({ tasks: [previous, ...s.tasks] })),
    );
  },

  getById: (id) => get().tasks.find((t) => t.id === id),
  getByCompany: (companyId) => get().tasks.filter((t) => t.companyId === companyId),
}));
