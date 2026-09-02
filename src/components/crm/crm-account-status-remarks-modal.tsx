import { useEffect, useState } from "react";

import { EntityFormModal } from "@/components/entity-form-modal";
import { cn } from "@/lib/utils";
import { ticketTextareaClass } from "@/components/design-ticket/design-ticket-shared";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  remarksLabel?: string;
  remarksPlaceholder?: string;
  onConfirm: (remarks: string) => void;
};

export function CrmAccountStatusRemarksModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  remarksLabel = "Remarks",
  remarksPlaceholder = "Add context for this status change…",
  onConfirm,
}: Props) {
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (!open) setRemarks("");
  }, [open]);

  return (
    <EntityFormModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      submitLabel={confirmLabel}
      onSubmit={() => onConfirm(remarks.trim())}
    >
      {description ? (
        <p className="mb-3 text-sm text-muted-foreground">{description}</p>
      ) : null}
      <label className="block text-xs font-medium">
        {remarksLabel}
        <textarea
          rows={3}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder={remarksPlaceholder}
          className={cn(ticketTextareaClass, "mt-1 min-h-[72px] text-xs")}
        />
      </label>
    </EntityFormModal>
  );
}

export function CrmAccountStatusRemarksNote({
  status,
  remarks,
  className,
}: {
  status: string;
  remarks?: string;
  className?: string;
}) {
  if ((status !== "suspended" && status !== "inactive") || !remarks?.trim()) return null;
  return (
    <p className={cn("text-[10px] leading-snug text-muted-foreground", className)}>
      {remarks.trim()}
    </p>
  );
}
