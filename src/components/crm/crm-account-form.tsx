import { useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";
import { z } from "zod";

import { DatePickerField } from "@/components/date-picker-field";
import { CrmAccountCommercialFields } from "@/components/crm/crm-account-commercial-fields";
import { CrmAccountLocationFields } from "@/components/crm/crm-account-location-fields";
import { CrmAccountProductModulesPicker } from "@/components/crm/crm-account-product-modules-picker";
import {
  buildInstallmentSchedule,
  calcInstallmentAmount,
  calcValuePerUser,
  installmentBaseAmount,
  roundMoney,
} from "@/lib/crm-account-commercial";
import { normalizePortalSlug, portalDashboardPath } from "@/lib/design-ticket-portal";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/stores";
import { COMPANY_TYPES, type CompanyRegion, type CompanyType } from "@/types/company";
import type { CrmAccount } from "@/types/crm-account";
import type { CrmProductModuleKey } from "@/types/crm-onboarding";
import type { CrmAccountInstallment } from "@/types/crm-account";

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
  dealSize: z.coerce.number().min(0),
  valuePerUser: z.coerce.number().min(0).optional(),
  pendingAmount: z.coerce.number().min(0),
  installmentCount: z.coerce.number().int().min(0).optional(),
  installmentAmount: z.coerce.number().min(0).optional(),
  installments: z
    .array(
      z.object({
        amount: z.coerce.number().min(0),
        dueDate: z.string(),
      }),
    )
    .optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  portalApiKey: z.string().optional(),
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
    valuePerUser: 0,
    pendingAmount: 0,
    installmentCount: 0,
    installmentAmount: 0,
    installments: [] as CrmAccountInstallment[],
    startDate: today,
    endDate: end,
    portalApiKey: "",
  };
}

export function crmAccountToFormValues(account: CrmAccount): CrmAccountFormValues {
  const ownerName = account.ownerName ?? account.contact;
  const ownerPhone = account.ownerPhone ?? account.phone;
  const ownerEmail = account.ownerEmail ?? account.email;
  const deal = account.dealSize ?? account.totalCost ?? 0;
  const users = account.usersPurchased ?? 1;
  const pending = account.pendingAmount ?? 0;
  const installments = account.installments ?? [];
  const installmentCount = account.installmentCount ?? installments.length;
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
    usersPurchased: users,
    dealSize: deal,
    valuePerUser: account.valuePerUser ?? calcValuePerUser(deal, users),
    pendingAmount: pending,
    installmentCount,
    installmentAmount:
      installments[0]?.amount ??
      calcInstallmentAmount(installmentBaseAmount(deal, pending), installmentCount),
    installments,
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
  const usersPurchased = Number(data.usersPurchased) || 1;
  const pendingAmount = Number(data.pendingAmount) || 0;
  const valuePerUser =
    data.valuePerUser != null && !Number.isNaN(Number(data.valuePerUser))
      ? roundMoney(Number(data.valuePerUser))
      : calcValuePerUser(dealSize, usersPurchased);
  const installmentCount = Math.max(0, Math.floor(Number(data.installmentCount) || 0));
  const installments = (data.installments ?? []).map((row) => ({
    amount: roundMoney(Number(row.amount) || 0),
    dueDate: row.dueDate.slice(0, 10),
  }));
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
    usersPurchased,
    dealSize,
    valuePerUser,
    totalCost: dealSize,
    pendingAmount,
    paymentReceived: Math.max(0, roundMoney(dealSize - pendingAmount)),
    installmentCount: installmentCount || undefined,
    installments: installments.length > 0 ? installments : undefined,
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
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-card/40 p-3.5 sm:p-4">
      <div className="mb-3">
        <h3 className="text-xs font-semibold tracking-wide text-foreground">{title}</h3>
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

export function CrmAccountFormFields({
  form,
  showModulePicker,
  showPortalApiKey,
  selectedModules,
  onSelectedModulesChange,
}: {
  form: UseFormReturn<CrmAccountFormValues>;
  showModulePicker?: boolean;
  showPortalApiKey?: boolean;
  selectedModules?: CrmProductModuleKey[];
  onSelectedModulesChange?: (keys: CrmProductModuleKey[]) => void;
}) {
  const errors = form.formState.errors;
  const users = useUserStore((s) => s.users);
  const portalApiKey = form.watch("portalApiKey");
  const portalSlugPreview = portalApiKey?.trim()
    ? normalizePortalSlug(portalApiKey)
    : "";

  const salesManagerName = form.watch("salesManagerName");
  const supportManager1 = form.watch("supportManager1");
  const supportManager2 = form.watch("supportManager2");

  const managers = useMemo(() => {
    const base = users
      .filter((u) => u.active && u.productScope === "crm")
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
    const names = new Set(base.map((u) => u.name));
    const extras = [salesManagerName, supportManager1, supportManager2]
      .map((n) => (n ?? "").trim())
      .filter((n) => n.length > 0 && !names.has(n));
    return [...extras.map((name) => ({ id: `legacy-${name}`, name })), ...base];
  }, [users, salesManagerName, supportManager1, supportManager2]);

  return (
    <div className="grid gap-3.5">
      <Section title="Account">
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
          {showPortalApiKey ? (
            <div>
              <Label required>Portal API key</Label>
              <input
                {...form.register("portalApiKey")}
                placeholder="e.g. capital-infra or 126371"
                className={fieldClass(!!errors.portalApiKey)}
              />
              <FieldError message={errors.portalApiKey?.message} />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Used as the client portal URL slug
                {portalSlugPreview ? (
                  <>
                    {" "}
                    — <code className="rounded bg-muted px-1">{portalDashboardPath(portalSlugPreview)}</code>
                  </>
                ) : null}
              </p>
            </div>
          ) : null}
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

      <Section title="Location">
        <CrmAccountLocationFields
          form={form}
          fieldClass={fieldClass}
          Label={Label}
          FieldError={FieldError}
        />
      </Section>

      <Section title="Owner">
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

      <Section title="Point of contact">
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

      <Section title="Internal team">
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

      <Section title="Commercial">
        <CrmAccountCommercialFields form={form} />
      </Section>

      {showModulePicker && selectedModules && onSelectedModulesChange ? (
        <Section title="Modules">
          <CrmAccountProductModulesPicker
            selected={selectedModules}
            onChange={onSelectedModulesChange}
          />
        </Section>
      ) : null}
    </div>
  );
}
