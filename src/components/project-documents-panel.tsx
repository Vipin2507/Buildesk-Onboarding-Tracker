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
      <div className="border-b border-border px-3 py-2.5">
        <h3 className="text-xs font-semibold text-muted-foreground">Templates</h3>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Turn on Required for documents this customer needs — each becomes a step under Onboarding →
          Documents.
        </p>
      </div>

      <div className="space-y-1.5 p-2.5 md:hidden">
        {DOCUMENT_TEMPLATE_NAMES.map((doc, index) => {
          const required = requiredNames.has(doc.name);
          return (
            <div key={doc.name} className="flex items-center gap-2.5 rounded-lg border border-border px-2.5 py-2">
              <span className="text-[10px] text-muted-foreground">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{doc.name}</div>
                    <div className="text-[10px] text-muted-foreground">{doc.category}</div>
                  </div>
                </div>
              </div>
              <Switch
                size="sm"
                checked={required}
                onCheckedChange={(checked) => onToggle(doc.name, checked)}
                aria-label={`Mark ${doc.name} as required`}
              />
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[28rem] text-xs">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="w-10 px-3 py-2 font-medium">#</th>
              <th className="px-2 py-2 font-medium">Name</th>
              <th className="w-24 px-2 py-2 font-medium">Required</th>
            </tr>
          </thead>
          <tbody>
            {DOCUMENT_TEMPLATE_NAMES.map((doc, index) => {
              const required = requiredNames.has(doc.name);
              return (
                <tr key={doc.name} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-muted-foreground">{index + 1}</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                      <div className="min-w-0">
                        <div className="font-medium">{doc.name}</div>
                        <div className="text-[10px] text-muted-foreground">{doc.category}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2">
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
