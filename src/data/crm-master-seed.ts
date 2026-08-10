import type {
  CrmMasterFieldDef,
  CrmMasterModuleDef,
  CrmMasterPicklist,
  CrmMasterPlatformSettings,
} from "@/types/crm-master";
import { newId, nowIso } from "@/types/common";
import { CRM_PRODUCT_MODULES } from "@/data/crm-onboarding-defaults";

function stampField(
  partial: Omit<CrmMasterFieldDef, "id" | "createdAt" | "updatedAt"> & { id?: string },
): CrmMasterFieldDef {
  const now = nowIso();
  return { ...partial, id: partial.id ?? newId(), createdAt: now, updatedAt: now };
}

export const CRM_SEED_PLATFORM: CrmMasterPlatformSettings = {
  productName: "Buildesk CRM",
  productTagline: "CRM onboarding, masters, and go-live tracking",
  supportEmail: "crm-support@buildesk.com",
  supportPhone: "+91 80 4123 4567",
  defaultTimezone: "Asia/Kolkata",
  defaultCurrency: "INR",
  locale: "en-IN",
  brandPrimary: "#009BFF",
  registeredAddress: "5th Floor, WeWork Galaxy, Bengaluru, KA 560001",
};

export const CRM_SEED_ACCOUNT_FIELDS: CrmMasterFieldDef[] = [
  stampField({ key: "name", label: "Account Name", type: "text", required: true, enabled: true, order: 1, group: "Profile" }),
  stampField({ key: "companyType", label: "Company Type", type: "select", required: true, enabled: true, order: 2, group: "Profile", options: ["Real Estate Developer", "Channel Partner", "Broker", "Mandate", "CT", "Agent"] }),
  stampField({ key: "city", label: "City", type: "text", required: true, enabled: true, order: 3, group: "Profile" }),
  stampField({ key: "state", label: "State", type: "text", required: true, enabled: true, order: 4, group: "Profile" }),
  stampField({ key: "region", label: "Region", type: "select", required: true, enabled: true, order: 5, group: "Profile", options: ["NCR", "South", "West", "Rest of India"] }),
  stampField({ key: "contact", label: "Contact Person", type: "text", required: true, enabled: true, order: 6, group: "Contact" }),
  stampField({ key: "phone", label: "Phone", type: "phone", required: true, enabled: true, order: 7, group: "Contact" }),
  stampField({ key: "email", label: "Email", type: "email", required: true, enabled: true, order: 8, group: "Contact" }),
  stampField({ key: "pocName", label: "POC Name", type: "text", required: true, enabled: true, order: 9, group: "Contact" }),
  stampField({ key: "usersPurchased", label: "Users Purchased", type: "number", required: true, enabled: true, order: 10, group: "Commercial" }),
  stampField({ key: "dealSize", label: "Deal Size", type: "number", required: true, enabled: true, order: 11, group: "Commercial" }),
  stampField({ key: "startDate", label: "Start Date", type: "date", required: true, enabled: true, order: 12, group: "Commercial" }),
  stampField({ key: "endDate", label: "End Date", type: "date", required: true, enabled: true, order: 13, group: "Commercial" }),
  stampField({ key: "status", label: "Status", type: "select", required: true, enabled: true, order: 14, group: "Tracking", options: ["onboarding", "live", "active", "closed"] }),
];

export const CRM_SEED_PROJECT_FIELDS: CrmMasterFieldDef[] = [
  stampField({ key: "name", label: "Project Name", type: "text", required: true, enabled: true, order: 1, group: "Basics" }),
  stampField({ key: "type", label: "Project Type", type: "select", required: true, enabled: true, order: 2, group: "Basics", options: ["Residential", "Commercial", "Township", "Mixed-use", "Villas"] }),
  stampField({ key: "city", label: "City", type: "text", required: true, enabled: true, order: 3, group: "Location" }),
  stampField({ key: "units", label: "Units", type: "number", required: false, enabled: true, order: 4, group: "Basics" }),
  stampField({ key: "totalTowers", label: "Towers / Blocks", type: "number", required: false, enabled: true, order: 5, group: "Basics" }),
  stampField({ key: "totalFloors", label: "Floors", type: "number", required: false, enabled: true, order: 6, group: "Basics" }),
  stampField({ key: "status", label: "Status", type: "select", required: true, enabled: true, order: 7, group: "Tracking", options: ["not_started", "in_progress", "completed"] }),
];

export const CRM_SEED_PICKLISTS: CrmMasterPicklist[] = [
  {
    id: newId(),
    key: "lead-sources",
    label: "Lead Sources",
    description: "Default source masters for CRM accounts",
    values: ["Website", "Meta Ads", "Google Ads", "99acres", "MagicBricks", "Housing", "Referral", "Walk-in", "Channel Partner"],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: newId(),
    key: "lead-statuses",
    label: "Lead Stages",
    description: "Pipeline stage masters",
    values: ["New", "Contacted", "Qualified", "Site Visit", "Negotiation", "Booked", "Lost", "Junk"],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: newId(),
    key: "follow-up-types",
    label: "Follow-up Types",
    description: "Follow-up masters",
    values: ["Call", "WhatsApp", "Email", "Site Visit", "Meeting", "Document Share"],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: newId(),
    key: "project-types",
    label: "Project Types",
    values: ["Residential", "Commercial", "Township", "Mixed-use", "Villas"],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: newId(),
    key: "team-roles",
    label: "Team Roles",
    values: ["Admin", "Sales Manager", "Sales Executive", "Reception", "CP Manager", "Support"],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: newId(),
    key: "account-statuses",
    label: "Account Statuses",
    values: ["onboarding", "live", "active", "closed"],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];

export const CRM_SEED_MODULES: CrmMasterModuleDef[] = CRM_PRODUCT_MODULES.map((m, i) => ({
  id: newId(),
  key: m.key,
  label: m.label,
  description: `${m.label} product module`,
  enabled: true,
  order: i + 1,
  createdAt: nowIso(),
  updatedAt: nowIso(),
}));
