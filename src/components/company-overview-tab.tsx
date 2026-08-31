import { useEffect, useMemo, useState } from "react";
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
import { usePermissions } from "@/hooks/use-permissions";
import { assignableManagerUsers, resolveAssigneeName } from "@/lib/managers";
import { useCompanyStore, useEmployeeStore, useUserStore } from "@/stores";
import type {
  Company,
  CompanyCommercialPlanName,
  CompanyCommercialStatus,
  CompanyHealth,
  CompanyPaymentStatus,
  CompanyPlan,
  CompanyRegion,
  StatusKey,
} from "@/types";
import {
  COMPANY_COMMERCIAL_PLAN_NAMES,
  COMPANY_COMMERCIAL_STATUSES,
  COMPANY_PAYMENT_STATUSES,
  COMPANY_REGIONS,
  STATUS_LABEL,
} from "@/types";
import { cn, formatDate, formatInr } from "@/lib/utils";

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
  salesAgentId: z.string().optional(),
  plan: z.enum(["Annual", "Half-Yearly", "AMC"]),
  planName: z.union([z.enum(COMPANY_COMMERCIAL_PLAN_NAMES), z.literal("")]).optional(),
  health: z.enum(["Healthy", "Moderate", "Critical"]),
  status: z.enum(["not_started", "in_progress", "review", "completed", "on_hold"]),
  commercialStatus: z.union([z.enum(COMPANY_COMMERCIAL_STATUSES), z.literal("")]).optional(),
  usersPurchased: z.string().optional(),
  dealSize: z.string().optional(),
  amountWithGst: z.string().optional(),
  taxableAmount: z.string().optional(),
  gstAmount: z.string().optional(),
  paymentStatus: z.union([z.enum(COMPANY_PAYMENT_STATUSES), z.literal("")]).optional(),
  paymentReceived: z.string().optional(),
  pendingAmount: z.string().optional(),
  installmentAmount: z.string().optional(),
  installmentDueDate: z.string().optional(),
  installmentCount: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  agreementDate: z.string().min(1),
  goLiveTarget: z.string().min(1),
  planExpiry: z.string().min(1),
  cancelledOn: z.string().optional(),
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
    <div className={cn("space-y-0.5", className)}>
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}
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

function commercialStatusTone(status: CompanyCommercialStatus): "success" | "warning" | "danger" | "muted" {
  switch (status) {
    case "Live":
      return "success";
    case "Unpaid":
    case "Future":
      return "warning";
    case "Canceled":
    case "Expired":
      return "danger";
    default:
      return "muted";
  }
}

function paymentStatusTone(status: string): "success" | "warning" | "danger" | "muted" {
  switch (status) {
    case "Fully paid":
      return "success";
    case "Partially paid":
    case "Part payment subscription":
      return "warning";
    case "Pending":
      return "danger";
    default:
      return "muted";
  }
}

