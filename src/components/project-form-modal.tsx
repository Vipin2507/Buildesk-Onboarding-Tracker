import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  MapPin,
  Layers,
  IndianRupee,
  ImagePlus,
  Plus,
  X,
  Check,
  FolderKanban,
} from "lucide-react";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { compressImageToDataUrl } from "@/lib/compress-image";
import {
  PROJECT_OTHER_CHARGE_OPTIONS,
  PROJECT_TYPES,
  STATUS_LABEL,
  type Project,
  type ProjectOtherChargeKey,
  type StatusKey,
} from "@/types";

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal", "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry", "Chandigarh",
];

const STATUS_KEYS = Object.keys(STATUS_LABEL) as StatusKey[];

export const projectFormSchema = z.object({
  name: z.string().min(2, "Project name is required"),
  companyId: z.string().min(1, "Select a company"),
  address: z.string().min(3, "Address is required"),
  state: z.string().min(2, "State is required"),
  city: z.string().min(2, "City is required"),
  pinCode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit PIN"),
  type: z.string().min(2, "Project type is required"),
  totalTowers: z.coerce.number().min(0),
  totalFloors: z.coerce.number().min(0),
  units: z.coerce.number().min(1, "Total units required"),
  agreementValue: z.coerce.number().min(0),
  rera: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  pocName: z.string().optional(),
  pocMobile: z.string().optional(),
  otherCharges: z.array(z.string()),
  customCharges: z.array(z.string()),
  logoUrl: z.string().optional(),
});

