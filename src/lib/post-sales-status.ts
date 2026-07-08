import type { PostSalesProject, PostSalesStep, StepStatus } from "@/types/module";

/** Single source of truth for step badge / progress / filters. */
export function getStepStatus(step: PostSalesStep): StepStatus {
  if (step.approvalStatus === "approved") return "approved";
  if (step.approvalStatus === "rejected") return "rejected";
  if (step.approvalStatus === "pending-approval") return "pending_approval";
  if (step.uploadStatus === "uploaded") return "data_uploaded";
  if (step.requiresTemplate && step.templateStatus === "sent") return "template_sent";
  return "not_started";
}

export function isTemplateStageSatisfied(step: PostSalesStep): boolean {
  if (!step.requiresTemplate) return true;
  return step.templateStatus === "received" || step.templateStatus === "not-required";
}

export function canUpload(step: PostSalesStep): boolean {
  return isTemplateStageSatisfied(step);
}

export function canSubmitForApproval(step: PostSalesStep): boolean {
  return (
    step.uploadStatus === "uploaded" &&
    step.approvalStatus !== "pending-approval" &&
    step.approvalStatus !== "approved"
  );
}

export function calcPostSalesProjectProgress(project: PostSalesProject): number {
  if (project.steps.length === 0) return 0;
  const done = project.steps.filter((s) => getStepStatus(s) === "approved").length;
  return Math.round((done / project.steps.length) * 100);
}

export function countApprovedSteps(project: PostSalesProject): { done: number; total: number } {
  const total = project.steps.length;
  const done = project.steps.filter((s) => getStepStatus(s) === "approved").length;
  return { done, total };
}

export const STEP_STATUS_LABEL: Record<StepStatus, string> = {
  not_started: "Not Started",
  template_sent: "Template Sent",
  data_uploaded: "Data Uploaded",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
};

export const STEP_STATUS_TONE: Record<
  StepStatus,
  "muted" | "warning" | "info" | "accent" | "success" | "danger"
> = {
  not_started: "muted",
  template_sent: "warning",
  data_uploaded: "info",
  pending_approval: "accent",
  approved: "success",
  rejected: "danger",
};
