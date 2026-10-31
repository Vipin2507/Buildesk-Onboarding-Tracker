import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  MessageSquarePlus,
  MoreHorizontal,
  PauseCircle,
  Pencil,
  PowerOff,
  Rocket,
  ShieldOff,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/entity-form-modal";
import {
  CrmAccountStatusRemarksModal,
} from "@/components/crm/crm-account-status-remarks-modal";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { crmGoLiveReady } from "@/data/crm-onboarding-defaults";
import { isCrmAccountEnded } from "@/lib/crm-account-status";
import { cn } from "@/lib/utils";
import { useCrmAccountStore, useCrmOnboardingStore } from "@/stores";
import type { CrmAccount } from "@/types/crm-account";

type Props = {
  companyId: string;
  accountName: string;
  accountStatus: CrmAccount["status"];
  who?: string;
  onOpenGoLiveTab?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onCreateQuery?: () => void;
  variant?: "button" | "icon";
  className?: string;
};

export function CrmAccountGoLiveActions({
  companyId,
  accountName,
  accountStatus,
  who,
  onOpenGoLiveTab,
  onEdit,
  onDelete,
  onCreateQuery,
  variant = "button",
  className,
}: Props) {
  const markLive = useCrmAccountStore((s) => s.markLive);
  const setAccountStatus = useCrmAccountStore((s) => s.setAccountStatus);
  const completeAllGoLiveItems = useCrmOnboardingStore((s) => s.completeAllGoLiveItems);
  const updateTracker = useCrmOnboardingStore((s) => s.updateTracker);
  const ensureForCompany = useCrmOnboardingStore((s) => s.ensureForCompany);
  const record = useCrmOnboardingStore((s) => s.getByCompanyId(companyId));

  const isLive = accountStatus === "live";
  const isSuspended = accountStatus === "suspended";
  const isSuspendAndClose = accountStatus === "suspend_and_close";
  const isInactive = accountStatus === "inactive";
  const isEnded = isCrmAccountEnded(accountStatus);
  const ready = crmGoLiveReady(record);

  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmForce, setConfirmForce] = useState(false);
  const [confirmSuspended, setConfirmSuspended] = useState(false);
  const [confirmSuspendAndClose, setConfirmSuspendAndClose] = useState(false);
  const [confirmInactive, setConfirmInactive] = useState(false);

  function approveGoLive() {
    ensureForCompany(companyId);
    const latest = useCrmOnboardingStore.getState().getByCompanyId(companyId);
    if (!crmGoLiveReady(latest)) {
      toast.error("Complete all go-live checklist items first");
      return;
    }
    markLive(companyId, who);
    updateTracker(companyId, { stage: "go_live" }, who);
    toast.success(`${accountName} marked Live`);
    setConfirmApprove(false);
  }

  function forceCompleteAccount() {
    ensureForCompany(companyId);
    completeAllGoLiveItems(companyId);
    markLive(companyId, who);
    updateTracker(companyId, { stage: "post_go_live_handover", priority: "medium" }, who);
    toast.success(`${accountName} completed & marked Live`);
    setConfirmForce(false);
    onOpenGoLiveTab?.();
  }

  function markSuspended(remarks: string) {
    setAccountStatus(companyId, "suspended", { who, statusRemarks: remarks });
    toast.success(`${accountName} marked Suspend`);
    setConfirmSuspended(false);
  }

  function markSuspendAndClose(remarks: string) {
    setAccountStatus(companyId, "suspend_and_close", { who, statusRemarks: remarks });
    toast.success(`${accountName} marked Suspend and Close`);
    setConfirmSuspendAndClose(false);
  }

  function markInactive(remarks: string) {
    setAccountStatus(companyId, "inactive", { who, statusRemarks: remarks });
    toast.success(`${accountName} marked Inactive`);
    setConfirmInactive(false);
  }

  function completeChecklist() {
    completeAllGoLiveItems(companyId);
    toast.success("All go-live items marked complete");
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {variant === "icon" ? (
            <Button
              size="icon"
              variant="ghost"
              className={cn("h-8 w-8", className)}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className={cn("h-8 gap-1 text-xs", className)}
            >
              Actions
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="max-h-[min(70vh,28rem)] w-60 overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Account status
          </DropdownMenuLabel>
          <DropdownMenuItem
            disabled={isSuspended || isSuspendAndClose || isInactive || accountStatus === "closed"}
            onClick={() => setConfirmSuspended(true)}
          >
            <PauseCircle className="mr-2 h-4 w-4 text-warning-foreground" />
            {isSuspended ? "Already Suspend" : "Suspend"}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isSuspendAndClose || isInactive || accountStatus === "closed"}
            onClick={() => setConfirmSuspendAndClose(true)}
          >
            <ShieldOff className="mr-2 h-4 w-4 text-destructive" />
            {isSuspendAndClose ? "Already Suspend and Close" : "Suspend and Close (Lost)"}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isInactive || isSuspendAndClose || accountStatus === "closed"}
            onClick={() => setConfirmInactive(true)}
          >
            <PowerOff className="mr-2 h-4 w-4 text-destructive" />
            {isInactive ? "Already Inactive" : "Mark Inactive"}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Go-Live
          </DropdownMenuLabel>
          {onOpenGoLiveTab ? (
            <DropdownMenuItem onClick={onOpenGoLiveTab}>
              <ClipboardList className="mr-2 h-4 w-4" />
              Open Go-Live checklist
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            disabled={isLive || ready || isEnded}
            onClick={completeChecklist}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Complete checklist
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isLive || !ready || isEnded}
            onClick={() => setConfirmApprove(true)}
          >
            <Rocket className="mr-2 h-4 w-4" />
            {isLive ? "Already Live" : "Approve Go-Live"}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isLive || isEnded}
            onClick={() => setConfirmForce(true)}
          >
            <Rocket className="mr-2 h-4 w-4 text-success" />
            Go Live & Complete
          </DropdownMenuItem>

          {onCreateQuery || onEdit || onDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Account
              </DropdownMenuLabel>
              {onCreateQuery ? (
                <DropdownMenuItem onClick={onCreateQuery}>
                  <MessageSquarePlus className="mr-2 h-4 w-4" />
                  Create query
                </DropdownMenuItem>
              ) : null}
              {onEdit ? (
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit account
                </DropdownMenuItem>
              ) : null}
              {onDelete ? (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete account
                </DropdownMenuItem>
              ) : null}
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDeleteDialog
        open={confirmApprove}
        onOpenChange={setConfirmApprove}
        title="Approve go-live?"
        description={`${accountName} will be marked Live. Checklist is complete.`}
        confirmLabel="Mark Live"
        confirmTone="default"
        onConfirm={approveGoLive}
      />

      <ConfirmDeleteDialog
        open={confirmForce}
        onOpenChange={setConfirmForce}
        title="Go Live & Complete account?"
        description={`This will complete remaining go-live checklist items and mark ${accountName} as Live immediately.`}
        confirmLabel="Go Live & Complete"
        confirmTone="default"
        onConfirm={forceCompleteAccount}
      />

      <CrmAccountStatusRemarksModal
        open={confirmSuspended}
        onOpenChange={setConfirmSuspended}
        title="Mark account Suspend?"
        description={`${accountName} will be marked Suspend (on hold). This does not classify the account as lost.`}
        confirmLabel="Mark Suspend"
        remarksPlaceholder="Why is this account being suspended?"
        onConfirm={markSuspended}
      />

      <CrmAccountStatusRemarksModal
        open={confirmSuspendAndClose}
        onOpenChange={setConfirmSuspendAndClose}
        title="Mark Suspend and Close?"
        description={`${accountName} will be suspended and closed. First-time accounts record remaining value as Sales Lost; renewal accounts as Customer Lost.`}
        confirmLabel="Mark Suspend and Close"
        remarksPlaceholder="Why is this account being suspended and closed?"
        onConfirm={markSuspendAndClose}
      />

      <CrmAccountStatusRemarksModal
        open={confirmInactive}
        onOpenChange={setConfirmInactive}
        title="Mark account inactive?"
        description={`${accountName} will be marked Inactive. Use when the account should no longer be treated as active onboarding.`}
        confirmLabel="Mark Inactive"
        remarksPlaceholder="Why is this account being marked inactive?"
        onConfirm={markInactive}
      />
    </>
  );
}
