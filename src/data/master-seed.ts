import type {
  MasterChecklistItemDef,
  MasterFieldDef,
  MasterIntegrationDef,
  MasterModuleDef,
  MasterPicklist,
  MasterPlatformSettings,
  MasterTemplateDef,
  MasterTriggerDef,
  MasterWorkflowStepDef,
} from "@/types";
import { newId, nowIso } from "@/types";
import {
  CHECKLIST_TEMPLATE,
  DOCUMENT_TEMPLATE_NAMES,
  INTEGRATION_NAMES,
  ONBOARDING_SECTIONS,
  TRIGGER_EVENTS,
} from "@/data/constants";
import { DEFAULT_POST_SALES_STEPS, MODULE_CATALOG } from "@/data/module-catalog";

function stamp(partial: Omit<MasterFieldDef, "id" | "createdAt" | "updatedAt"> & { id?: string }): MasterFieldDef {
  const now = nowIso();
  return { ...partial, id: partial.id ?? newId(), createdAt: now, updatedAt: now };
}

export const SEED_PLATFORM: MasterPlatformSettings = {
  productName: "Buildesk Onboarding Tracker",
  productTagline: "Internal onboarding & post-sales tracker",
  supportEmail: "support@buildesk.com",
  defaultTimezone: "Asia/Kolkata",
  defaultCurrency: "INR",
  allowViewerApprovals: false,
  requireRejectionRemarks: true,
  autoLogActivity: true,
};

export const SEED_COMPANY_FIELDS: MasterFieldDef[] = [
  stamp({ key: "name", label: "Company Name", type: "text", required: true, enabled: true, order: 1, group: "Profile", placeholder: "Legal entity name" }),
  stamp({ key: "city", label: "City", type: "text", required: true, enabled: true, order: 2, group: "Profile" }),
  stamp({ key: "officeAddress", label: "Office Address", type: "textarea", required: false, enabled: true, order: 3, group: "Profile" }),
  stamp({ key: "gstNumber", label: "GST Number", type: "text", required: false, enabled: true, order: 4, group: "Profile", placeholder: "22AAAAA0000A1Z5" }),
  stamp({ key: "contact", label: "Contact Person", type: "text", required: true, enabled: true, order: 5, group: "Contact" }),
  stamp({ key: "designation", label: "Designation", type: "text", required: true, enabled: true, order: 6, group: "Contact" }),
  stamp({ key: "email", label: "Email", type: "email", required: true, enabled: true, order: 7, group: "Contact" }),
  stamp({ key: "phone", label: "Phone", type: "phone", required: true, enabled: true, order: 8, group: "Contact" }),
  stamp({ key: "onboardingManagerId", label: "Onboarding Manager", type: "select", required: true, enabled: true, order: 9, group: "Ownership" }),
  stamp({ key: "csmId", label: "CSM", type: "select", required: true, enabled: true, order: 10, group: "Ownership" }),
  stamp({ key: "plan", label: "Plan", type: "select", required: true, enabled: true, order: 11, group: "Commercial", options: ["Starter", "Growth", "Enterprise"] }),
  stamp({ key: "health", label: "Health", type: "select", required: true, enabled: true, order: 12, group: "Commercial", options: ["Healthy", "Moderate", "Critical"] }),
  stamp({ key: "status", label: "Account Status", type: "select", required: true, enabled: true, order: 13, group: "Commercial", options: ["not_started", "in_progress", "review", "completed", "on_hold"] }),
  stamp({ key: "agreementDate", label: "Agreement Date", type: "date", required: true, enabled: true, order: 14, group: "Commercial" }),
  stamp({ key: "goLiveTarget", label: "Go-Live Target", type: "date", required: true, enabled: true, order: 15, group: "Commercial" }),
  stamp({ key: "planExpiry", label: "Plan Expiry", type: "date", required: true, enabled: true, order: 16, group: "Commercial" }),
  stamp({ key: "billingInfo", label: "Billing Info", type: "textarea", required: false, enabled: true, order: 17, group: "Commercial" }),
];

export const SEED_PROJECT_FIELDS: MasterFieldDef[] = [
  stamp({ key: "name", label: "Project Name", type: "text", required: true, enabled: true, order: 1, group: "Basics" }),
  stamp({ key: "companyId", label: "Company", type: "select", required: true, enabled: true, order: 2, group: "Basics" }),
  stamp({ key: "type", label: "Project Type", type: "select", required: true, enabled: true, order: 3, group: "Basics", options: ["Residential", "Commercial", "Township", "Mixed-use", "Villas"] }),
  stamp({ key: "units", label: "Units", type: "number", required: true, enabled: true, order: 4, group: "Basics" }),
  stamp({ key: "city", label: "City", type: "text", required: true, enabled: true, order: 5, group: "Location" }),
  stamp({ key: "rera", label: "RERA Number", type: "text", required: true, enabled: true, order: 6, group: "Location" }),
  stamp({ key: "status", label: "Status", type: "select", required: true, enabled: true, order: 7, group: "Tracking", options: ["not_started", "in_progress", "review", "completed", "on_hold"] }),
  stamp({ key: "address", label: "Site Address", type: "textarea", required: false, enabled: true, order: 8, group: "Location" }),
  stamp({ key: "towers", label: "Towers / Blocks", type: "number", required: false, enabled: false, order: 9, group: "Basics", description: "Optional — enable if your products track towers." }),
];

