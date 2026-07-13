import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { createCompanyModules } from "@/data/module-catalog";
import {
  buildProjectImportPlan,
  companyEmailFromName,
  downloadProjectImportSample,
  normalizeEntityName,
  parseProjectImportFile,
  type ProjectImportPlan,
} from "@/lib/project-sheet-import";
import { cn, formatDate } from "@/lib/utils";
import { useCompanyStore, useProjectStore } from "@/stores";
import type { Company, Project } from "@/types";

export function ProjectImportModal({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (companyIds: string[]) => void;
}) {
  const companies = useCompanyStore((s) => s.companies);
  const addCompany = useCompanyStore((s) => s.addCompany);
  const updateCompany = useCompanyStore((s) => s.updateCompany);
  const projects = useProjectStore((s) => s.projects);
  const addProject = useProjectStore((s) => s.addProject);
  const updateProject = useProjectStore((s) => s.updateProject);

  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [plan, setPlan] = useState<ProjectImportPlan | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setFileName(null);
    setPlan(null);
    setParseError(null);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setParseError(null);
    setPlan(null);
    setFileName(file.name);
    try {
      const raw = await parseProjectImportFile(file);
      const next = buildProjectImportPlan(raw, companies, projects);
      setPlan(next);
      if (next.summary.errors > 0 && next.summary.ready === 0) {
        toast.error("Import sheet has errors — fix rows and try again");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to read file";
      setParseError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  function applyImport() {
    if (!plan || plan.summary.ready === 0) return;
    setBusy(true);

    // Do not auto-assign people on import — leave manager/CSM empty for manual assignment.
    const today = new Date().toISOString().slice(0, 10);
    const goLive = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    const expiry = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);

    const companyIdByName = new Map(
      useCompanyStore.getState().companies.map((c) => [normalizeEntityName(c.name), c.id] as const),
    );
    const touchedCompanyIds = new Set<string>();

    let createdCompanies = 0;
    let updatedCompanies = 0;
    let createdProjects = 0;
    let updatedProjects = 0;

    try {
      for (const row of plan.rows) {
        if (row.status !== "ready") continue;

        for (const action of row.actions) {
          if (action.kind === "create_company") {
            const key = normalizeEntityName(action.companyName);
            if (companyIdByName.has(key)) continue;
            const company = addCompany({
              name: action.companyName,
              contact: "To be assigned",
              designation: "Pending",
              phone: "—",
              email: companyEmailFromName(action.companyName),
              city: "—",
              onboardingManagerId: "",
              csmId: "",
              status: "not_started",
              modules: createCompanyModules(["post-sales", "customer-app"], action.startDate),
              agreementDate: action.startDate,
              startDate: action.startDate,
              goLiveTarget: goLive,
              planExpiry: expiry,
              plan: "Growth",
              health: "Healthy",
            } satisfies Omit<Company, "id" | "createdAt" | "updatedAt">);
            companyIdByName.set(key, company.id);
            touchedCompanyIds.add(company.id);
            createdCompanies += 1;
          }

          if (action.kind === "update_company") {
            updateCompany(action.companyId, {
              startDate: action.startDate,
            });
            touchedCompanyIds.add(action.companyId);
            updatedCompanies += 1;
          }

          if (action.kind === "create_project") {
            const companyId = companyIdByName.get(normalizeEntityName(action.companyName));
            if (!companyId) {
              toast.error(`Could not resolve company for ${action.projectName}`);
              continue;
            }
            const company = useCompanyStore.getState().getById(companyId);
            const existing = useProjectStore
              .getState()
              .getByCompany(companyId)
              .find((p) => normalizeEntityName(p.name) === normalizeEntityName(action.projectName));
            if (existing) {
              if (action.startDate && existing.startDate !== action.startDate) {
                updateProject(existing.id, { startDate: action.startDate });
                updatedProjects += 1;
              }
              touchedCompanyIds.add(companyId);
              continue;
            }
            addProject({
              name: action.projectName,
              companyId,
              type: "Residential",
              units: 0,
              city: company?.city && company.city !== "—" ? company.city : "—",
              rera: "",
              status: "not_started",
              currentStep: 0,
              startDate: action.startDate || today,
            } satisfies Omit<Project, "id" | "createdAt" | "updatedAt">);
            touchedCompanyIds.add(companyId);
            createdProjects += 1;
          }

          if (action.kind === "update_project") {
            updateProject(action.projectId, { startDate: action.startDate });
            const companyId = companyIdByName.get(normalizeEntityName(action.companyName));
            if (companyId) touchedCompanyIds.add(companyId);
            updatedProjects += 1;
          }
        }
      }

      toast.success("Import complete", {
        description: [
          createdCompanies ? `${createdCompanies} companies created` : null,
          updatedCompanies ? `${updatedCompanies} companies updated` : null,
          createdProjects ? `${createdProjects} projects created` : null,
          updatedProjects ? `${updatedProjects} projects updated` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "No changes",
      });
      onImported?.([...touchedCompanyIds]);
      handleOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  const canImport = !!plan && plan.summary.ready > 0 && !busy;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="flex max-h-[90vh] w-[min(96vw,720px)] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <AlertDialogHeader className="space-y-1 border-b px-6 py-4 text-left">
          <AlertDialogTitle>Import projects sheet</AlertDialogTitle>
          <AlertDialogDescription>
            Upload a CSV or Excel file with columns{" "}
            <span className="font-medium text-foreground">
              Project, ProjectCreatedAt, Company, CompanyCreatedAt
            </span>
            . ProjectCreatedAt → project start date; CompanyCreatedAt → company start date.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 overflow-y-auto px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={downloadProjectImportSample}>
              <Download className="h-3.5 w-3.5" /> Sample CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" /> Choose file
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {fileName && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                {fileName}
              </span>
            )}
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void onFile(e.dataTransfer.files?.[0]);
            }}
            className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground"
          >
            Drop your sheet here, or use Choose file. Accepts .csv, .xlsx, .xls
          </div>

          {parseError && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {parseError}
            </p>
          )}

          {plan && (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <Stat label="Ready" value={plan.summary.ready} tone="success" />
                <Stat label="Errors" value={plan.summary.errors} tone="danger" />
                <Stat label="Skipped" value={plan.summary.skips} />
                <Stat label="New companies" value={plan.summary.companiesToCreate} />
                <Stat label="New projects" value={plan.summary.projectsToCreate} />
              </div>

              <div className="max-h-[36vh] overflow-auto rounded-lg border">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="sticky top-0 bg-muted/90 backdrop-blur">
                    <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Project</th>
                      <th className="px-3 py-2 font-medium">Company</th>
                      <th className="px-3 py-2 font-medium">Dates</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.rows.map((r) => (
                      <tr key={r.rowNumber} className="border-b border-border/60 last:border-0">
                        <td className="px-3 py-2 text-muted-foreground">{r.rowNumber}</td>
                        <td className="px-3 py-2 font-medium">{r.projectName || "—"}</td>
                        <td className="px-3 py-2">{r.companyName || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          <div>P: {formatDate(r.projectStartDate)}</div>
                          <div>C: {formatDate(r.companyStartDate)}</div>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              "inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                              r.status === "ready" && "bg-success/15 text-success",
                              r.status === "error" && "bg-destructive/15 text-destructive",
                              r.status === "skip" && "bg-muted text-muted-foreground",
                            )}
                          >
                            {r.message}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <AlertDialogFooter className="border-t px-6 py-4">
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button type="button" disabled={!canImport} onClick={applyImport}>
            {busy ? "Working…" : `Import ${plan?.summary.ready ?? 0} row${plan?.summary.ready === 1 ? "" : "s"}`}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "danger";
}) {
  return (
    <span
      className={cn(
        "rounded-md border px-2 py-1",
        tone === "success" && "border-success/30 bg-success/10",
        tone === "danger" && "border-destructive/30 bg-destructive/10",
      )}
    >
      <span className="font-semibold">{value}</span> {label}
    </span>
  );
}
