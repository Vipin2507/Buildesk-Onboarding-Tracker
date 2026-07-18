import { useEffect, useMemo, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Building2, FolderKanban, Layers, MapPin, Ruler } from "lucide-react";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { DatePickerField } from "@/components/date-picker-field";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  PROJECT_OTHER_CHARGE_OPTIONS,
  PROJECT_TYPES,
  STATUS_LABEL,
  type Project,
  type ProjectOtherChargeKey,
  type StatusKey,
} from "@/types";

const STATUS_KEYS = Object.keys(STATUS_LABEL) as StatusKey[];

export const projectFormSchema = z.object({
  name: z.string().min(2, "Project name is required"),
  companyId: z.string().min(1, "Select a company"),
  type: z.string().min(2, "Project type is required"),
  startDate: z.string().min(1, "Start date is required"),
  city: z.string().optional(),
  rera: z.string().optional(),
  pocName: z.string().optional(),
  pocMobile: z.string().optional(),
  address: z.string().optional(),
  state: z.string().optional(),
  pinCode: z.string().optional(),
  totalTowers: z.coerce.number().min(0).optional(),
  totalFloors: z.coerce.number().min(0).optional(),
  units: z.coerce.number().min(0).optional(),
  agreementValue: z.coerce.number().min(0).optional(),
  otherCharges: z.array(z.string()).optional(),
  customCharges: z.array(z.string()).optional(),
  logoUrl: z.string().optional(),
});

export const projectAdminFormSchema = projectFormSchema
  .extend({
    status: z.enum(["not_started", "in_progress", "review", "completed", "on_hold"]),
    currentStep: z.coerce.number().min(0).max(20),
    goLiveAt: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.pinCode && data.pinCode.length > 0 && !/^\d{6}$/.test(data.pinCode)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid 6-digit PIN", path: ["pinCode"] });
    }
  });

export type ProjectFormValues = z.infer<typeof projectFormSchema>;
export type ProjectAdminFormValues = z.infer<typeof projectAdminFormSchema>;

const field =
  "mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-primary/25";

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Building2;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl border border-border/80 bg-muted/20 p-4"
    >
      <div className="mb-3 flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {description ? <p className="text-[11px] text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {children}
    </motion.section>
  );
}