export const SEED_PICKLISTS: MasterPicklist[] = [
  { id: newId(), key: "company-plans", label: "Company Plans", description: "Commercial plan tiers", values: ["Starter", "Growth", "Enterprise"], createdAt: nowIso(), updatedAt: nowIso() },
  { id: newId(), key: "company-health", label: "Health Scores", values: ["Healthy", "Moderate", "Critical"], createdAt: nowIso(), updatedAt: nowIso() },
  { id: newId(), key: "project-types", label: "Project Types", values: ["Residential", "Commercial", "Township", "Mixed-use", "Villas"], createdAt: nowIso(), updatedAt: nowIso() },
  { id: newId(), key: "ticket-types", label: "Ticket Types", values: ["Bug", "Customization", "Requirement"], createdAt: nowIso(), updatedAt: nowIso() },
  { id: newId(), key: "ticket-priorities", label: "Ticket Priorities", values: ["Critical", "High", "Medium", "Low"], createdAt: nowIso(), updatedAt: nowIso() },
  { id: newId(), key: "ticket-statuses", label: "Kanban Columns", values: ["New", "Assigned", "In Progress", "QA", "Ready for Release", "Released", "Closed"], createdAt: nowIso(), updatedAt: nowIso() },
  { id: newId(), key: "training-types", label: "Training Types", values: ["Admin", "Sales", "Accounts", "CP Team", "Management"], createdAt: nowIso(), updatedAt: nowIso() },
  { id: newId(), key: "user-roles", label: "User Roles", values: ["Admin", "Manager", "Viewer"], createdAt: nowIso(), updatedAt: nowIso() },
  { id: newId(), key: "document-categories", label: "Document Categories", values: ["Legal", "Billing", "Handover", "Sales", "Customer", "General"], createdAt: nowIso(), updatedAt: nowIso() },
];

export const SEED_WORKFLOW_STEPS: MasterWorkflowStepDef[] = DEFAULT_POST_SALES_STEPS.map((s, i) => ({
  id: newId(),
  key: s.key,
  label: s.label,
  requiresTemplate: s.requiresTemplate,
  templateName: s.requiresTemplate ? `${s.label} Template.xlsx` : undefined,
  enabled: true,
  order: i + 1,
  description: s.requiresTemplate ? "Customer fills template, then data is uploaded for approval." : "No template required — upload or configure then approve.",
  createdAt: nowIso(),
  updatedAt: nowIso(),
}));

export const SEED_CHECKLIST: MasterChecklistItemDef[] = ONBOARDING_SECTIONS.flatMap((section, si) =>
  (CHECKLIST_TEMPLATE[section.key] ?? []).map((label, li) => ({
    id: newId(),
    sectionKey: section.key,
    sectionLabel: section.label,
    label,
    enabled: true,
    order: si * 100 + li + 1,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  })),
);

export const SEED_TEMPLATES: MasterTemplateDef[] = DOCUMENT_TEMPLATE_NAMES.map((d, i) => ({
  id: newId(),
  name: d.name,
  category: d.category,
  enabled: true,
  order: i + 1,
  description: `${d.category} document used during go-live preparation.`,
  createdAt: nowIso(),
  updatedAt: nowIso(),
}));

export const SEED_MODULES: MasterModuleDef[] = MODULE_CATALOG.map((m, i) => ({
  id: newId(),
  key: m.key,
  label: m.label,
  description: m.description,
  icon: m.icon,
  enabled: true,
  order: i + 1,
  createdAt: nowIso(),
  updatedAt: nowIso(),
}));

export const SEED_INTEGRATIONS: MasterIntegrationDef[] = INTEGRATION_NAMES.map((x, i) => ({
  id: newId(),
  name: x.name,
  description: x.description,
  enabled: true,
  order: i + 1,
  createdAt: nowIso(),
  updatedAt: nowIso(),
}));

export const SEED_TRIGGERS: MasterTriggerDef[] = TRIGGER_EVENTS.map((t, i) => ({
  id: newId(),
  name: t.name,
  event: t.event,
  channel: t.channel,
  enabled: true,
  order: i + 1,
  createdAt: nowIso(),
  updatedAt: nowIso(),
}));
