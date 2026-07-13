import type { Project } from "@/types";
import { newId, nowIso } from "@/types";
import { buildChecklistForProject } from "@/data/seed";
import { useOnboardingStore } from "./useOnboardingStore";
import { useProjectProgressStore } from "./useProjectProgressStore";
import { logActivity } from "./useActivityStore";
import { notifyInApp } from "./useNotificationStore";
import { createStore, touch } from "./persist";
import {
  createProject as apiCreateProject,
  updateProject as apiUpdateProject,
  deleteProject as apiDeleteProject,
  goLiveProject as apiGoLiveProject,
} from "@/lib/api";
import { serverSync, waitForSync } from "@/lib/sync";

type ProjectState = {
  projects: Project[];
  addProject: (data: Omit<Project, "id" | "createdAt" | "updatedAt">) => Project;
  updateProject: (id: string, data: Partial<Project>) => void;
  deleteProject: (id: string, opts?: { sync?: boolean }) => Project | undefined;
  getById: (id: string) => Project | undefined;
  getByCompany: (companyId: string) => Project[];
  goLive: (id: string) => boolean;
};

export const useProjectStore = createStore<ProjectState>((set, get) => ({
  projects: [],

  addProject: (data) => {
    const now = nowIso();
    const project: Project = { ...data, id: newId(), createdAt: now, updatedAt: now };
    set((s) => ({ projects: [project, ...s.projects] }));
    useOnboardingStore.getState().initChecklistForProject(project.id);
    logActivity({
      who: "You",
      what: `Created project ${project.name}`,
      kind: "success",
      companyId: project.companyId,
      projectId: project.id,
    });
    serverSync("createProject", async () => {
      // Sheet import creates company + project back-to-back; wait for company row first.
      await waitForSync(`company:${project.companyId}`);
      const payload = {
        id: project.id,
        name: project.name,
        companyId: project.companyId,
        type: project.type,
        units: project.units,
        city: project.city,
        rera: project.rera,
        status: project.status,
        currentStep: project.currentStep,
        startDate: project.startDate,
        address: project.address,
        state: project.state,
        pinCode: project.pinCode,
        totalTowers: project.totalTowers,
        totalFloors: project.totalFloors,
        agreementValue: project.agreementValue,
        otherCharges: project.otherCharges,
        customCharges: project.customCharges,
        logoUrl: project.logoUrl,
      };
      const result = await apiCreateProject({ data: payload });
      if (result && typeof result === "object" && "skipped" in result && result.skipped) {
        await new Promise((r) => setTimeout(r, 400));
        await waitForSync(`company:${project.companyId}`);
        return apiCreateProject({ data: payload });
      }
      return result;
    });
    return project;
  },

  updateProject: (id, data) => {
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? touch({ ...p, ...data }) : p)),
    }));
    const project = get().getById(id);
    if (project) {
      logActivity({
        who: "You",
        what: `Updated project ${project.name}`,
        kind: "info",
        companyId: project.companyId,
        projectId: id,
      });
      serverSync("updateProject", () => apiUpdateProject({ data: { id, patch: data } }));
    }
  },

  deleteProject: (id, opts) => {
    const project = get().getById(id);
    if (!project) return undefined;
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
    useOnboardingStore.getState().removeProjectData(id);
    useProjectProgressStore.getState().removeProject(id);
    logActivity({
      who: "You",
      what: `Deleted project ${project.name}`,
      kind: "warning",
      companyId: project.companyId,
      projectId: id,
    });
    if (opts?.sync !== false) {
      serverSync("deleteProject", () => apiDeleteProject({ data: { id } }));
    }
    return project;
  },

  getById: (id) => get().projects.find((p) => p.id === id),

  getByCompany: (companyId) => get().projects.filter((p) => p.companyId === companyId),

  goLive: (id) => {
    const canGoLive = useOnboardingStore.getState().canGoLive(id);
    if (!canGoLive) return false;
    const now = nowIso();
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === id ? touch({ ...p, status: "completed", goLiveAt: now, currentStep: 7 }) : p,
      ),
    }));
    const project = get().getById(id);
    if (project) {
      logActivity({
        who: "You",
        what: `🎉 ${project.name} went LIVE!`,
        kind: "success",
        companyId: project.companyId,
        projectId: id,
      });
      notifyInApp({
        title: `${project.name} is live`,
        body: "Project marked go-live.",
        kind: "success",
        href: `/projects/${project.id}`,
        companyId: project.companyId,
        gate: "golive",
      });
    }
    serverSync("goLiveProject", () => apiGoLiveProject({ data: { id } }));
    return true;
  },
}));

export { buildChecklistForProject };
