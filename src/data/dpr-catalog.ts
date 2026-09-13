/** Single source of truth for DPR categories/subcategories (API + validation). */

export const DPR_CATEGORY_SUBCATEGORIES = {
  CRM: [
    "Client Onboarding",
    "Admin Account Creation",
    "Welcome Mail",
    "WhatsApp Group",
    "Software Setup",
    "Lead Assignment",
    "CRM Group Monitoring",
  ],
  ERP: [
    "Client Onboarding",
    "Data Collection",
    "Project Setup",
    "Unit Sheet",
    "Customer Sheet",
    "Payment Sheet",
    "Data Upload/Migration/Integration",
    "ERP Training",
    "ERP Query Resolution",
    "ERP Tracker Update",
    "ERP Group Monitoring",
  ],
  "Construction Management": [
    "Supplier Data/Sheet",
    "Supplier Upload",
    "Contractor Setup",
    "Product Purchase Order",
    "Data Integration",
  ],
  "Management & Coordination": [
    "Meetings",
    "Client Follow-ups",
    "Team Coordination",
    "Query Resolution",
    "Customer Success Tracker",
    "Daily Monitoring",
  ],
} as const;

export type DprCatalogCategory = keyof typeof DPR_CATEGORY_SUBCATEGORIES;

export const DPR_CATALOG_CATEGORIES = Object.keys(
  DPR_CATEGORY_SUBCATEGORIES,
) as DprCatalogCategory[];

export function isValidDprCategory(value: string): value is DprCatalogCategory {
  return value in DPR_CATEGORY_SUBCATEGORIES;
}

export function isValidDprSubcategory(category: string, subcategory: string): boolean {
  if (!isValidDprCategory(category)) return false;
  return (DPR_CATEGORY_SUBCATEGORIES[category] as readonly string[]).includes(subcategory);
}

export type DprTemplateSeed = {
  id: string;
  category: DprCatalogCategory;
  subcategory: string;
  templateName: string;
  description: string;
  steps: string[];
};

export const DPR_TEMPLATE_SEEDS: DprTemplateSeed[] = [
  {
    id: "dpr-tpl-crm-client-onboarding",
    category: "CRM",
    subcategory: "Client Onboarding",
    templateName: "Client Onboarding Checklist",
    description: "Standard CRM client onboarding sequence",
    steps: [
      "Send onboarding email",
      "Create admin account",
      "Send welcome mail with credentials",
      "Create WhatsApp group",
      "Complete initial software setup",
    ],
  },
  {
    id: "dpr-tpl-erp-client-onboarding",
    category: "ERP",
    subcategory: "Client Onboarding",
    templateName: "ERP Client Onboarding Checklist",
    description: "Standard ERP client onboarding sequence",
    steps: [
      "Collect required data",
      "Verify/organize data",
      "Set up ERP project",
      "Prepare unit sheet",
      "Integrate customer sheet",
      "Integrate payment sheet",
    ],
  },
];
