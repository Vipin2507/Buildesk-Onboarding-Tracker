import type {
  ActivityEntry,
  ApprovalFlow,
  AttendanceRecord,
  BOQ,
  Company,
  Contractor,
  CustomerAppConfig,
  CustomerRecord,
  DocumentTemplate,
  Employee,
  EmployeeRole,
  Integration,
  Labor,
  Material,
  OnboardingChecklistItem,
  OtherCharge,
  PaymentRecord,
  Project,
  PurchaseOrder,
  Supplier,
  Ticket,
  TrainingSession,
  Trigger,
  UnitUpload,
  User,
  WorkOrder,
} from "@/types";
import type { StatusKey } from "@/types/common";
import { newId, nowIso } from "@/types/common";
import {
  CHECKLIST_TEMPLATE,
  DOCUMENT_TEMPLATE_NAMES,
  INTEGRATION_NAMES,
  MODULES,
  TRIGGER_EVENTS,
} from "./constants";

const ts = nowIso();

const managers = ["Aarav Mehta", "Priya Sharma", "Rohan Iyer", "Neha Kapoor", "Vikram Rao", "Ishita Verma"];
const csms = ["Karan Shah", "Ananya Nair", "Devansh Patel", "Meera Joshi"];
const cities = ["Mumbai", "Pune", "Bengaluru", "Hyderabad", "Ahmedabad", "Gurugram", "Chennai", "Kolkata", "Noida", "Jaipur"];
const statuses: StatusKey[] = ["in_progress", "review", "completed", "not_started", "on_hold", "in_progress", "completed", "in_progress"];
const healths = ["Healthy", "Moderate", "Critical"] as const;
const plans = ["Starter", "Growth", "Enterprise"] as const;

const brands = [
  "Sunrise Developers", "Skyline Realty", "Green Meadows Group", "Oceanic Estates", "Prestige Horizon",
  "Aurum Buildcon", "Kalpataru Signature", "Riverstone Habitat", "Marigold Infrastructure", "Elite Landmark",
  "Silverline Housing", "Panorama Realtors", "Terra Nova Builders", "Highrise Ventures", "Emerald Enclave",
];

