import { useEffect, useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";
import { z } from "zod";

import { DatePickerField } from "@/components/date-picker-field";
import {
  ACCOUNT_COUNTRIES,
  citiesForState,
  countryForState,
  findLocationByCity,
  INDIA_CITIES,
  INDIA_STATES,
  regionForState,
} from "@/data/india-locations";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/stores";
import { COMPANY_TYPES, type CompanyRegion, type CompanyType } from "@/types/company";
import type { CrmAccount } from "@/types/crm-account";

export const crmAccountSchema = z.object({
  name: z.string().min(2, "Account name is required"),
  userId: z.string().min(1, "User ID is required"),
  companyType: z.enum([
    "Real Estate Developer",
    "Channel Partner",
    "Broker",
    "Mandate",
    "CT",
    "Agent",
  ] as [CompanyType, ...CompanyType[]]),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  country: z.string().min(2, "Country is required"),
  region: z.enum(["NCR", "South", "West", "Rest of India"] as [CompanyRegion, ...CompanyRegion[]]),
  ownerName: z.string().min(2, "Owner name is required"),
  ownerPhone: z.string().min(10, "Enter a valid owner number"),
  ownerEmail: z.string().email("Enter a valid owner email"),
  pocName: z.string().min(2, "POC name is required"),
  pocMobile: z.string().min(10, "POC number is required"),
  pocEmail: z.string().email("Enter a valid POC email"),
  salesManagerName: z.string().min(2, "Sales manager is required"),
  supportManager1: z.string().min(2, "Support manager 1 is required"),
  supportManager2: z.string().optional(),
  usersPurchased: z.coerce.number().int().min(1, "Users purchased is required"),
  dealSize: z.coerce.number().min(1, "Total deal value is required"),
  pendingAmount: z.coerce.number().min(0, "Pending amount is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

export type CrmAccountFormValues = z.infer<typeof crmAccountSchema>;

export function emptyCrmAccountForm(): CrmAccountFormValues {
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  return {
    name: "",
    userId: "",
    companyType: "Real Estate Developer",
    city: "",
    state: "",
    country: "India",
    region: "Rest of India",
    ownerName: "",
    ownerPhone: "",
    ownerEmail: "",
    pocName: "",
    pocMobile: "",
    pocEmail: "",
    salesManagerName: "",
    supportManager1: "",
    supportManager2: "",
    usersPurchased: 1,
    dealSize: 0,
    pendingAmount: 0,
    startDate: today,
    endDate: end,
  };
}

export function crmAccountToFormValues(account: CrmAccount): CrmAccountFormValues {
  const ownerName = account.ownerName ?? account.contact;
  const ownerPhone = account.ownerPhone ?? account.phone;
  const ownerEmail = account.ownerEmail ?? account.email;
  return {
    name: account.name,
    userId: account.userId ?? "",
    companyType: account.companyType,
    city: account.city,
    state: account.state ?? "",
    country: account.country ?? "India",
    region: (account.region as CompanyRegion) || "Rest of India",
    ownerName,
    ownerPhone,
    ownerEmail,
    pocName: account.pocName ?? account.contact,
    pocMobile: account.pocMobile ?? account.phone,
    pocEmail: account.pocEmail ?? account.email,
    salesManagerName: account.salesManagerName ?? "",
    supportManager1: account.supportManager1 ?? "",
    supportManager2: account.supportManager2 ?? "",
    usersPurchased: account.usersPurchased ?? 1,
    dealSize: account.dealSize ?? account.totalCost ?? 0,
    pendingAmount: account.pendingAmount ?? 0,
    startDate: account.startDate ?? "",
    endDate: account.endDate ?? "",
  };
}

/** Maps form values onto CrmAccount fields (keeps legacy contact/phone/email in sync). */
export function normalizeCrmAccountForm(data: CrmAccountFormValues) {
  const ownerName = data.ownerName.trim();
  const ownerPhone = data.ownerPhone.trim();
  const ownerEmail = data.ownerEmail.trim();
  const dealSize = Number(data.dealSize) || 0;
  const pendingAmount = Number(data.pendingAmount) || 0;
  return {
    name: data.name.trim(),
    userId: data.userId.trim(),
    companyType: data.companyType,
    city: data.city.trim(),
    state: data.state.trim(),
    country: data.country.trim(),
    region: data.region,
    ownerName,
    ownerPhone,
    ownerEmail,
    contact: ownerName,
    phone: ownerPhone,
    email: ownerEmail,
    pocName: data.pocName.trim(),
    pocMobile: data.pocMobile.trim(),
    pocEmail: data.pocEmail.trim(),
    salesManagerName: data.salesManagerName.trim(),
    supportManager1: data.supportManager1.trim(),
    supportManager2: (data.supportManager2 ?? "").trim() || undefined,
    usersPurchased: Number(data.usersPurchased) || 1,
    dealSize,
    totalCost: dealSize,
    pendingAmount,
    paymentReceived: Math.max(0, dealSize - pendingAmount),
    annualLicense: true,
    startDate: data.startDate,
    endDate: data.endDate,
  };
}

function fieldClass(hasError?: boolean, readOnly?: boolean) {
  return cn(
    "mt-1.5 h-9 w-full rounded-lg border border-border/80 bg-background px-3 text-sm outline-none transition-[box-shadow,border-color] duration-200",
    "focus:border-primary/45 focus:ring-2 focus:ring-primary/20",
    hasError && "border-destructive focus:border-destructive focus:ring-destructive/25",
    readOnly && "cursor-default bg-muted/40 text-muted-foreground",
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-[11px] text-destructive">{message}</p>;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-card/40 p-3.5 sm:p-4">
      <div className="mb-3">
        <h3 className="text-xs font-semibold tracking-wide text-foreground">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-[11px] font-medium text-muted-foreground">
      {children}
      {required ? <span className="text-destructive"> *</span> : null}
    </label>
  );
}

export function CrmAccountFormFields({ form }: { form: UseFormReturn<CrmAccountFormValues> }) {
  const errors = form.formState.errors;
  const users = useUserStore((s) => s.users);
  const city = form.watch("city");
  const state = form.watch("state");

  const salesManagerName = form.watch("salesManagerName");
  const supportManager1 = form.watch("supportManager1");
  const supportManager2 = form.watch("supportManager2");

  const managers = useMemo(() => {
    const base = users
      .filter((u) => u.active && (u.productScope === "crm" || u.role === "Admin"))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
    const names = new Set(base.map((u) => u.name));
    const extras = [salesManagerName, supportManager1, supportManager2]
      .map((n) => (n ?? "").trim())
      .filter((n) => n.length > 0 && !names.has(n));
    return [...extras.map((name) => ({ id: `legacy-${name}`, name })), ...base];
  }, [users, salesManagerName, supportManager1, supportManager2]);

  const cityOptions = useMemo(() => {
    const base = state ? citiesForState(state) : INDIA_CITIES;
    if (city && !base.includes(city)) return [city, ...base];
    return base;
  }, [state, city]);

  const stateOptions = useMemo(() => {
    if (state && !INDIA_STATES.includes(state)) return [state, ...INDIA_STATES];
    return INDIA_STATES;
  }, [state]);

  // City drives state / country / region.
  useEffect(() => {
    const loc = findLocationByCity(city);
    if (!loc) return;
    const opts = { shouldValidate: true, shouldDirty: true } as const;
    if (form.getValues("state") !== loc.state) form.setValue("state", loc.state, opts);
    if (form.getValues("country") !== loc.country) form.setValue("country", loc.country, opts);
    if (form.getValues("region") !== loc.region) form.setValue("region", loc.region, opts);
  }, [city, form]);

  // State drives country / region when city is empty or mismatched.
  useEffect(() => {
    if (!state) return;
    const loc = findLocationByCity(city);
    if (loc && loc.state === state) return;
    const opts = { shouldValidate: true, shouldDirty: true } as const;
    const country = countryForState(state);
    const region = regionForState(state);
    if (country && form.getValues("country") !== country) form.setValue("country", country, opts);
    if (form.getValues("region") !== region) form.setValue("region", region, opts);
  }, [state, city, form]);

  return (
    <div className="grid gap-3.5">
      <Section title="Account" description="Basic identity for this CRM customer.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label required>Account name</Label>
            <input
              {...form.register("name")}
              placeholder="e.g. Skyline Developers"
              className={fieldClass(!!errors.name)}
            />
            <FieldError message={errors.name?.message} />
          </div>
          <div>
            <Label required>User ID</Label>
            <input
              {...form.register("userId")}
              placeholder="Client / portal user id"
              className={fieldClass(!!errors.userId)}
            />
            <FieldError message={errors.userId?.message} />
          </div>
          <div>
            <Label required>Company type</Label>
            <select {...form.register("companyType")} className={fieldClass()}>
              {COMPANY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      <Section title="Location" description="City fills state, country, and region automatically.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label required>City</Label>
            <select
              {...form.register("city")}
              className={fieldClass(!!errors.city)}
              value={city}
              onChange={(e) => {
                form.setValue("city", e.target.value, { shouldValidate: true, shouldDirty: true });
              }}
            >
              <option value="">Select city</option>
              {cityOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <FieldError message={errors.city?.message} />
          </div>
          <div>
            <Label required>State</Label>
            <select
              {...form.register("state")}
              className={fieldClass(!!errors.state)}
              value={state}
              onChange={(e) => {
                const next = e.target.value;
                form.setValue("state", next, { shouldValidate: true, shouldDirty: true });
                const allowed = citiesForState(next);
                if (city && !allowed.includes(city)) {
                  form.setValue("city", "", { shouldValidate: true, shouldDirty: true });
                }
              }}
            >
              <option value="">Select state</option>
              {stateOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <FieldError message={errors.state?.message} />
          </div>
          <div>
            <Label required>Country</Label>
            <select {...form.register("country")} className={fieldClass(!!errors.country)}>
              {ACCOUNT_COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <FieldError message={errors.country?.message} />
          </div>
          <div>
            <Label required>Region</Label>
            <input
              readOnly
              {...form.register("region")}
              className={fieldClass(!!errors.region, true)}
              tabIndex={-1}
            />
            <FieldError message={errors.region?.message} />
          </div>
        </div>
      </Section>

      <Section title="Owner" description="Primary account owner details.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-3 md:col-span-1">
            <Label required>Owner name</Label>
            <input
              {...form.register("ownerName")}
              className={fieldClass(!!errors.ownerName)}
            />
            <FieldError message={errors.ownerName?.message} />
          </div>
          <div>
            <Label required>Owner number</Label>
            <input
              type="tel"
              {...form.register("ownerPhone")}
              className={fieldClass(!!errors.ownerPhone)}
            />
            <FieldError message={errors.ownerPhone?.message} />
          </div>
          <div>
            <Label required>Owner email</Label>
            <input
              type="email"
              {...form.register("ownerEmail")}
              className={fieldClass(!!errors.ownerEmail)}
            />
            <FieldError message={errors.ownerEmail?.message} />
          </div>
        </div>
      </Section>

      <Section title="Point of contact" description="Day-to-day POC for onboarding and support.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label required>POC name</Label>
            <input {...form.register("pocName")} className={fieldClass(!!errors.pocName)} />
            <FieldError message={errors.pocName?.message} />
          </div>
          <div>
            <Label required>POC number</Label>
            <input
              type="tel"
              {...form.register("pocMobile")}
              className={fieldClass(!!errors.pocMobile)}
            />
            <FieldError message={errors.pocMobile?.message} />
          </div>
          <div>
            <Label required>POC email</Label>
            <input
              type="email"
              {...form.register("pocEmail")}
              className={fieldClass(!!errors.pocEmail)}
            />
            <FieldError message={errors.pocEmail?.message} />
          </div>
        </div>
      </Section>

      <Section title="Internal team" description="Assign CRM managers for this account.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label required>Sales manager</Label>
            <select
              {...form.register("salesManagerName")}
              className={fieldClass(!!errors.salesManagerName)}
            >
              <option value="">Select manager</option>
              {managers.map((u) => (
                <option key={u.id} value={u.name}>
                  {u.name}
                </option>
              ))}
            </select>
            <FieldError message={errors.salesManagerName?.message} />
          </div>
          <div>
            <Label required>Support manager 1</Label>
            <select
              {...form.register("supportManager1")}
              className={fieldClass(!!errors.supportManager1)}
            >
              <option value="">Select manager</option>
              {managers.map((u) => (
                <option key={u.id} value={u.name}>
                  {u.name}
                </option>
              ))}
            </select>
            <FieldError message={errors.supportManager1?.message} />
          </div>
          <div>
            <Label>Support manager 2</Label>
            <select {...form.register("supportManager2")} className={fieldClass()}>
              <option value="">Optional</option>
              {managers.map((u) => (
                <option key={u.id} value={u.name}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {managers.length === 0 ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            No CRM users found. Add CRM users in Settings to populate these dropdowns.
          </p>
        ) : null}
      </Section>

      <Section title="Commercial" description="License seats, deal value, and contract dates.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label required>Users purchased</Label>
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
            <Label required>Total deal value (₹)</Label>
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
            <Label required>Pending amount (₹)</Label>
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
            <Label required>Start date</Label>
            <DatePickerField
              modal
              className="mt-1.5"
              value={form.watch("startDate") ?? ""}
              onChange={(v) =>
                form.setValue("startDate", v, { shouldValidate: true, shouldDirty: true })
              }
            />
            <FieldError message={errors.startDate?.message} />
          </div>
          <div>
            <Label required>End date</Label>
            <DatePickerField
              modal
              className="mt-1.5"
              value={form.watch("endDate") ?? ""}
              onChange={(v) =>
                form.setValue("endDate", v, { shouldValidate: true, shouldDirty: true })
              }
            />
            <FieldError message={errors.endDate?.message} />
          </div>
        </div>
      </Section>
    </div>
  );
}
