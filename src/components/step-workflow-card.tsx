import { useState } from "react";
import { motion } from "framer-motion";
import { Check, FileSpreadsheet, UploadCloud, ShieldCheck, Send } from "lucide-react";
import { toast } from "sonner";
import type { PostSalesStep } from "@/types";
import {
  getStepStatus,
  canUpload,
  canSubmitForApproval,
  STEP_STATUS_LABEL,
  STEP_STATUS_TONE,
} from "@/lib/post-sales-status";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { UploadCard } from "@/components/upload-card";
import { ConfirmDeleteDialog } from "@/components/entity-form-modal";
import { usePostSalesStore, useCurrentUser, useMasterStore } from "@/stores";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function StageConnector({ filled }: { filled: boolean }) {
  return (
    <div className="mx-1 hidden h-0.5 flex-1 sm:block">
      <motion.div
        className={cn("h-full rounded-full", filled ? "bg-primary" : "bg-border")}
        initial={false}
        animate={{ width: filled ? "100%" : "40%" }}
        transition={{ duration: 0.4 }}
        style={{ width: filled ? "100%" : "40%" }}
      />
    </div>
  );
}

function willResetApproval(step: PostSalesStep) {
  return step.approvalStatus === "approved"
    || step.approvalStatus === "rejected"
    || step.approvalStatus === "pending-approval";
}

