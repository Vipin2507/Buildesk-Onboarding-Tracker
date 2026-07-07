import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PageWrap } from "@/components/page-header";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDocumentStore } from "@/stores";

export const Route = createFileRoute("/documents")({
  component: Documents,
});

function Documents() {
  const templates = useDocumentStore((s) => s.templates);
  const advanceStatus = useDocumentStore((s) => s.advanceStatus);
  const uploadTemplate = useDocumentStore((s) => s.uploadTemplate);
  const deleteTemplate = useDocumentStore((s) => s.deleteTemplate);
  const addTemplate = useDocumentStore((s) => s.addTemplate);

  return (
    <PageWrap>
      <PageHeader title="Document Templates" subtitle="Manage every letter and format shared with customers."
        actions={<Button className="bg-primary" onClick={() => { addTemplate({ name: "New Template", category: "General", status: "Draft" }); toast.success("Template added"); }}>+ Add Template</Button>}
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((t) => (
          <div key={t.id} className="card-soft flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.category}{t.fileName && ` · ${t.fileName}`}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { advanceStatus(t.id); toast.success("Status advanced"); }}>
                <Pill tone={t.status === "Live" ? "success" : "info"}>{t.status}</Pill>
              </button>
              <Button size="sm" variant="ghost" onClick={() => uploadTemplate(t.id, `${t.name.toLowerCase()}.docx`)}><Upload className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" onClick={() => { deleteTemplate(t.id); toast.success("Deleted"); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>
    </PageWrap>
  );
}
