import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmLabel = "Delete",
  confirmTone = "destructive",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onConfirm: () => void;
  confirmLabel?: string;
  confirmTone?: "destructive" | "default";
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={
              confirmTone === "destructive"
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function EntityFormModal({
  open,
  onOpenChange,
  title,
  children,
  onSubmit,
  submitLabel = "Save",
  submitDisabled = false,
  contentClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  onSubmit: () => void;
  submitLabel?: string;
  submitDisabled?: boolean;
  /** Optional extra classes for dialog content (e.g. wider modals). */
  contentClassName?: string;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className={cn(
          "flex max-h-[90vh] flex-col overflow-hidden p-0 gap-0 max-w-lg sm:max-w-xl",
          contentClassName,
        )}
      >
        <AlertDialogHeader className="shrink-0 border-b border-border/80 px-6 py-4">
          <AlertDialogTitle className="text-base font-semibold text-foreground">{title}</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        <AlertDialogFooter className="shrink-0 border-t border-border/80 bg-muted/20 px-6 py-3">
          <AlertDialogCancel type="button" disabled={submitDisabled}>
            Cancel
          </AlertDialogCancel>
          <Button type="button" onClick={onSubmit} disabled={submitDisabled}>
            {submitLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
