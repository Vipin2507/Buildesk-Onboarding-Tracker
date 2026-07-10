import type { PostSalesProject, PostSalesStep } from "@/types";
import { newId, nowIso } from "@/types";
import { buildDefaultPostSalesSteps, buildPostSalesStepsFromDefs } from "@/data/module-catalog";
import { seedPostSalesProjects } from "@/data/seed";
import { logActivity } from "./useActivityStore";
import { recordAttachment } from "./useNotesAttachmentsStore";
import { getEnabledWorkflowStepDefs } from "./useMasterStore";
import { createPersistedStore, touch } from "./persist";

type PostSalesState = {
  projects: PostSalesProject[];

  addProject: (data: { companyId: string; projectNumber: string; projectName: string }) => PostSalesProject;
  updateProject: (id: string, data: Partial<Pick<PostSalesProject, "projectNumber" | "projectName">>) => void;
  deleteProject: (id: string) => PostSalesProject | undefined;

  addCustomStep: (
    projectId: string,
    data: { label: string; requiresTemplate: boolean },
  ) => PostSalesStep | undefined;

  sendTemplate: (projectId: string, stepId: string) => void;
  markTemplateReceived: (projectId: string, stepId: string) => void;
  uploadStepFile: (projectId: string, stepId: string, fileName: string, recordCount?: number) => void;
  submitForApproval: (projectId: string, stepId: string) => void;
  approveStep: (projectId: string, stepId: string, approvedBy: string) => void;
  rejectStep: (projectId: string, stepId: string, remarks: string, rejectedBy: string) => void;
};

function mapStep(
  projects: PostSalesProject[],
  projectId: string,
  stepId: string,
  updater: (step: PostSalesStep) => PostSalesStep,
): PostSalesProject[] {
  return projects.map((p) => {
    if (p.id !== projectId) return p;
    return touch({
      ...p,
      steps: p.steps.map((s) => (s.id === stepId ? updater(s) : s)),
    });
  });
}