export function ProjectFormModal({
  open,
  onOpenChange,
  companies,
  editing,
  defaultCompanyId,
  onSave,
  adminMode = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: { id: string; name: string; city?: string }[];
  editing: Project | null;
  defaultCompanyId?: string;
  onSave: (data: ProjectAdminFormValues) => void;
  /** Master Data Control — edit status, step, go-live. */
  adminMode?: boolean;
}) {
  const form = useForm<ProjectAdminFormValues>({
    resolver: (adminMode
      ? zodResolver(projectAdminFormSchema)
      : zodResolver(projectFormSchema)) as Resolver<ProjectAdminFormValues>,
    defaultValues: emptyDefaults(companies, defaultCompanyId),
  });

  const showFullDetails = Boolean(editing) || adminMode;
  const otherCharges = form.watch("otherCharges") ?? [];
  const startDate = form.watch("startDate") ?? "";
  const editingId = editing?.id ?? "";
  const companyOptionsKey = useMemo(
    () => companies.map((c) => `${c.id}:${c.name}:${c.city ?? ""}`).join("|"),
    [companies],
  );

  // Reset when the dialog opens or edited project / company options change —
  // not on every new companies[] array reference (avoids update-depth loops).
  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        name: editing.name,
        companyId: editing.companyId,
        address: editing.address ?? "",
        state: editing.state ?? "",
        city: editing.city || "",
        pinCode: editing.pinCode ?? "",
        type: editing.type,
        totalTowers: editing.totalTowers ?? 0,
        totalFloors: editing.totalFloors ?? 0,
        units: editing.units,
        agreementValue: editing.agreementValue ?? 0,
        rera: editing.rera ?? "",
        startDate: editing.startDate ?? new Date().toISOString().slice(0, 10),
        pocName: editing.pocName ?? "",
        pocMobile: editing.pocMobile ?? "",
        otherCharges: editing.otherCharges ?? [],
        customCharges: editing.customCharges ?? [],
        logoUrl: editing.logoUrl ?? "",
        status: editing.status,
        currentStep: editing.currentStep,
        goLiveAt: editing.goLiveAt ? editing.goLiveAt.slice(0, 16) : "",
      });
    } else {
      form.reset(emptyDefaults(companies, defaultCompanyId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by open / editingId / companyOptionsKey
  }, [open, editingId, companyOptionsKey, defaultCompanyId, form]);

  function submit() {
    void form.handleSubmit(
      (data) => {
        onSave(data);
        onOpenChange(false);
      },
      (errors) => {
        const first = Object.values(errors)[0];
        toast.error(first?.message?.toString() ?? "Please fix the highlighted fields");
      },
    )();
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-h-[92vh] max-w-lg gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <AlertDialogHeader className="border-b border-border bg-gradient-to-br from-primary/10 via-background to-background px-6 py-5 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <AlertDialogTitle className="text-lg">
                {editing ? "Edit Project Details" : "Create Project"}
              </AlertDialogTitle>
              <p className="text-xs text-muted-foreground">
                {editing
                  ? "Update location, scale, POC, and commercial details"
                  : "Add basics now — edit later for full location & scale"}
              </p>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="max-h-[min(70vh,560px)] space-y-4 overflow-y-auto px-6 py-5">
          <Section icon={Building2} title="Project Details">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Project Name</label>
                <input {...form.register("name")} className={field} placeholder="e.g. Horizon Towers" />
                {form.formState.errors.name && (
                  <p className="mt-1 text-[11px] text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Company</label>
                <select
                  {...form.register("companyId")}
                  className={field}
                  disabled={Boolean(defaultCompanyId) && !editing}
                >
                  {companies.length === 0 ? (
                    <option value="">No companies — add a company first</option>
                  ) : (
                    companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))
                  )}
                </select>
                {form.formState.errors.companyId && (
                  <p className="mt-1 text-[11px] text-destructive">{form.formState.errors.companyId.message}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Project Type</label>
                <select {...form.register("type")} className={field}>
                  {PROJECT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Start Date</label>
                <div className="mt-1.5">
                  <DatePickerField
                    value={startDate}
                    onChange={(v) => form.setValue("startDate", v, { shouldDirty: true, shouldValidate: true })}
                    placeholder="Pick start date"
                    yearsBack={40}
                    yearsForward={5}
                    modal
                  />
                </div>
                {form.formState.errors.startDate && (
                  <p className="mt-1 text-[11px] text-destructive">{form.formState.errors.startDate.message}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">RERA (optional)</label>
                <input {...form.register("rera")} className={field} placeholder="RERA number" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">City (optional)</label>
                <input {...form.register("city")} className={field} placeholder="City" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Project POC Name</label>
                <input {...form.register("pocName")} className={field} placeholder="On-site contact" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Project POC Mobile</label>
                <input {...form.register("pocMobile")} className={field} placeholder="Mobile number" />
              </div>
            </div>
          </Section>

          {showFullDetails && (
            <>
              <Section
                icon={MapPin}
                title="Location"
                description="Site address used on documents and onboarding."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Address</label>
                    <input {...form.register("address")} className={field} placeholder="Project site address" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">State</label>
                    <input {...form.register("state")} className={field} placeholder="State" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">PIN code</label>
                    <input {...form.register("pinCode")} className={field} placeholder="6-digit PIN" />
                    {form.formState.errors.pinCode && (
                      <p className="mt-1 text-[11px] text-destructive">{form.formState.errors.pinCode.message}</p>
                    )}
                  </div>
                </div>
              </Section>

              <Section
                icon={Ruler}
                title="Scale & commercial"
                description="Inventory size and agreement value."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Total towers</label>
                    <input type="number" min={0} {...form.register("totalTowers")} className={field} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Total floors</label>
                    <input type="number" min={0} {...form.register("totalFloors")} className={field} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Units</label>
                    <input type="number" min={0} {...form.register("units")} className={field} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Agreement value</label>
                    <input type="number" min={0} {...form.register("agreementValue")} className={field} />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">Other charges applicable</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {PROJECT_OTHER_CHARGE_OPTIONS.map((opt) => {
                      const checked = otherCharges.includes(opt.key);
                      return (
                        <label key={opt.key} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...otherCharges, opt.key]
                                : otherCharges.filter((k) => k !== opt.key);
                              form.setValue("otherCharges", next, { shouldDirty: true });
                            }}
                          />
                          {opt.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </Section>
            </>
          )}

          {!showFullDetails && (
            <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              After save, open <span className="font-medium text-foreground">Edit Project Details</span> from the
              Project tab to add address, towers, floors, units, and charges.
            </p>
          )}

          {adminMode && (
            <Section icon={Layers} title="Admin status">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <select {...form.register("status")} className={field}>
                    {STATUS_KEYS.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Current step</label>
                  <input type="number" min={0} max={20} {...form.register("currentStep")} className={field} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Go-live at (optional)</label>
                  <input type="datetime-local" {...form.register("goLiveAt")} className={field} />
                  <button
                    type="button"
                    className="mt-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() => form.setValue("goLiveAt", "", { shouldDirty: true })}
                  >
                    Clear go-live
                  </button>
                </div>
              </div>
            </Section>
          )}
        </div>

        <AlertDialogFooter className="border-t border-border bg-muted/30 px-6 py-4">
          <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
          <Button type="button" onClick={submit} className="bg-primary hover:bg-primary/90">
            {editing ? "Save changes" : "Save project"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function emptyDefaults(
  companies: { id: string; name: string; city?: string }[],
  defaultCompanyId?: string,
): ProjectAdminFormValues {
  const company = companies.find((c) => c.id === defaultCompanyId) ?? companies[0];
  return {
    name: "",
    companyId: company?.id ?? "",
    address: "",
    state: "",
    city: company?.city ?? "",
    pinCode: "",
    type: "Residential",
    totalTowers: 0,
    totalFloors: 0,
    units: 0,
    agreementValue: 0,
    rera: "",
    startDate: new Date().toISOString().slice(0, 10),
    pocName: "",
    pocMobile: "",
    otherCharges: [],
    customCharges: [],
    logoUrl: "",
    status: "not_started",
    currentStep: 0,
    goLiveAt: "",
  };
}

export function formValuesToProjectPatch(data: ProjectFormValues | ProjectAdminFormValues): Omit<
  Project,
  "id" | "createdAt" | "updatedAt" | "status" | "currentStep" | "goLiveAt"
> {
  const companyCity = (data.city ?? "").trim();
  return {
    name: data.name.trim(),
    companyId: data.companyId,
    type: data.type,
    units: data.units ?? 0,
    city: companyCity,
    rera: data.rera?.trim() ?? "",
    address: (data.address ?? "").trim() || undefined,
    state: data.state || undefined,
    pinCode: data.pinCode || undefined,
    totalTowers: data.totalTowers ?? 0,
    totalFloors: data.totalFloors ?? 0,
    agreementValue: data.agreementValue ?? 0,
    otherCharges: (data.otherCharges ?? []) as ProjectOtherChargeKey[],
    customCharges: data.customCharges ?? [],
    logoUrl: data.logoUrl || undefined,
    startDate: data.startDate,
    pocName: data.pocName?.trim() || undefined,
    pocMobile: data.pocMobile?.trim() || undefined,
  };
}

export function formValuesToProjectAdminPatch(
  data: ProjectAdminFormValues,
): Omit<Project, "id" | "createdAt" | "updatedAt"> {
  const goLiveRaw = data.goLiveAt?.trim();
  return {
    ...formValuesToProjectPatch(data),
    status: data.status,
    currentStep: data.currentStep,
    goLiveAt: goLiveRaw ? new Date(goLiveRaw).toISOString() : undefined,
  };
}
