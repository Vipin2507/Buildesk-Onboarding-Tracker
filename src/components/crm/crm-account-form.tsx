import type { UseFormReturn } from "react-hook-form";
import { z } from "zod";

import { DatePickerField } from "@/components/date-picker-field";
import { cn } from "@/lib/utils";
import { COMPANY_REGIONS, COMPANY_TYPES, type CompanyRegion, type CompanyType } from "@/types/company";
import type { CrmAccount } from "@/types/crm-account";

export const crmAccountSchema = z.object({
  name: z.string().min(2, "Account name is required"),
  companyType: z.enum([
    "Real Estate Developer",
    "Channel Partner",
    "Broker",
    "Mandate",
    "CT",
    "Agent",
  ] as [CompanyType, ...CompanyType[]]),
  contact: z.string().min(2, "Contact person is required"),
  phone: z.string().min(10, "Enter a valid phone"),
  email: z.string().email("Enter a valid email"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  region: z.enum(["NCR", "South", "West", "Rest of India"] as [CompanyRegion, ...CompanyRegion[]]),
  ownerName: z.string().optional(),
  pocName: z.string().min(2, "POC name is required"),
  pocMobile: z.string().min(10, "POC mobile is required"),
  salesManagerName: z.string().min(2, "Sales manager is required"),
  accountManagerName: z.string().min(2, "Account manager is required"),
  supportManager1: z.string().min(2, "Support manager is required"),
  supportManager2: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  annualLicense: z.boolean(),
  dealSize: z.coerce.number().min(1, "Deal size is required"),
  usersPurchased: z.coerce.number().int().min(1, "Number of users is required"),
  totalCost: z.coerce.number().min(0, "Total cost is required"),
  paymentReceived: z.coerce.number().min(0, "Payment received is required"),
  pendingAmount: z.coerce.number().min(0, "Pending amount is required"),
});

export type CrmAccountFormValues = z.infer<typeof crmAccountSchema>;

export function emptyCrmAccountForm(): CrmAccountFormValues {
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  return {
    name: "",
    companyType: "Real Estate Developer",
    contact: "",
    phone: "",
    email: "",
    city: "",
    state: "",
    region: "Rest of India",
    ownerName: "",
    pocName: "",
    pocMobile: "",
    salesManagerName: "",
    accountManagerName: "",
    supportManager1: "",
    supportManager2: "",
    startDate: today,
    endDate: end,
    annualLicense: true,
    dealSize: 0,
    usersPurchased: 1,
    totalCost: 0,
    paymentReceived: 0,
    pendingAmount: 0,
  };
}

export function crmAccountToFormValues(account: CrmAccount): CrmAccountFormValues {
  return {
    name: account.name,
    companyType: account.companyType,
    contact: account.contact,
    phone: account.phone,
    email: account.email,
    city: account.city,
    state: account.state ?? "",
    region: (account.region as CompanyRegion) || "Rest of India",
    ownerName: account.ownerName ?? "",
    pocName: account.pocName ?? account.contact,
    pocMobile: account.pocMobile ?? account.phone,
    salesManagerName: account.salesManagerName ?? "",
    accountManagerName: account.accountManagerName ?? "",
    supportManager1: account.supportManager1 ?? "",
    supportManager2: account.supportManager2 ?? "",
    startDate: account.startDate ?? "",
    endDate: account.endDate ?? "",
    annualLicense: account.annualLicense ?? true,
    dealSize: account.dealSize ?? 0,
    usersPurchased: account.usersPurchased ?? 1,
    totalCost: account.totalCost ?? 0,
    paymentReceived: account.paymentReceived ?? 0,
    pendingAmount: account.pendingAmount ?? 0,
  };
}

export function normalizeCrmAccountForm(data: CrmAccountFormValues) {
  return {
    ...data,
    ownerName: (data.ownerName ?? "").trim() || data.contact.trim(),
    pocName: data.pocName.trim() || data.contact.trim(),
    pocMobile: data.pocMobile.trim() || data.phone.trim(),
    supportManager2: (data.supportManager2 ?? "").trim() || undefined,
  };
}

function fieldClass(hasError?: boolean) {
  return cn(
    "mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40",
    hasError && "border-destructive focus:ring-destructive/30",
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</div>
  );
}

export function CrmAccountFormFields({ form }: { form: UseFormReturn<CrmAccountFormValues> }) {
  const errors = form.formState.errors;

  return (
    <div className="grid gap-4">
      <div className="space-y-3">
        <SectionTitle>Account</SectionTitle>
        <div>
          <label className="text-xs font-medium">Account name</label>
          <input {...form.register("name")} className={fieldClass(!!errors.name)} />
          <FieldError message={errors.name?.message} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium">Company type</label>
            <select {...form.register("companyType")} className={fieldClass()}>
              {COMPANY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Region</label>
            <select {...form.register("region")} className={fieldClass()}>
              {COMPANY_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">City</label>
            <input {...form.register("city")} className={fieldClass(!!errors.city)} />
            <FieldError message={errors.city?.message} />
          </div>
          <div>
            <label className="text-xs font-medium">State</label>
            <input {...form.register("state")} className={fieldClass(!!errors.state)} />
            <FieldError message={errors.state?.message} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <SectionTitle>Primary contact</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium">Contact person</label>
            <input {...form.register("contact")} className={fieldClass(!!errors.contact)} />
            <FieldError message={errors.contact?.message} />
          </div>
          <div>
            <label className="text-xs font-medium">Phone</label>
            <input type="tel" {...form.register("phone")} className={fieldClass(!!errors.phone)} />
            <FieldError message={errors.phone?.message} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium">Email</label>
            <input type="email" {...form.register("email")} className={fieldClass(!!errors.email)} />
            <FieldError message={errors.email?.message} />
          </div>
          <div>
            <label className="text-xs font-medium">Owner name</label>
            <input
              {...form.register("ownerName")}
              placeholder="Defaults to contact"
              className={fieldClass()}
            />
          </div>
          <div>
            <label className="text-xs font-medium">POC name</label>
            <input {...form.register("pocName")} className={fieldClass(!!errors.pocName)} />
            <FieldError message={errors.pocName?.message} />
          </div>
          <div>
            <label className="text-xs font-medium">POC mobile</label>
            <input type="tel" {...form.register("pocMobile")} className={fieldClass(!!errors.pocMobile)} />
            <FieldError message={errors.pocMobile?.message} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <SectionTitle>Team</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium">Sales manager</label>
            <input
              {...form.register("salesManagerName")}
              className={fieldClass(!!errors.salesManagerName)}
            />
            <FieldError message={errors.salesManagerName?.message} />
          </div>
          <div>
            <label className="text-xs font-medium">Account manager</label>
            <input
              {...form.register("accountManagerName")}
              className={fieldClass(!!errors.accountManagerName)}
            />
            <FieldError message={errors.accountManagerName?.message} />
          </div>
          <div>
            <label className="text-xs font-medium">Support manager 1</label>
            <input
              {...form.register("supportManager1")}
              className={fieldClass(!!errors.supportManager1)}
            />
            <FieldError message={errors.supportManager1?.message} />
          </div>
          <div>
            <label className="text-xs font-medium">Support manager 2</label>
            <input {...form.register("supportManager2")} className={fieldClass()} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <SectionTitle>Commercial & license</SectionTitle>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" {...form.register("annualLicense")} />
          Annual license
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium">Users purchased</label>
            <input
              type="number"
              min={1}
              step={1}
              {...form.register("usersPurchased")}
              className={fieldClass(!!errors.usersPurchased)}
            />
            <FieldError message={errors.usersPurchased?.message} />
          </div>
          <div>
            <label className="text-xs font-medium">Deal size (₹)</label>
            <input
              type="number"
              min={0}
              step="any"
              {...form.register("dealSize")}
              className={fieldClass(!!errors.dealSize)}
            />
            <FieldError message={errors.dealSize?.message} />
          </div>
          <div>
            <label className="text-xs font-medium">Total cost (₹)</label>
            <input
              type="number"
              min={0}
              step="any"
              {...form.register("totalCost")}
              className={fieldClass(!!errors.totalCost)}
            />
            <FieldError message={errors.totalCost?.message} />
          </div>
          <div>
            <label className="text-xs font-medium">Payment received (₹)</label>
            <input
              type="number"
              min={0}
              step="any"
              {...form.register("paymentReceived")}
              className={fieldClass(!!errors.paymentReceived)}
            />
            <FieldError message={errors.paymentReceived?.message} />
          </div>
          <div>
            <label className="text-xs font-medium">Pending amount (₹)</label>
            <input
              type="number"
              min={0}
              step="any"
              {...form.register("pendingAmount")}
              className={fieldClass(!!errors.pendingAmount)}
            />
            <FieldError message={errors.pendingAmount?.message} />
          </div>
          <div>
            <label className="text-xs font-medium">Start date</label>
            <DatePickerField
              modal
              className="mt-1"
              value={form.watch("startDate") ?? ""}
              onChange={(v) =>
                form.setValue("startDate", v, { shouldValidate: true, shouldDirty: true })
              }
            />
            <FieldError message={errors.startDate?.message} />
          </div>
          <div>
            <label className="text-xs font-medium">End date</label>
            <DatePickerField
              modal
              className="mt-1"
              value={form.watch("endDate") ?? ""}
              onChange={(v) =>
                form.setValue("endDate", v, { shouldValidate: true, shouldDirty: true })
              }
            />
            <FieldError message={errors.endDate?.message} />
          </div>
        </div>
      </div>
    </div>
  );
}