// Bump the store key to avoid stale persisted shapes after step model refactors.
export const usePostSalesStore = createPersistedStore<PostSalesState>("post-sales-v3", (set, get) => ({
  projects: seedPostSalesProjects,

  addProject: ({ companyId, projectNumber, projectName }) => {
    const now = nowIso();
    const masterDefs = getEnabledWorkflowStepDefs().map((s) => ({
      key: s.key,
      label: s.label,
      requiresTemplate: s.requiresTemplate,
    }));
    const project: PostSalesProject = {
      id: newId(),
      companyId,
      projectNumber,
      projectName,
      steps: masterDefs.length > 0 ? buildPostSalesStepsFromDefs(masterDefs) : buildDefaultPostSalesSteps(),
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ projects: [project, ...s.projects] }));
    logActivity({
      who: "You",
      what: `Created Post Sales project ${projectNumber} — ${projectName}`,
      kind: "success",
      companyId,
      projectId: project.id,
    });
    return project;
  },

  updateProject: (id, data) => {
    const prev = get().projects.find((p) => p.id === id);
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? touch({ ...p, ...data }) : p)),
    }));
    if (prev) {
      logActivity({
        who: "You",
        what: `Updated Post Sales project ${data.projectNumber ?? prev.projectNumber}`,
        kind: "info",
        companyId: prev.companyId,
        projectId: id,
      });
    }
  },

  deleteProject: (id) => {
    const project = get().projects.find((p) => p.id === id);
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
    if (project) {
      logActivity({
        who: "You",
        what: `Deleted Post Sales project ${project.projectNumber} — ${project.projectName}`,
        kind: "warning",
        companyId: project.companyId,
        projectId: id,
      });
    }
    return project;
  },

  addCustomStep: (projectId, data) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return undefined;
    const maxOrder = project.steps.reduce((m, s) => Math.max(m, s.order), 0);
    const step: PostSalesStep = {
      id: newId(),
      key: `custom-${Date.now()}`,
      label: data.label,
      requiresTemplate: data.requiresTemplate,
      templateStatus: data.requiresTemplate ? "not-sent" : "not-required",
      uploadStatus: "not-uploaded",
      approvalStatus: "not-submitted",
      order: maxOrder + 1,
    };
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === projectId ? touch({ ...p, steps: [...p.steps, step] }) : p,
      ),
    }));
    logActivity({
      who: "You",
      what: `Added custom step "${data.label}" to ${project.projectNumber}`,
      kind: "info",
      companyId: project.companyId,
      projectId,
    });
    return step;
  },

  sendTemplate: (projectId, stepId) => {
    const project = get().projects.find((p) => p.id === projectId);
    set((s) => ({
      projects: mapStep(s.projects, projectId, stepId, (step) => ({
        ...step,
        templateStatus: "sent",
        templateSentOn: nowIso(),
      })),
    }));
    if (project) {
      const step = project.steps.find((x) => x.id === stepId);
      logActivity({
        who: "You",
        what: `Sent template for ${step?.label ?? "step"} — ${project.projectNumber}`,
        kind: "info",
        companyId: project.companyId,
        projectId,
      });
    }
  },

  markTemplateReceived: (projectId, stepId) => {
    const project = get().projects.find((p) => p.id === projectId);
    set((s) => ({
      projects: mapStep(s.projects, projectId, stepId, (step) => ({
        ...step,
        templateStatus: "received",
      })),
    }));
    if (project) {
      const step = project.steps.find((x) => x.id === stepId);
      logActivity({
        who: "You",
        what: `Marked template received for ${step?.label ?? "step"} — ${project.projectNumber}`,
        kind: "success",
        companyId: project.companyId,
        projectId,
      });
    }
  },

  uploadStepFile: (projectId, stepId, fileName, recordCount) => {
    const project = get().projects.find((p) => p.id === projectId);
    const count = recordCount ?? 40 + Math.floor(Math.random() * 120);
    const uploadedAt = nowIso();
    set((s) => ({
      projects: mapStep(s.projects, projectId, stepId, (step) => ({
        ...step,
        uploadStatus: "uploaded",
        uploadedFile: {
          name: fileName,
          uploadedAt,
          recordCount: count,
        },
        approvalStatus: "not-submitted",
        approvedBy: undefined,
        approvedOn: undefined,
        remarks: undefined,
      })),
    }));
    if (project) {
      const step = project.steps.find((x) => x.id === stepId);
      logActivity({
        who: "You",
        what: `Uploaded ${fileName} for ${step?.label ?? "step"} — ${project.projectNumber}`,
        kind: "success",
        companyId: project.companyId,
        projectId,
      });
      recordAttachment({
        companyId: project.companyId,
        projectId,
        fileName,
        purpose: step?.label ?? "Post Sales step",
        category: "post-sales-step",
        context: `Post Sales · ${project.projectNumber} · ${project.projectName}`,
        recordCount: count,
        uploadedBy: "You",
        uploadedAt,
      });
    }
  },

  submitForApproval: (projectId, stepId) => {
    const project = get().projects.find((p) => p.id === projectId);
    set((s) => ({
      projects: mapStep(s.projects, projectId, stepId, (step) => ({
        ...step,
        approvalStatus: "pending-approval",
      })),
    }));
    if (project) {
      const step = project.steps.find((x) => x.id === stepId);
      logActivity({
        who: "You",
        what: `Submitted ${step?.label ?? "step"} for approval — ${project.projectNumber}`,
        kind: "info",
        companyId: project.companyId,
        projectId,
      });
    }
  },

  approveStep: (projectId, stepId, approvedBy) => {
    const project = get().projects.find((p) => p.id === projectId);
    set((s) => ({
      projects: mapStep(s.projects, projectId, stepId, (step) => ({
        ...step,
        approvalStatus: "approved",
        approvedBy,
        approvedOn: nowIso(),
        remarks: undefined,
      })),
    }));
    if (project) {
      const step = project.steps.find((x) => x.id === stepId);
      logActivity({
        who: approvedBy,
        what: `Approved ${step?.label ?? "step"} — ${project.projectNumber}`,
        kind: "success",
        companyId: project.companyId,
        projectId,
      });
    }
  },

  rejectStep: (projectId, stepId, remarks, rejectedBy) => {
    const project = get().projects.find((p) => p.id === projectId);
    set((s) => ({
      projects: mapStep(s.projects, projectId, stepId, (step) => ({
        ...step,
        approvalStatus: "rejected",
        remarks,
        approvedBy: undefined,
        approvedOn: undefined,
      })),
    }));
    if (project) {
      const step = project.steps.find((x) => x.id === stepId);
      logActivity({
        who: rejectedBy,
        what: `Rejected ${step?.label ?? "step"} — ${project.projectNumber}: ${remarks}`,
        kind: "danger",
        companyId: project.companyId,
        projectId,
      });
    }
  },
}));
