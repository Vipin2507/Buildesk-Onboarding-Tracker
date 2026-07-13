import type { Project } from "@/types";
import { newId, nowIso } from "@/types";
import { buildChecklistForProject } from "@/data/seed";
import { useOnboardingStore } from "./useOnboardingStore";
import { useProjectProgressStore } from "./useProjectProgressStore";
import { logActivity } from "./useActivityStore";
import { createStore, touch } from "./persist";
import {
  createProject as apiCreateProject,
  updateProject as apiUpdateProject,
  deleteProject as apiDeleteProject,
  goLiveProject as apiGoLiveProject,
} from "@/lib/api";
import { serverSync } from "@/lib/sync";

type ProjectState = {
  projects: Project[];
  addProject: (data: Omit<Project, "id" | "createdAt" | "updatedAt">) => Project;
  updateProject: (id: string, data: Partial<Project>) => void;
  deleteProject: (id: string) => Project | undefined;
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
    serverSync("createProject", () =>
      apiCreateProject({
        data: {
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
        },
      }),
    );
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

  deleteProject: (id) => {
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
    serverSync("deleteProject", () => apiDeleteProject({ data: { id } }));
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
    }
    serverSync("goLiveProject", () => apiGoLiveProject({ data: { id } }));
    return true;
  },
}));

export { buildChecklistForProject };
