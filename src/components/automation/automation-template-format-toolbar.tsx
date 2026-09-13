import type { RefObject } from "react";
import { Bold, Italic } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AUTOMATION_FORMAT_HINT } from "@/lib/automation-message-format";
import { wrapAutomationTemplateMarker } from "@/lib/automation-message-format";

type Props = {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string, selection?: { start: number; end: number }) => void;
  /** Also format subject line when email subject field is focused */
  subjectMode?: boolean;
  subjectValue?: string;
  onSubjectChange?: (value: string, selection?: { start: number; end: number }) => void;
  activeField?: "subject" | "body";
};

export function AutomationTemplateFormatToolbar({
  textareaRef,
  value,
  onChange,
  subjectMode,
  subjectValue = "",
  onSubjectChange,
  activeField = "body",
}: Props) {
  function applyMarker(marker: "*" | "_") {
    const useSubject = subjectMode && activeField === "subject" && onSubjectChange;
    const el = useSubject
      ? (document.getElementById("automation-template-subject") as HTMLTextAreaElement | HTMLInputElement | null)
      : textareaRef.current;
    const text = useSubject ? subjectValue : value;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const result = wrapAutomationTemplateMarker(text, start, end, marker);
    if (useSubject) {
      onSubjectChange(result.value, {
        start: result.selectionStart,
        end: result.selectionEnd,
      });
    } else {
      onChange(result.value, { start: result.selectionStart, end: result.selectionEnd });
    }
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-0.5 rounded-md border border-border/80 p-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Bold (*text*)"
          onClick={() => applyMarker("*")}
        >
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Italic (_text_)"
          onClick={() => applyMarker("_")}
        >
          <Italic className="h-3.5 w-3.5" />
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">{AUTOMATION_FORMAT_HINT}</p>
    </div>
  );
}
