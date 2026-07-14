import { useEffect, useState } from "react";
import {
  Building2,
  Calendar,
  CreditCard,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Save,
  Shield,
  User,
  UserCog,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { StatusPill, Pill } from "@/components/status-pill";
import { useCompanyStore, useEmployeeStore } from "@/stores";
import type { Company, CompanyHealth, CompanyPlan, CompanyRegion, StatusKey } from "@/types";
import { COMPANY_REGIONS, STATUS_LABEL } from "@/types";
import { cn } from "@/lib/utils";

const detailSchema = z.object({
  name: z.string().min(2, "Name is required"),
  contact: z.string().min(2, "Contact is required"),
  designation: z.string().min(2, "Designation is required"),
  phone: z.string().min(10, "Valid phone required"),
  email: z.string().email("Valid email required"),
  city: z.string().min(2, "City is required"),
  region: z.enum(["NCR", "South", "West", "Rest of India"]),
  ownerName: z.string().min(1),
  ownerMobile: z.string().min(1),
  pocName: z.string().min(1),
  pocMobile: z.string().min(1),
  officeAddress: z.string().optional(),
  gstNumber: z.string().optional(),
  billingInfo: z.string().optional(),
  onboardingManagerId: z.string().min(1),
  csmId: z.string().min(1),
  plan: z.enum(["Annual", "Half-Yearly", "AMC"]),
  health: z.enum(["Healthy", "Moderate", "Critical"]),
  status: z.enum(["not_started", "in_progress", "review", "completed", "on_hold"]),
  startDate: z.string().min(1),
  agreementDate: z.string().min(1),
  goLiveTarget: z.string().min(1),
  planExpiry: z.string().min(1),
});

type DetailForm = z.infer<typeof detailSchema>;

function Field({
  label,
  icon: Icon,
  children,
  className,
}: {
  label: string;
  icon?: typeof User;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function inputClass(error?: boolean) {
  return cn(
    "mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40",
    error && "border-destructive",
  );
}

export function CompanyOverviewTab({ company }: { company: Company }) {
  const updateCompany = useCompanyStore((s) => s.updateCompany);
  const employees = useEmployeeStore((s) => s.employees);
  const [editing, setEditing] = useState(false);

  const form = useForm<DetailForm>({
    resolver: zodResolver(detailSchema),
    defaultValues: toFormValues(company),
  });

  useEffect(() => {
    if (!editing) form.reset(toFormValues(company));
  }, [company, editing, form]);

  const manager = employees.find((e) => e.id === company.onboardingManagerId);
  const csm = employees.find((e) => e.id === company.csmId);
  const managers = employees.filter(
    (e) => e.role.includes("Onboarding") || e.role.includes("Implementation") || e.role === "Admin",
  );
  const csms = employees.filter((e) => e.role === "CSM" || e.role === "Admin");

  function onSave() {
    form.handleSubmit((data) => {
      updateCompany(company.id, {
        ...data,
        officeAddress: data.officeAddress || undefined,
        gstNumber: data.gstNumber || undefined,
        billingInfo: data.billingInfo || undefined,
        plan: data.plan as CompanyPlan,
        health: data.health as CompanyHealth,
        status: data.status as StatusKey,
      });
      toast.success("Company details saved");
      setEditing(false);
    })();
  }

  function onCancel() {
    form.reset(toFormValues(company));
    setEditing(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Company Details</h3>
          <p className="text-xs text-muted-foreground">
            Contact, account ownership, and commercial information
          </p>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={onCancel}>
                <X className="h-3.5 w-3.5" /> Cancel
              </Button>
              <Button size="sm" className="gap-1.5" onClick={onSave}>
                <Save className="h-3.5 w-3.5" /> Save Changes
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit Details
            </Button>
          )}
        </div>
      </div>

      {editing ? (
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
        >
          <Section title="Profile">
            <label className="block text-xs font-medium">
              Company Name
              <input {...form.register("name")} className={inputClass(!!form.formState.errors.name)} />
            </label>
            <label className="block text-xs font-medium">
              City
              <input {...form.register("city")} className={inputClass(!!form.formState.errors.city)} />
            </label>
            <label className="block text-xs font-medium">
              Region
              <select {...form.register("region")} className={inputClass()}>
                {COMPANY_REGIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium md:col-span-2">
              Office Address
              <input {...form.register("officeAddress")} className={inputClass()} />
            </label>
            <label className="block text-xs font-medium">
              GST Number
              <input {...form.register("gstNumber")} className={inputClass()} />
            </label>
            <label className="block text-xs font-medium">
              Account Status
              <select {...form.register("status")} className={inputClass()}>
                {(Object.keys(STATUS_LABEL) as StatusKey[]).map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium">
              Health
              <select {...form.register("health")} className={inputClass()}>
                {(["Healthy", "Moderate", "Critical"] as const).map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </label>
          </Section>

          <Section title="Primary Contact">
            <label className="block text-xs font-medium">
              Contact Person
              <input {...form.register("contact")} className={inputClass(!!form.formState.errors.contact)} />
            </label>
            <label className="block text-xs font-medium">
              Designation
              <input {...form.register("designation")} className={inputClass(!!form.formState.errors.designation)} />
            </label>
            <label className="block text-xs font-medium">
              Email
              <input {...form.register("email")} className={inputClass(!!form.formState.errors.email)} />
            </label>
            <label className="block text-xs font-medium">
              Phone
              <input {...form.register("phone")} className={inputClass(!!form.formState.errors.phone)} />
            </label>
          </Section>

          <Section title="Owner & POC">
            <label className="block text-xs font-medium">
              Owner Name
              <input {...form.register("ownerName")} className={inputClass()} />
            </label>
            <label className="block text-xs font-medium">
              Owner Mobile
              <input {...form.register("ownerMobile")} className={inputClass()} />
            </label>
            <label className="block text-xs font-medium">
              POC Name
              <input {...form.register("pocName")} className={inputClass()} />
            </label>
            <label className="block text-xs font-medium">
              POC Mobile
              <input {...form.register("pocMobile")} className={inputClass()} />
            </label>
          </Section>

          <Section title="Ownership">
            <label className="block text-xs font-medium">
              Onboarding Manager
              <select {...form.register("onboardingManagerId")} className={inputClass()}>
                {managers.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium">
              CSM
              <select {...form.register("csmId")} className={inputClass()}>
                {csms.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </label>
          </Section>

          <Section title="Commercial">
            <label className="block text-xs font-medium">
              Plan
              <select {...form.register("plan")} className={inputClass()}>
                {(["Annual", "Half-Yearly", "AMC"] as const).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium">
              Billing Info
              <input {...form.register("billingInfo")} className={inputClass()} />
            </label>
            <label className="block text-xs font-medium">
              Start Date
              <input type="date" {...form.register("startDate")} className={inputClass()} />
            </label>
            <label className="block text-xs font-medium">
              Agreement Date
              <input type="date" {...form.register("agreementDate")} className={inputClass()} />
            </label>
            <label className="block text-xs font-medium">
              Go-Live Target
              <input type="date" {...form.register("goLiveTarget")} className={inputClass()} />
            </label>
            <label className="block text-xs font-medium">
              Plan Expiry
              <input type="date" {...form.register("planExpiry")} className={inputClass()} />
            </label>
          </Section>
        </form>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Section title="Profile">
            <Field label="Company" icon={Building2}>
              <span className="font-medium">{company.name}</span>
            </Field>
            <Field label="City" icon={MapPin}>{company.city}</Field>
            <Field label="Region" icon={MapPin}>{company.region || "Rest of India"}</Field>
            <Field label="Office Address" icon={MapPin} className="md:col-span-2">
              {company.officeAddress || company.city}
            </Field>
            <Field label="GST" icon={Shield}>{company.gstNumber || "—"}</Field>
            <Field label="Account Status">
              <StatusPill status={company.status} />
            </Field>
            <Field label="Health">
              <Pill tone={company.health === "Healthy" ? "success" : company.health === "Moderate" ? "warning" : "danger"}>
                {company.health}
              </Pill>
            </Field>
          </Section>

          <Section title="Primary Contact">
            <Field label="Contact Person" icon={User}>
              <div className="font-medium">{company.contact}</div>
              <div className="text-xs text-muted-foreground">{company.designation}</div>
            </Field>
            <Field label="Email" icon={Mail}>
              <a className="text-primary hover:underline" href={`mailto:${company.email}`}>{company.email}</a>
            </Field>
            <Field label="Phone" icon={Phone}>{company.phone}</Field>
          </Section>

          <Section title="Owner & POC">
            <Field label="Owner" icon={User}>
              <div className="font-medium">{company.ownerName || "—"}</div>
              <div className="text-xs text-muted-foreground">{company.ownerMobile || ""}</div>
            </Field>
            <Field label="POC" icon={UserCog}>
              <div className="font-medium">{company.pocName || company.contact}</div>
              <div className="text-xs text-muted-foreground">{company.pocMobile || company.phone}</div>
            </Field>
          </Section>

          <Section title="Ownership">
            <Field label="Onboarding Manager" icon={UserCog}>{manager?.name ?? "—"}</Field>
            <Field label="CSM" icon={UserCog}>{csm?.name ?? "—"}</Field>
          </Section>

          <Section title="Commercial">
            <Field label="Plan" icon={CreditCard}>
              <Pill tone="accent">{company.plan}</Pill>
            </Field>
            <Field label="Billing Info">{company.billingInfo || `${company.plan} plan`}</Field>
            <Field label="Start Date" icon={Calendar}>{company.startDate || company.agreementDate}</Field>
            <Field label="Agreement Date" icon={Calendar}>{company.agreementDate}</Field>
            <Field label="Go-Live Target" icon={Calendar}>{company.goLiveTarget}</Field>
            <Field label="Plan Expiry" icon={Calendar}>{company.planExpiry}</Field>
            {company.renewedAt && (
              <Field label="Last Renewed">{new Date(company.renewedAt).toLocaleDateString()}</Field>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card-soft space-y-3 p-5 md:col-span-1">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function toFormValues(company: Company): DetailForm {
  return {
    name: company.name,
    contact: company.contact,
    designation: company.designation,
    phone: company.phone,
    email: company.email,
    city: company.city,
    region: (company.region as CompanyRegion) || "Rest of India",
    ownerName: company.ownerName || "",
    ownerMobile: company.ownerMobile || "",
    pocName: company.pocName || company.contact,
    pocMobile: company.pocMobile || company.phone,
    officeAddress: company.officeAddress ?? "",
    gstNumber: company.gstNumber ?? "",
    billingInfo: company.billingInfo ?? "",
    onboardingManagerId: company.onboardingManagerId,
    csmId: company.csmId,
    plan: company.plan,
    health: company.health,
    status: company.status,
    startDate: company.startDate || company.agreementDate,
    agreementDate: company.agreementDate,
    goLiveTarget: company.goLiveTarget,
    planExpiry: company.planExpiry,
  };
}