function parseOptionalNumber(value?: string) {
  if (!value?.trim()) return undefined;
  const n = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function parseOptionalInt(value?: string) {
  const n = parseOptionalNumber(value);
  return n != null ? Math.max(0, Math.round(n)) : undefined;
}

export function CompanyOverviewTab({ company }: { company: Company }) {
  const updateCompany = useCompanyStore((s) => s.updateCompany);
  const employees = useEmployeeStore((s) => s.employees);
  const users = useUserStore((s) => s.users);
  const { can, isAdmin } = usePermissions();
  const canAssignSalesAgent = isAdmin || can("assignSalesAgent");
  const [editing, setEditing] = useState(false);

  const form = useForm<DetailForm>({
    resolver: zodResolver(detailSchema),
    defaultValues: toFormValues(company),
  });

  const companyFormSnapshot = useMemo(() => toFormValues(company), [company]);

  useEffect(() => {
    if (!editing) form.reset(companyFormSnapshot);
  }, [companyFormSnapshot, editing, form]);
  const managerName = resolveAssigneeName(company.onboardingManagerId, users, employees);
  const salesAgentName = resolveAssigneeName(company.salesAgentId, users, employees);
  const csmName = resolveAssigneeName(company.csmId, users, employees);
  const managers = assignableManagerUsers(users);
  const csms = assignableManagerUsers(users);

  function onSave() {
    form.handleSubmit((data) => {
      updateCompany(company.id, {
        ...data,
        officeAddress: data.officeAddress || undefined,
        gstNumber: data.gstNumber || undefined,
        billingInfo: data.billingInfo || undefined,
        salesAgentId: data.salesAgentId || undefined,
        plan: data.plan as CompanyPlan,
        planName: (data.planName || undefined) as CompanyCommercialPlanName | undefined,
        health: data.health as CompanyHealth,
        status: data.status as StatusKey,
        commercialStatus: (data.commercialStatus || undefined) as CompanyCommercialStatus | undefined,
        paymentStatus: (data.paymentStatus || undefined) as CompanyPaymentStatus | undefined,
        endDate: data.endDate || undefined,
        cancelledOn: data.cancelledOn || undefined,
        usersPurchased: parseOptionalInt(data.usersPurchased),
        dealSize: parseOptionalNumber(data.dealSize),
        totalCost: parseOptionalNumber(data.dealSize) ?? company.totalCost,
        amountWithGst: parseOptionalNumber(data.amountWithGst),
        taxableAmount: parseOptionalNumber(data.taxableAmount),
        gstAmount: parseOptionalNumber(data.gstAmount),
        paymentReceived: parseOptionalNumber(data.paymentReceived),
        pendingAmount: parseOptionalNumber(data.pendingAmount),
        installmentAmount: parseOptionalNumber(data.installmentAmount),
        installmentDueDate: data.installmentDueDate || undefined,
        installmentCount: parseOptionalInt(data.installmentCount),
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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground">Company details</h3>
          <p className="text-[10px] text-muted-foreground">
            Contact, ownership, and commercial information
          </p>
        </div>
        <div className="flex gap-1.5">
          {editing ? (
            <>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={onCancel}>
                <X className="h-3 w-3" /> Cancel
              </Button>
              <Button size="sm" className="h-7 gap-1 text-xs" onClick={onSave}>
                <Save className="h-3 w-3" /> Save
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setEditing(true)}>
              <Pencil className="h-3 w-3" /> Edit
            </Button>
          )}
        </div>
      </div>

      {editing ? (
        <form
          className="grid gap-2.5 md:grid-cols-2"
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
              <select
                {...form.register("onboardingManagerId")}
                className={inputClass()}
                disabled={!isAdmin}
              >
                {managers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {u.role}
                  </option>
                ))}
              </select>
              {!isAdmin ? (
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Only admins can change the onboarding manager.
                </span>
              ) : null}
            </label>
            <label className="block text-xs font-medium">
              CSM
              <select {...form.register("csmId")} className={inputClass()}>
                {csms.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {u.role}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium">
              Sales Agent
              <select
                {...form.register("salesAgentId")}
                className={inputClass()}
                disabled={!canAssignSalesAgent}
              >
                <option value="">Unassigned</option>
                {managers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {u.role}
                  </option>
                ))}
              </select>
            </label>
          </Section>

          <Section title="Commercial" className="md:col-span-2">
            <label className="block text-xs font-medium">
              Subscription Status
              <select {...form.register("commercialStatus")} className={inputClass()}>
                <option value="">—</option>
                {COMPANY_COMMERCIAL_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium">
              Plan Name
              <select {...form.register("planName")} className={inputClass()}>
                <option value="">—</option>
                {COMPANY_COMMERCIAL_PLAN_NAMES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium">
              Plan Tier
              <select {...form.register("plan")} className={inputClass()}>
                {(["Annual", "Half-Yearly", "AMC"] as const).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium">
              Users / Quantity
              <input type="number" min={0} step={1} {...form.register("usersPurchased")} className={inputClass()} />
            </label>
            <label className="block text-xs font-medium">
              Deal Value
              <input type="number" min={0} step={1} {...form.register("dealSize")} className={inputClass()} />
            </label>
            <label className="block text-xs font-medium">
              Amount with GST
              <input type="number" min={0} step={1} {...form.register("amountWithGst")} className={inputClass()} />
            </label>
            <label className="block text-xs font-medium">
              Taxable
              <input type="number" min={0} step={1} {...form.register("taxableAmount")} className={inputClass()} />
            </label>
            <label className="block text-xs font-medium">
              GST Amount
              <input type="number" min={0} step={1} {...form.register("gstAmount")} className={inputClass()} />
            </label>
            <label className="block text-xs font-medium">
              Payment Status
              <select {...form.register("paymentStatus")} className={inputClass()}>
                <option value="">—</option>
                {COMPANY_PAYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium">
              Payment Received
              <input type="number" min={0} step={1} {...form.register("paymentReceived")} className={inputClass()} />
            </label>
            <label className="block text-xs font-medium">
              Installment Amount
              <input type="number" min={0} step={1} {...form.register("installmentAmount")} className={inputClass()} />
            </label>
            <label className="block text-xs font-medium">
              Installment Due Date
              <input type="date" {...form.register("installmentDueDate")} className={inputClass()} />
            </label>
            <label className="block text-xs font-medium">
              Pending Amount
              <input type="number" min={0} step={1} {...form.register("pendingAmount")} className={inputClass()} />
            </label>
            <label className="block text-xs font-medium">
              Installments
              <input type="number" min={0} step={1} {...form.register("installmentCount")} className={inputClass()} />
            </label>
            <label className="block text-xs font-medium">
              Start Date
              <input type="date" {...form.register("startDate")} className={inputClass()} />
            </label>
            <label className="block text-xs font-medium">
              End Date
              <input type="date" {...form.register("endDate")} className={inputClass()} />
            </label>
            <label className="block text-xs font-medium">
              Plan Expiry
              <input type="date" {...form.register("planExpiry")} className={inputClass()} />
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
              Cancelled On
              <input type="date" {...form.register("cancelledOn")} className={inputClass()} />
            </label>
            <label className="block text-xs font-medium sm:col-span-2 lg:col-span-3">
              Billing Info
              <input {...form.register("billingInfo")} className={inputClass()} />
            </label>
          </Section>
        </form>
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2">
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
            <Field label="Onboarding Manager" icon={UserCog}>{managerName ?? "—"}</Field>
            <Field label="CSM" icon={UserCog}>{csmName ?? "—"}</Field>
            <Field label="Sales Agent" icon={UserCog}>{salesAgentName ?? "—"}</Field>
          </Section>

          <Section title="Commercial" className="md:col-span-2">
            <Field label="Subscription Status">
              {company.commercialStatus ? (
                <Pill tone={commercialStatusTone(company.commercialStatus)}>
                  {company.commercialStatus}
                </Pill>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Plan Name" icon={CreditCard}>
              {company.planName || "—"}
            </Field>
            <Field label="Plan Tier">
              <Pill tone="accent">{company.plan}</Pill>
            </Field>
            <Field label="Users / Quantity">
              {company.usersPurchased != null ? company.usersPurchased : "—"}
            </Field>
            <Field label="Deal Value">{formatInr(company.dealSize)}</Field>
            <Field label="Amount with GST">{formatInr(company.amountWithGst)}</Field>
            <Field label="Taxable">{formatInr(company.taxableAmount)}</Field>
            <Field label="GST Amount">{formatInr(company.gstAmount)}</Field>
            <Field label="Payment Status">
              {company.paymentStatus ? (
                <Pill tone={paymentStatusTone(company.paymentStatus)}>{company.paymentStatus}</Pill>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Payment Received">{formatInr(company.paymentReceived)}</Field>
            <Field label="Installment Amount">{formatInr(company.installmentAmount)}</Field>
            <Field label="Installment Due Date" icon={Calendar}>
              {formatDate(company.installmentDueDate)}
            </Field>
            <Field label="Pending Amount">{formatInr(company.pendingAmount)}</Field>
            <Field label="Installments">
              {company.installmentCount != null ? company.installmentCount : "—"}
            </Field>
            <Field label="Start Date" icon={Calendar}>
              {formatDate(company.startDate || company.agreementDate)}
            </Field>
            <Field label="End Date" icon={Calendar}>{formatDate(company.endDate)}</Field>
            <Field label="Plan Expiry" icon={Calendar}>{formatDate(company.planExpiry)}</Field>
            <Field label="Agreement Date" icon={Calendar}>{formatDate(company.agreementDate)}</Field>
            <Field label="Go-Live Target" icon={Calendar}>{formatDate(company.goLiveTarget)}</Field>
            <Field label="Cancelled On" icon={Calendar}>{formatDate(company.cancelledOn)}</Field>
            <Field label="Billing Info" className="sm:col-span-2">
              {company.billingInfo || `${company.plan} plan`}
            </Field>
            {company.renewedAt ? (
              <Field label="Last Renewed">{formatDate(company.renewedAt)}</Field>
            ) : null}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("card-soft space-y-2 p-3 md:col-span-1", className)}>
      <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
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
    salesAgentId: company.salesAgentId ?? "",
    plan: company.plan,
    planName: company.planName ?? "",
    health: company.health,
    status: company.status,
    commercialStatus: company.commercialStatus ?? "",
    usersPurchased: company.usersPurchased != null ? String(company.usersPurchased) : "",
    dealSize: company.dealSize != null ? String(company.dealSize) : "",
    amountWithGst: company.amountWithGst != null ? String(company.amountWithGst) : "",
    taxableAmount: company.taxableAmount != null ? String(company.taxableAmount) : "",
    gstAmount: company.gstAmount != null ? String(company.gstAmount) : "",
    paymentStatus: company.paymentStatus ?? "",
    paymentReceived: company.paymentReceived != null ? String(company.paymentReceived) : "",
    pendingAmount: company.pendingAmount != null ? String(company.pendingAmount) : "",
    installmentAmount: company.installmentAmount != null ? String(company.installmentAmount) : "",
    installmentDueDate: company.installmentDueDate ?? "",
    installmentCount: company.installmentCount != null ? String(company.installmentCount) : "",
    startDate: company.startDate || company.agreementDate,
    endDate: company.endDate ?? "",
    agreementDate: company.agreementDate,
    goLiveTarget: company.goLiveTarget,
    planExpiry: company.planExpiry,
    cancelledOn: company.cancelledOn ?? "",
  };
}