export const seedEmployees: Employee[] = managers.map((name, i) => ({
  id: `emp-${i + 1}`,
  name,
  role: (i % 2 === 0 ? "Onboarding Manager" : "Implementation Lead") as EmployeeRole,
  region: ["West", "South", "North"][i % 3],
  email: `${name.toLowerCase().replace(/\s+/g, ".")}@buildesk.com`,
  createdAt: ts,
  updatedAt: ts,
})).concat(
  csms.map((name, i) => ({
    id: `emp-csm-${i + 1}`,
    name,
    role: "CSM" as const,
    region: ["West", "South", "North", "West"][i % 4],
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@buildesk.com`,
    createdAt: ts,
    updatedAt: ts,
  })),
);

export const seedUsers: User[] = [
  { id: "user-1", name: "Aditya Kulkarni", email: "aditya@buildesk.com", role: "Admin", active: true, createdAt: ts, updatedAt: ts },
  { id: "user-2", name: "Priya Sharma", email: "priya@buildesk.com", role: "Manager", active: true, createdAt: ts, updatedAt: ts },
  { id: "user-3", name: "Rohan Iyer", email: "rohan@buildesk.com", role: "Manager", active: true, createdAt: ts, updatedAt: ts },
  { id: "user-4", name: "Neha Kapoor", email: "neha@buildesk.com", role: "Viewer", active: true, createdAt: ts, updatedAt: ts },
];

export const seedCompanies: Company[] = brands.map((name, i) => {
  const modulesCount = 3 + (i % 5);
  const modules = MODULES.slice(0, modulesCount);
  const progress = [15, 32, 48, 60, 75, 88, 100, 22, 55, 70, 45, 92, 12, 66, 80][i];
  return {
    id: `co-${i + 1}`,
    name,
    contact: ["Rajesh Kumar", "Sneha Rao", "Amit Bhatt", "Kavita Reddy", "Sanjay Menon"][i % 5],
    designation: ["Director", "CEO", "COO", "VP - Sales", "GM"][i % 5],
    phone: `+91 9${String(800000000 + i * 12345).slice(0, 9)}`,
    email: `contact@${name.toLowerCase().replace(/\s+/g, "")}.com`,
    city: cities[i % cities.length],
    onboardingManagerId: seedEmployees[i % managers.length].id,
    csmId: seedEmployees[managers.length + (i % csms.length)].id,
    status: progress >= 100 ? "completed" : statuses[i % statuses.length],
    modules: [...modules],
    agreementDate: `2024-${String(1 + (i % 12)).padStart(2, "0")}-${String(5 + (i % 20)).padStart(2, "0")}`,
    goLiveTarget: `2025-${String(1 + ((i + 3) % 12)).padStart(2, "0")}-15`,
    planExpiry: `2026-${String(1 + (i % 12)).padStart(2, "0")}-20`,
    plan: plans[i % 3],
    health: healths[i % 3],
    createdAt: ts,
    updatedAt: ts,
  };
});

const projTypes = ["Residential", "Commercial", "Township", "Mixed-use", "Villas"];

export const seedProjects: Project[] = seedCompanies.flatMap((c, ci) =>
  Array.from({ length: 1 + (ci % 4) }).map((_, pi) => ({
    id: `pr-${ci}-${pi}`,
    name: `${c.name.split(" ")[0]} ${["Heights", "Grove", "Residency", "Square", "Bay"][pi % 5]}`,
    companyId: c.id,
    type: projTypes[(ci + pi) % projTypes.length],
    units: 60 + ((ci * 37 + pi * 19) % 400),
    city: c.city,
    rera: `P5${(1000 + ci * 10 + pi).toString()}0002024`,
    status: c.status,
    currentStep: (ci + pi) % 8,
    createdAt: ts,
    updatedAt: ts,
  })),
);

export function buildChecklistForProject(projectId: string): OnboardingChecklistItem[] {
  const items: OnboardingChecklistItem[] = [];
  let seed = projectId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const rand = () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return seed / 2147483647;
  };
  for (const [section, labels] of Object.entries(CHECKLIST_TEMPLATE)) {
    for (const label of labels) {
      const r = rand();
      items.push({
        id: newId(),
        projectId,
        section,
        label,
        collected: r > 0.3,
        uploaded: r > 0.5,
        live: r > 0.7,
        remarks: "",
        createdAt: ts,
        updatedAt: ts,
      });
    }
  }
  return items;
}

export const seedChecklistItems: OnboardingChecklistItem[] = seedProjects.flatMap((p) =>
  buildChecklistForProject(p.id),
);

export const seedOtherCharges: OtherCharge[] = seedProjects.slice(0, 5).flatMap((p, i) => [
  {
    id: `oc-${i}-1`,
    projectId: p.id,
    name: "Club Membership",
    amount: 50000 + i * 10000,
    type: "One-time",
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: `oc-${i}-2`,
    projectId: p.id,
    name: "Parking",
    amount: 250000 + i * 5000,
    type: "Per Unit",
    createdAt: ts,
    updatedAt: ts,
  },
]);

export const seedTickets: Ticket[] = Array.from({ length: 22 }).map((_, i) => {
  const types = ["Bug", "Customization", "Requirement"] as const;
  const priorities = ["Critical", "High", "Medium", "Low"] as const;
  const ticketStatuses = ["New", "Assigned", "In Progress", "QA", "Ready for Release", "Released", "Closed"] as const;
  const company = seedCompanies[i % seedCompanies.length];
  return {
    id: `TKT-${1000 + i}`,
    type: types[i % 3],
    title: [
      "Payment plan mismatch on unit A-402",
      "Add bulk demand generation",
      "White label build fails on iOS",
      "SMS trigger not firing on booking",
      "WATI template rejected",
      "Vendor PO approval loop stuck",
      "Excel export truncates 500+ rows",
      "Custom dashboard tile request",
    ][i % 8],
    priority: priorities[i % 4],
    status: ticketStatuses[i % ticketStatuses.length],
    raisedOn: `2025-0${1 + (i % 9)}-1${i % 9}`,
    eta: `2025-0${1 + ((i + 2) % 9)}-2${i % 9}`,
    developerId: seedEmployees[i % managers.length].id,
    companyId: company.id,
    createdAt: ts,
    updatedAt: ts,
  };
});

export const seedActivity: ActivityEntry[] = [
  { id: newId(), who: "Priya Sharma", what: "Marked Sunrise Heights as Go Live", kind: "success", companyId: "co-1", projectId: "pr-0-0", createdAt: new Date(Date.now() - 600000).toISOString(), updatedAt: new Date(Date.now() - 600000).toISOString() },
  { id: newId(), who: "Rohan Iyer", what: "Uploaded Customer Data for Skyline Residency", kind: "info", companyId: "co-2", createdAt: new Date(Date.now() - 3600000).toISOString(), updatedAt: new Date(Date.now() - 3600000).toISOString() },
  { id: newId(), who: "System", what: "Renewal reminder sent to Green Meadows Group", kind: "warning", companyId: "co-3", createdAt: new Date(Date.now() - 7200000).toISOString(), updatedAt: new Date(Date.now() - 7200000).toISOString() },
  { id: newId(), who: "Neha Kapoor", what: "Customization TKT-1008 moved to QA", kind: "info", createdAt: new Date(Date.now() - 18000000).toISOString(), updatedAt: new Date(Date.now() - 18000000).toISOString() },
  { id: newId(), who: "Aarav Mehta", what: "Verified payment plan for Oceanic Bay", kind: "success", companyId: "co-4", createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: newId(), who: "Ishita Verma", what: "Bug TKT-1003 marked critical", kind: "danger", createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: newId(), who: "Vikram Rao", what: "Training completed for Prestige Horizon", kind: "success", companyId: "co-5", createdAt: new Date(Date.now() - 172800000).toISOString(), updatedAt: new Date(Date.now() - 172800000).toISOString() },
];

export const seedTrainingSessions: TrainingSession[] = [
  { id: newId(), type: "Admin", trainerId: seedEmployees[1].id, companyId: "co-1", date: "2025-04-12", attendance: "6/6", recording: "https://recordings.buildesk.com/admin-1", status: "Completed", createdAt: ts, updatedAt: ts },
  { id: newId(), type: "Sales", trainerId: seedEmployees[0].id, companyId: "co-2", date: "2025-04-15", attendance: "12/14", recording: "https://recordings.buildesk.com/sales-1", status: "Completed", createdAt: ts, updatedAt: ts },
  { id: newId(), type: "Accounts", trainerId: seedEmployees[2].id, companyId: "co-3", date: "2025-04-18", attendance: "4/5", recording: "https://recordings.buildesk.com/accounts-1", status: "In Progress", createdAt: ts, updatedAt: ts },
  { id: newId(), type: "CP Team", trainerId: seedEmployees[3].id, companyId: "co-4", date: "2025-04-22", attendance: "—", recording: "—", status: "Scheduled", createdAt: ts, updatedAt: ts },
  { id: newId(), type: "Management", trainerId: seedEmployees[4].id, companyId: "co-5", date: "2025-04-25", attendance: "—", recording: "—", status: "Scheduled", createdAt: ts, updatedAt: ts },
];

export const seedLabor: Labor[] = Array.from({ length: 10 }).map((_, i) => ({
  id: `LB-${200 + i}`,
  name: `${["Ramesh", "Suresh", "Mahesh", "Dinesh", "Ganesh", "Naresh", "Umesh", "Yogesh", "Rakesh", "Mukesh"][i]} ${["Yadav", "Kumar", "Singh"][i % 3]}`,
  role: ["Mason", "Helper", "Electrician", "Plumber", "Foreman"][i % 5],
  phone: `+91 90${String(10000000 + i * 111).slice(0, 8)}`,
  createdAt: ts,
  updatedAt: ts,
}));

export const seedAttendance: AttendanceRecord[] = [
  { id: newId(), fileName: "attendance_april_week1.xlsx", uploadedAt: ts, recordCount: 142, createdAt: ts, updatedAt: ts },
  { id: newId(), fileName: "attendance_april_week2.xlsx", uploadedAt: ts, recordCount: 138, createdAt: ts, updatedAt: ts },
];

export const seedMaterials: Material[] = [
  { id: newId(), name: "OPC 53 Cement", category: "Cement", unit: "Bag", createdAt: ts, updatedAt: ts },
  { id: newId(), name: "TMT Bar 12mm", category: "Steel", unit: "Ton", createdAt: ts, updatedAt: ts },
  { id: newId(), name: "River Sand", category: "Aggregate", unit: "CFT", createdAt: ts, updatedAt: ts },
  { id: newId(), name: "Red Bricks", category: "Masonry", unit: "Nos", createdAt: ts, updatedAt: ts },
  { id: newId(), name: "Vitrified Tiles 600x600", category: "Finishes", unit: "Sqft", createdAt: ts, updatedAt: ts },
];

export const seedSuppliers: Supplier[] = [
  { id: newId(), name: "UltraTech Cement Ltd", contact: "Anil Menon", phone: "+91 9820011122", createdAt: ts, updatedAt: ts },
  { id: newId(), name: "Tata Steel Distributor", contact: "Suraj Pillai", phone: "+91 9820011133", createdAt: ts, updatedAt: ts },
  { id: newId(), name: "Bharat Tiles Co", contact: "Meena Iyer", phone: "+91 9820011144", createdAt: ts, updatedAt: ts },
];

export const seedContractors: Contractor[] = [
  { id: newId(), name: "Sagar Civil Works", contact: "Sagar Patil", phone: "+91 9820022211", createdAt: ts, updatedAt: ts },
  { id: newId(), name: "Vertex Interiors", contact: "Ritu Shah", phone: "+91 9820022222", createdAt: ts, updatedAt: ts },
  { id: newId(), name: "Skyline MEP", contact: "Faisal Khan", phone: "+91 9820022233", createdAt: ts, updatedAt: ts },
];

export const seedPurchaseOrders: PurchaseOrder[] = Array.from({ length: 6 }).map((_, i) => ({
  id: newId(),
  number: `PO-${2001 + i}`,
  supplierId: seedSuppliers[i % seedSuppliers.length].id,
  projectId: seedProjects[i % seedProjects.length].id,
  date: `2025-04-${10 + i}`,
  status: (["Pending", "Approved", "Delivered"] as const)[i % 3],
  amount: 50000 + i * 15000,
  createdAt: ts,
  updatedAt: ts,
}));

export const seedWorkOrders: WorkOrder[] = Array.from({ length: 6 }).map((_, i) => ({
  id: newId(),
  number: `WO-${3001 + i}`,
  contractorId: seedContractors[i % seedContractors.length].id,
  projectId: seedProjects[i % seedProjects.length].id,
  date: `2025-04-${10 + i}`,
  status: (["Pending", "Approved", "In Progress"] as const)[i % 3],
  amount: 80000 + i * 20000,
  createdAt: ts,
  updatedAt: ts,
}));

export const seedBOQs: BOQ[] = Array.from({ length: 5 }).map((_, i) => ({
  id: newId(),
  name: `BOQ ${100 + i}`,
  projectId: seedProjects[i % seedProjects.length].id,
  status: i % 2 ? "Submitted" : "Draft",
  createdAt: ts,
  updatedAt: ts,
}));

export const seedApprovalFlows: ApprovalFlow[] = [
  { id: newId(), name: "Purchase Order", stages: ["Requester", "Site Engineer", "Project Manager", "Finance Head"], createdAt: ts, updatedAt: ts },
  { id: newId(), name: "Material Requisition", stages: ["Requester", "Store Manager", "Project Manager"], createdAt: ts, updatedAt: ts },
  { id: newId(), name: "Inward", stages: ["Store Manager", "QA/QC", "Accounts"], createdAt: ts, updatedAt: ts },
  { id: newId(), name: "Bill Approval", stages: ["Accounts", "Project Manager", "Finance Head", "Director"], createdAt: ts, updatedAt: ts },
];

export const seedDocuments: DocumentTemplate[] = DOCUMENT_TEMPLATE_NAMES.map((d, i) => ({
  id: newId(),
  name: d.name,
  category: d.category,
  status: (["Draft", "Approved", "Uploaded", "Tested", "Live"] as const)[i % 5],
  createdAt: ts,
  updatedAt: ts,
}));

export const seedIntegrations: Integration[] = INTEGRATION_NAMES.map((d) => ({
  id: newId(),
  name: d.name,
  description: d.description,
  connected: Math.random() > 0.4,
  tested: Math.random() > 0.5,
  createdAt: ts,
  updatedAt: ts,
}));

export const seedTriggers: Trigger[] = TRIGGER_EVENTS.map((d) => ({
  id: newId(),
  name: d.name,
  event: d.event,
  channel: d.channel,
  active: Math.random() > 0.3,
  createdAt: ts,
  updatedAt: ts,
}));

export const seedCustomerAppConfigs: CustomerAppConfig[] = seedProjects.slice(0, 5).map((p) => ({
  projectId: p.id,
  mode: "buildesk" as const,
  appName: `${p.name} App`,
  primaryColor: "#2563eb",
  logoUrl: "",
  supportEmail: "support@example.com",
  supportPhone: "+91 9876543210",
  publishStatus: "draft" as const,
  createdAt: ts,
  updatedAt: ts,
}));

export const seedUploads: UnitUpload[] = [];
export const seedCustomerRecords: CustomerRecord[] = [];
export const seedPaymentRecords: PaymentRecord[] = [];
