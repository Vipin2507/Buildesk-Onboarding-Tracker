import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  MoreHorizontal,
  PauseCircle,
  Pencil,
  PowerOff,
  Rocket,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/entity-form-modal";
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
  variant = "button",
  className,
}: Props) {
  const markLive = useCrmAccountStore((s) => s.markLive);
  const setAccountStatus = useCrmAccountStore((s) => s.setAccountStatus);
  const completeAllGoLiveItems = useCrmOnboardingStore((s) => s.completeAllGoLiveItems);
  const updateTracker = useCrmOnboardingStore((s) => s.updateTracker);
  const getRecord = useCrmOnboardingStore((s) => s.getByCompanyId);

  const isLive = accountStatus === "live";
  const isSuspended = accountStatus === "suspended";
  const isInactive = accountStatus === "inactive";
  const isEnded = isCrmAccountEnded(accountStatus);
  const ready = crmGoLiveReady(getRecord(companyId)!);

  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmForce, setConfirmForce] = useState(false);
  const [confirmSuspended, setConfirmSuspended] = useState(false);
  const [confirmInactive, setConfirmInactive] = useState(false);

  function approveGoLive() {
    if (!crmGoLiveReady(getRecord(companyId)!)) {
      toast.error("Complete all go-live checklist items first");
      return;
    }
    markLive(companyId, who);
    updateTracker(companyId, { stage: "go_live" }, who);
    toast.success(`${accountName} marked Live`);
    setConfirmApprove(false);
  }

  function forceCompleteAccount() {
    completeAllGoLiveItems(companyId);
    markLive(companyId, who);
    updateTracker(companyId, { stage: "customer_success", priority: "medium" }, who);
    toast.success(`${accountName} completed & marked Live`);
    setConfirmForce(false);
    onOpenGoLiveTab?.();
  }

  function markSuspended() {
    setAccountStatus(companyId, "suspended", who);
    toast.success(`${accountName} marked Suspended`);
    setConfirmSuspended(false);
  }

  function markInactive() {
    setAccountStatus(companyId, "inactive", who);
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
        <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
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

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Account status
          </DropdownMenuLabel>
          <DropdownMenuItem
            disabled={isSuspended || isInactive || isLive}
            onClick={() => setConfirmSuspended(true)}
          >
            <PauseCircle className="mr-2 h-4 w-4 text-warning-foreground" />
            {isSuspended ? "Already Suspended" : "Mark Suspended"}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isInactive}
            onClick={() => setConfirmInactive(true)}
          >
            <PowerOff className="mr-2 h-4 w-4 text-destructive" />
            {isInactive ? "Already Inactive" : "Mark Inactive"}
          </DropdownMenuItem>

          {onEdit || onDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Account
              </DropdownMenuLabel>
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

      <ConfirmDeleteDialog
        open={confirmSuspended}
        onOpenChange={setConfirmSuspended}
        title="Mark account suspended?"
        description={`${accountName} will be marked Suspended. Use when the client is temporarily paused but may resume onboarding later.`}
        confirmLabel="Mark Suspended"
        confirmTone="default"
        onConfirm={markSuspended}
      />

      <ConfirmDeleteDialog
        open={confirmInactive}
        onOpenChange={setConfirmInactive}
        title="Mark account inactive?"
        description={`${accountName} will be marked Inactive. Use when the account should no longer be treated as active onboarding.`}
        confirmLabel="Mark Inactive"
        confirmTone="destructive"
        onConfirm={markInactive}
      />
    </>
  );
}