export function StepWorkflowCard({
  projectId,
  step,
}: {
  projectId: string;
  step: PostSalesStep;
}) {
  const sendTemplate = usePostSalesStore((s) => s.sendTemplate);
  const markTemplateReceived = usePostSalesStore((s) => s.markTemplateReceived);
  const uploadStepFile = usePostSalesStore((s) => s.uploadStepFile);
  const submitForApproval = usePostSalesStore((s) => s.submitForApproval);
  const approveStep = usePostSalesStore((s) => s.approveStep);
  const rejectStep = usePostSalesStore((s) => s.rejectStep);
  const currentUser = useCurrentUser();
  const isAdmin = currentUser?.role === "Admin";
  const requireRejectionRemarks = useMasterStore((s) => s.platform.requireRejectionRemarks);
  const allowViewerApprovals = useMasterStore((s) => s.platform.allowViewerApprovals);
  const canApprove = isAdmin || allowViewerApprovals;

  const [rejectOpen, setRejectOpen] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [reuploadOpen, setReuploadOpen] = useState(false);
  const [pendingFileName, setPendingFileName] = useState<string | null>(null);

  const status = getStepStatus(step);
  const templateDone = !step.requiresTemplate || step.templateStatus === "received" || step.templateStatus === "not-required";
  const uploadDone = step.uploadStatus === "uploaded";
  const approvalDone = step.approvalStatus === "approved";
  const uploadEnabled = canUpload(step);
  const submitEnabled = canSubmitForApproval(step);
  const sampleName = `${step.key}.xlsx`;

  function commitUpload(name: string) {
    uploadStepFile(projectId, step.id, name);
    toast.success("File uploaded", { description: "Records simulated for prototype. Approval reset to not submitted." });
  }

  function handleUpload(name: string) {
    commitUpload(name);
  }

  function handleReplaceRequest(name: string) {
    setPendingFileName(name);
    setReuploadOpen(true);
  }

  function confirmReupload() {
    if (!pendingFileName) return;
    commitUpload(pendingFileName);
    setPendingFileName(null);
    setReuploadOpen(false);
  }

  function handleReject() {
    if (!canApprove) {
      toast.error("Only Admins can reject steps");
      return;
    }
    if (requireRejectionRemarks && !remarks.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    rejectStep(projectId, step.id, remarks.trim() || "Rejected", currentUser?.name ?? "Admin");
    toast.error("Step rejected", { description: remarks.trim() || undefined });
    setRemarks("");
    setRejectOpen(false);
  }

  function handleApprove() {
    if (!canApprove) {
      toast.error("Only Admins can approve steps");
      return;
    }
    approveStep(projectId, step.id, currentUser?.name ?? "Admin");
    toast.success("Approved");
  }

  const approvalResetHint =
    step.approvalStatus === "pending-approval"
      ? "This step is pending approval. Re-uploading will withdraw the submission."
      : step.approvalStatus === "approved"
        ? "This step is already approved. Re-uploading will clear that approval."
        : "This step was rejected. Re-uploading will clear the rejection remarks and reset approval.";

  return (
    <div id={`step-${step.id}`} className="card-soft scroll-mt-24 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">{step.label}</h3>
          <p className="text-xs text-muted-foreground">Step {step.order}</p>
        </div>
        <Pill tone={STEP_STATUS_TONE[status]}>{STEP_STATUS_LABEL[status]}</Pill>
      </div>

      {step.approvalStatus === "rejected" && step.remarks && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Rejection reason: {step.remarks}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        {/* Stage 1 */}
        <div className={cn("flex-1 rounded-lg border p-3", templateDone ? "border-primary/40 bg-primary/5" : "bg-muted/20")}>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <FileSpreadsheet className="h-3.5 w-3.5" /> Template
          </div>
          {!step.requiresTemplate ? (
            <Pill tone="muted">Not Required</Pill>
          ) : (
            <div className="space-y-2">
              <div className="text-sm">
                {step.templateStatus === "not-sent" && "Not sent"}
                {step.templateStatus === "sent" && (
                  <>Sent{step.templateSentOn ? ` · ${new Date(step.templateSentOn).toLocaleDateString()}` : ""}</>
                )}
                {step.templateStatus === "received" && "Received from customer"}
              </div>
              {step.templateStatus === "not-sent" && (
                <Button
                  size="sm"
                  className="gap-1"
                  onClick={() => {
                    sendTemplate(projectId, step.id);
                    toast.success("Template sent to customer");
                  }}
                >
                  <Send className="h-3.5 w-3.5" /> Send Template
                </Button>
              )}
              {step.templateStatus === "sent" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    markTemplateReceived(projectId, step.id);
                    toast.success("Marked as received");
                  }}
                >
                  Mark Received
                </Button>
              )}
              {step.templateStatus === "received" && (
                <span className="inline-flex items-center gap-1 text-xs text-success">
                  <Check className="h-3.5 w-3.5" /> Ready for upload
                </span>
              )}
            </div>
          )}
        </div>

        <StageConnector filled={templateDone} />

        {/* Stage 2 */}
        <div className={cn("flex-1 rounded-lg border p-3", uploadDone ? "border-primary/40 bg-primary/5" : "bg-muted/20")}>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <UploadCloud className="h-3.5 w-3.5" /> Upload
          </div>
          <DisabledAware enabled={uploadEnabled} tip="Send the template first (or wait until received)">
            <UploadCard
              variant="embedded"
              hideSample
              toastOnComplete={false}
              disabled={!uploadEnabled}
              sampleName={sampleName}
              fileName={step.uploadedFile?.name}
              uploadedAt={step.uploadedFile?.uploadedAt}
              recordCount={step.uploadedFile?.recordCount}
              onUpload={handleUpload}
              onReplaceRequest={willResetApproval(step) ? handleReplaceRequest : undefined}
            />
          </DisabledAware>
        </div>

        <StageConnector filled={uploadDone && (step.approvalStatus === "pending-approval" || approvalDone)} />

        {/* Stage 3 */}
        <div className={cn("flex-1 rounded-lg border p-3", approvalDone ? "border-success/40 bg-success/5" : "bg-muted/20")}>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Approval
          </div>
          <div className="space-y-2">
            <div className="text-sm capitalize">{step.approvalStatus.replace(/-/g, " ")}</div>
            {step.approvedBy && (
              <div className="text-xs text-muted-foreground">
                by {step.approvedBy}
                {step.approvedOn ? ` · ${new Date(step.approvedOn).toLocaleDateString()}` : ""}
              </div>
            )}
            {submitEnabled && (
              <DisabledAware enabled={uploadDone} tip="Upload a file first">
                <Button
                  size="sm"
                  disabled={!submitEnabled}
                  onClick={() => {
                    submitForApproval(projectId, step.id);
                    toast.success("Submitted for approval");
                  }}
                >
                  Submit for Approval
                </Button>
              </DisabledAware>
            )}
            {step.approvalStatus === "pending-approval" && canApprove && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="bg-success hover:bg-success/90" onClick={handleApprove}>
                  Approve
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setRejectOpen((v) => !v)}>
                  Reject
                </Button>
              </div>
            )}
            {step.approvalStatus === "pending-approval" && !canApprove && (
              <p className="rounded-md border border-dashed bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground">
                Waiting for Admin approval. Your role ({currentUser?.role ?? "Viewer"}) can submit, but only Admins can approve or reject.
              </p>
            )}
            {rejectOpen && canApprove && (
              <div className="space-y-2 rounded-md border p-2">
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Reason for rejection…"
                  className="min-h-[72px] w-full rounded-md border px-2 py-1.5 text-sm"
                />
                <Button size="sm" variant="destructive" onClick={handleReject}>
                  Confirm Reject
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={reuploadOpen}
        onOpenChange={(open) => {
          setReuploadOpen(open);
          if (!open) setPendingFileName(null);
        }}
        title="Re-upload and reset approval?"
        description={
          pendingFileName
            ? `${approvalResetHint} New file: ${pendingFileName}`
            : approvalResetHint
        }
        confirmLabel="Re-upload anyway"
        confirmTone="destructive"
        onConfirm={confirmReupload}
      />
    </div>
  );
}

function DisabledAware({
  enabled,
  tip,
  children,
}: {
  enabled: boolean;
  tip: string;
  children: React.ReactNode;
}) {
  if (enabled) return <>{children}</>;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block w-full">{children}</span>
        </TooltipTrigger>
        <TooltipContent>{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
