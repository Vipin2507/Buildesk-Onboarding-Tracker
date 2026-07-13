import { FileText } from "lucide-react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { DOCUMENT_TEMPLATE_NAMES } from "@/data/constants";
import { useOnboardingStore } from "@/stores";

type Props = {
  projectId: string;
};

export function ProjectDocumentsPanel({ projectId }: Props) {
  const checklistItems = useOnboardingStore((s) => s.checklistItems);
  const setDocumentRequired = useOnboardingStore((s) => s.setDocumentRequired);

  const requiredNames = new Set(
    checklistItems
      .filter((i) => i.projectId === projectId && i.source === "required-document")
      .map((i) => i.label),
  );

  function onToggle(name: string, required: boolean) {
    setDocumentRequired(projectId, name, required);
    toast.success(
      required
        ? `"${name}" added to Documents process steps`
        : `"${name}" removed from Documents process steps`,
    );
  }

  return (
    <div className="card-soft overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h3 className="font-semibold">Templates</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Turn on Required for documents this customer needs — each one becomes a step under
          Onboarding → Documents & Formats.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="w-12 px-5 py-3 font-medium">#</th>
              <th className="px-3 py-3 font-medium">Name</th>
              <th className="w-28 px-3 py-3 font-medium">Required</th>
            </tr>
          </thead>
          <tbody>
            {DOCUMENT_TEMPLATE_NAMES.map((doc, index) => {
              const required = requiredNames.has(doc.name);
              return (
                <tr key={doc.name} className="border-b border-border last:border-0">
                  <td className="px-5 py-3.5 text-muted-foreground">{index + 1}</td>
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <FileText className="h-4 w-4 shrink-0 text-primary/70" />
                      <div className="min-w-0">
                        <div className="font-medium">{doc.name}</div>
                        <div className="text-xs text-muted-foreground">{doc.category}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <Switch
                      size="sm"
                      checked={required}
                      onCheckedChange={(checked) => onToggle(doc.name, checked)}
                      aria-label={`Mark ${doc.name} as required`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
