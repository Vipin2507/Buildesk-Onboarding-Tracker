import type { CompanyModule, ModuleKey, PostSalesStep } from "@/types/module";
import { newId } from "@/types/common";

export type ModuleCatalogEntry = {
  key: ModuleKey;
  label: string;
  description: string;
  icon: "layers" | "truck" | "hardhat" | "smartphone" | "building" | "boxes";
};

export const MODULE_CATALOG: ModuleCatalogEntry[] = [
  {
    key: "post-sales",
    label: "Post Sales",
    description: "Unit, payment, documents and customer data onboarding per project.",
    icon: "layers",
  },
  {
    key: "vendor-management",
    label: "Vendor Management",
    description: "Materials, suppliers, POs and contractors.",
    icon: "truck",
  },
  {
    key: "labor-management",
    label: "Labor Management",
    description: "Workforce, attendance and payroll readiness.",
    icon: "hardhat",
  },
  {
    key: "customer-app",
    label: "Customer App",
    description: "White-label or Buildesk customer application setup.",
    icon: "smartphone",
  },
  {
    key: "construction-management",
    label: "Construction Management",
    description: "Site progress, BOQ and work order tracking.",
    icon: "building",
  },
  {
    key: "project-management",
    label: "Project Management",
    description: "Milestones, risks and delivery governance.",
    icon: "boxes",
  },
];

export const DEFAULT_POST_SALES_STEPS: Array<{
  key: string;
  label: string;
  requiresTemplate: boolean;
}> = [
  { key: "unit-details", label: "Unit Details", requiresTemplate: true },
  { key: "payment-details", label: "Payment Details", requiresTemplate: true },
  { key: "payment-plan", label: "Payment Plan", requiresTemplate: false },
  { key: "documents", label: "Documents", requiresTemplate: true },
  { key: "customer-data", label: "Customer Data", requiresTemplate: true },
];

export function buildDefaultPostSalesSteps(): PostSalesStep[] {
  return DEFAULT_POST_SALES_STEPS.map((s, i) => ({
    id: newId(),
    key: s.key,
    label: s.label,
    requiresTemplate: s.requiresTemplate,
    templateStatus: s.requiresTemplate ? "not-sent" : "not-required",
    uploadStatus: "not-uploaded",
    approvalStatus: "not-submitted",
    order: i + 1,
  }));
}

/** Build steps from Master Config (falls back to catalog when empty). */
export function buildPostSalesStepsFromDefs(
  defs: Array<{ key: string; label: string; requiresTemplate: boolean }>,
): PostSalesStep[] {
  const source = defs.length > 0 ? defs : DEFAULT_POST_SALES_STEPS;
  return source.map((s, i) => ({
    id: newId(),
    key: s.key,
    label: s.label,
    requiresTemplate: s.requiresTemplate,
    templateStatus: s.requiresTemplate ? "not-sent" : "not-required",
    uploadStatus: "not-uploaded",
    approvalStatus: "not-submitted",
    order: i + 1,
  }));
}

export function getModuleLabel(key: ModuleKey): string {
  return MODULE_CATALOG.find((m) => m.key === key)?.label ?? key;
}

export function createCompanyModules(optedKeys: ModuleKey[], optedOnDate?: string) {
  return MODULE_CATALOG.map((m) => ({
    moduleKey: m.key,
    label: m.label,
    optedIn: optedKeys.includes(m.key),
    optedOnDate: optedKeys.includes(m.key) ? (optedOnDate ?? new Date().toISOString().slice(0, 10)) : undefined,
    liveAt: undefined as string | undefined,
    pocName: undefined as string | undefined,
    pocMobile: undefined as string | undefined,
  }));
}

function legacyModuleStringToKey(value: string): ModuleKey | null {
  const v = value.toLowerCase();
  if (v.includes("post")) return "post-sales";
  if (v.includes("vendor")) return "vendor-management";
  if (v.includes("labor")) return "labor-management";
  if (v.includes("customer app")) return "customer-app";
  if (v.includes("construction")) return "construction-management";
  if (v.includes("project management")) return "project-management";
  return null;
}

/** Merge stored modules onto full catalog so empty DB never blanks the Modules tab. */
export function normalizeCompanyModules(input: unknown): CompanyModule[] {
  const catalog = createCompanyModules([]);

  if (!Array.isArray(input) || input.length === 0) {
    return catalog;
  }

  // New shape: CompanyModule[]
  if (input.every((x) => x && typeof x === "object" && "moduleKey" in (x as object))) {
    const byKey = new Map(
      (input as CompanyModule[])
        .filter((m) => m && typeof m === "object" && MODULE_CATALOG.some((c) => c.key === m.moduleKey))
        .map((m) => [
          m.moduleKey,
          {
            moduleKey: m.moduleKey,
            label: m.label ?? getModuleLabel(m.moduleKey),
            optedIn: Boolean(m.optedIn),
            optedOnDate: m.optedOnDate,
            liveAt: m.liveAt,
            pocName: m.pocName,
            pocMobile: m.pocMobile,
          } satisfies CompanyModule,
        ]),
    );
    return catalog.map((base) => byKey.get(base.moduleKey) ?? base);
  }

  // Legacy shape: string[]
  if (input.every((x) => typeof x === "string")) {
    const keys = (input as string[]).map((s) => legacyModuleStringToKey(s)).filter(Boolean) as ModuleKey[];
    return createCompanyModules(keys);
  }

  return catalog;
}