export const projectAdminFormSchema = projectFormSchema
  .extend({
    address: z.string().optional(),
    state: z.string().optional(),
    pinCode: z.string().optional(),
    units: z.coerce.number().min(0),
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
  children,
  delay = 0,
}: {
  icon: typeof Building2;
  title: string;
  children: ReactNode;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl border border-border/80 bg-muted/20 p-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
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
  /** Master Data Control — edit status, step, go-live and relax required address fields. */
  adminMode?: boolean;
}) {
  const [customDraft, setCustomDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProjectAdminFormValues>({
    resolver: (adminMode
      ? zodResolver(projectAdminFormSchema)
      : zodResolver(projectFormSchema)) as Resolver<ProjectAdminFormValues>,
    defaultValues: emptyDefaults(companies, defaultCompanyId, adminMode),
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        name: editing.name,
        companyId: editing.companyId,
        address: editing.address ?? (adminMode ? "" : ""),
        state: editing.state ?? "",
        city: editing.city || (adminMode ? "—" : ""),
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
      form.reset(emptyDefaults(companies, defaultCompanyId, adminMode));
    }
    setCustomDraft("");
  }, [open, editing, companies, defaultCompanyId, form, adminMode]);

  const otherCharges = form.watch("otherCharges") ?? [];
  const customCharges = form.watch("customCharges") ?? [];
  const logoUrl = form.watch("logoUrl");

  function toggleCharge(key: string) {
    const next = otherCharges.includes(key)
      ? otherCharges.filter((k) => k !== key)
      : [...otherCharges, key];
    form.setValue("otherCharges", next, { shouldDirty: true });
  }

  function addCustomCharge() {
    const label = customDraft.trim();
    if (!label) return;
    if (customCharges.includes(label)) {
      toast.error("Charge already added");
      return;
    }
    form.setValue("customCharges", [...customCharges, label], { shouldDirty: true });
    setCustomDraft("");
  }

  async function onLogoChange(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Logo must be under 8MB");
      return;
    }
    try {
      const dataUrl = await compressImageToDataUrl(file, { maxEdge: 400, quality: 0.8 });
      form.setValue("logoUrl", dataUrl, { shouldDirty: true });
    } catch {
      toast.error("Could not process image");
    }
  }

  function submit() {
    void form.handleSubmit(
      (data) => {
        onSave(data);
        onOpenChange(false);
      },
      () => toast.error("Please fix the highlighted fields"),
    )();
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-h-[92vh] max-w-2xl gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <AlertDialogHeader className="border-b border-border bg-gradient-to-br from-primary/10 via-background to-background px-6 py-5 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <AlertDialogTitle className="text-lg">
                {editing ? "Edit Project" : "Create Project"}
              </AlertDialogTitle>
              <p className="text-xs text-muted-foreground">
                Project information, location, scale & charges
              </p>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="max-h-[min(70vh,640px)] space-y-4 overflow-y-auto px-6 py-5">
          <Section icon={Building2} title="Basics" delay={0.02}>
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
                <select {...form.register("companyId")} className={field}>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
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
                <label className="text-xs font-medium text-muted-foreground">RERA (optional)</label>
                <input {...form.register("rera")} className={field} placeholder="RERA number" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Start Date</label>
                <input type="date" {...form.register("startDate")} className={field} />
                {form.formState.errors.startDate && (
                  <p className="mt-1 text-[11px] text-destructive">{form.formState.errors.startDate.message}</p>
                )}
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

          {adminMode && (
            <Section icon={Layers} title="Admin status" delay={0.04}>
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

          <Section icon={MapPin} title="Location" delay={0.06}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Project Address</label>
                <textarea
                  {...form.register("address")}
                  rows={2}
                  className={cn(field, "h-auto py-2")}
                  placeholder="Street, landmark, area"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">State</label>
                <select {...form.register("state")} className={field}>
                  <option value="">Select state</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">City</label>
                <input {...form.register("city")} className={field} placeholder="City" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">PIN Code</label>
                <input {...form.register("pinCode")} className={field} placeholder="560001" maxLength={6} />
                {form.formState.errors.pinCode && (
                  <p className="mt-1 text-[11px] text-destructive">{form.formState.errors.pinCode.message}</p>
                )}
              </div>
            </div>
          </Section>

          <Section icon={Layers} title="Scale" delay={0.1}>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Total Towers</label>
                <input type="number" min={0} {...form.register("totalTowers")} className={field} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Total Floors</label>
                <input type="number" min={0} {...form.register("totalFloors")} className={field} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Total Units</label>
                <input type="number" min={1} {...form.register("units")} className={field} />
              </div>
            </div>
          </Section>

          <Section icon={IndianRupee} title="Commercial" delay={0.14}>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Agreement Value (₹)</label>
              <input type="number" min={0} step={1000} {...form.register("agreementValue")} className={field} />
            </div>
            <div className="mt-4">
              <div className="mb-2 text-xs font-medium text-muted-foreground">Other Charges</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PROJECT_OTHER_CHARGE_OPTIONS.map((opt) => {
                  const checked = otherCharges.includes(opt.key);
                  return (
                    <motion.button
                      key={opt.key}
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => toggleCharge(opt.key)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs font-medium transition-colors",
                        checked
                          ? "border-primary/40 bg-primary/10 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:bg-muted/40",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                          checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                        )}
                      >
                        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      {opt.label}
                    </motion.button>
                  );
                })}
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  value={customDraft}
                  onChange={(e) => setCustomDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomCharge();
                    }
                  }}
                  placeholder="Custom charge…"
                  className={cn(field, "mt-0")}
                />
                <Button type="button" variant="outline" className="h-10 shrink-0 gap-1" onClick={addCustomCharge}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
              <AnimatePresence initial={false}>
                {customCharges.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 flex flex-wrap gap-1.5"
                  >
                    {customCharges.map((c) => (
                      <motion.span
                        key={c}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 text-[11px] font-medium"
                      >
                        {c}
                        <button
                          type="button"
                          className="rounded-full p-0.5 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() =>
                            form.setValue(
                              "customCharges",
                              customCharges.filter((x) => x !== c),
                              { shouldDirty: true },
                            )
                          }
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </motion.span>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Section>

          <Section icon={ImagePlus} title="Branding" delay={0.18}>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onLogoChange(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={cn(
                "group flex w-full items-center gap-4 rounded-xl border border-dashed border-border bg-background px-4 py-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5",
              )}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="Project logo" className="h-14 w-14 rounded-lg object-cover ring-1 ring-border" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                  <ImagePlus className="h-6 w-6" />
                </div>
              )}
              <div>
                <div className="text-sm font-medium">{logoUrl ? "Change project logo" : "Upload project logo"}</div>
                <div className="text-xs text-muted-foreground">PNG or JPG · auto-compressed</div>
              </div>
            </button>
            {logoUrl && (
              <button
                type="button"
                className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
                onClick={() => form.setValue("logoUrl", "", { shouldDirty: true })}
              >
                Remove logo
              </button>
            )}
          </Section>
        </div>

        <AlertDialogFooter className="border-t border-border bg-muted/30 px-6 py-4">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button onClick={submit} className="bg-primary hover:bg-primary/90">
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
  adminMode = false,
): ProjectAdminFormValues {
  const company = companies.find((c) => c.id === defaultCompanyId) ?? companies[0];
  return {
    name: "",
    companyId: company?.id ?? "",
    address: adminMode ? "" : "",
    state: "",
    city: company?.city ?? "",
    pinCode: "",
    type: "Residential",
    totalTowers: 1,
    totalFloors: 0,
    units: 1,
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
  return {
    name: data.name.trim(),
    companyId: data.companyId,
    type: data.type,
    units: data.units,
    city: data.city.trim(),
    rera: data.rera?.trim() ?? "",
    address: (data.address ?? "").trim() || undefined,
    state: data.state || undefined,
    pinCode: data.pinCode || undefined,
    totalTowers: data.totalTowers,
    totalFloors: data.totalFloors,
    agreementValue: data.agreementValue,
    otherCharges: data.otherCharges as ProjectOtherChargeKey[],
    customCharges: data.customCharges,
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
