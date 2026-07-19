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
  ModuleKey,
  PostSalesProject,
  User,
  WorkOrder,
  CompanyNote,
  CompanyAttachment,
} from "@/types";
import type { StatusKey } from "@/types/common";
import { newId, nowIso } from "@/types/common";
import {
  CHECKLIST_TEMPLATE,
  DOCUMENT_TEMPLATE_NAMES,
  INTEGRATION_NAMES,
  TRIGGER_EVENTS,
} from "./constants";
import { buildDefaultPostSalesSteps, createCompanyModules } from "./module-catalog";

const ts = nowIso();

const managers = ["Aarav Mehta", "Priya Sharma", "Rohan Iyer", "Neha Kapoor", "Vikram Rao", "Ishita Verma"];
const csms = ["Karan Shah", "Ananya Nair", "Devansh Patel", "Meera Joshi"];
const cities = ["Mumbai", "Pune", "Bengaluru", "Hyderabad", "Ahmedabad", "Gurugram", "Chennai", "Kolkata", "Noida", "Jaipur"];
const statuses: StatusKey[] = ["in_progress", "review", "completed", "not_started", "on_hold", "in_progress", "completed", "in_progress"];
const healths = ["Healthy", "Moderate", "Critical"] as const;
const plans = ["Annual", "Half-Yearly", "AMC"] as const;
const regions = ["NCR", "South", "West", "Rest of India"] as const;

function regionForCity(city: string): (typeof regions)[number] {
  const c = city.toLowerCase();
  if (["delhi", "gurugram", "gurgaon", "noida", "faridabad", "ghaziabad"].some((x) => c.includes(x))) {
    return "NCR";
  }
  if (["bengaluru", "bangalore", "chennai", "hyderabad", "kochi", "coimbatore"].some((x) => c.includes(x))) {
    return "South";
  }
  if (["mumbai", "pune", "ahmedabad", "surat", "nagpur", "goa"].some((x) => c.includes(x))) {
    return "West";
  }
  return "Rest of India";
}

/** Real client roster — name, optional contact/phone, project count. */
const COMPANY_ROSTER: {
  name: string;
  contact?: string;
  phone?: string;
  projectCount: number;
}[] = [
  { name: "Globe Group", projectCount: 18 },
  { name: "Gurukrupa Realcon Builders And Developers", projectCount: 24 },
  { name: "Syscom Edutech Pvt. Ltd.", projectCount: 2 },
  { name: "Dimples Group", projectCount: 4 },
  { name: "Neelam Realtors", projectCount: 15 },
  { name: "AUROBINDO TATTVA HOMES", projectCount: 2 },
  { name: "Safron Flora", projectCount: 1 },
  { name: "Aashrithaa Properties pvt ltd", projectCount: 14 },
  { name: "A K Hitech Associates", projectCount: 1 },
  { name: "E Square Homes", projectCount: 1 },
  { name: "Laxmi Kamal Associates", projectCount: 1 },
  { name: "ROYAL BUILDCON", projectCount: 2 },
  { name: "LMP Group", projectCount: 2 },
  { name: "EMPERIA DEVELOPERS", projectCount: 1 },
  { name: "Balaji Estate", projectCount: 2 },
  { name: "Mastro Realtech Pvt Ltd", projectCount: 2 },
  { name: "JAY SHREE KRISHNA ENTERPRISES", projectCount: 3 },
  { name: "JHA REALTY", projectCount: 3 },
  { name: "Vatsala Land Developers PVT LTD", projectCount: 1 },
  { name: "Sai Yogi Developers", projectCount: 1 },
  { name: "Truearth Developers Pvt Ltd", projectCount: 2 },
  { name: "Bhaveshwar Infra", projectCount: 3 },
  { name: "Brillswroth", projectCount: 1 },
  { name: "Millennium Group", projectCount: 3 },
  { name: "BM ESTATE", projectCount: 1 },
  { name: "BKM MINDSPACE", projectCount: 1 },
  { name: "DAKSH REALTY", projectCount: 6 },
  { name: "Optus Housing", projectCount: 1 },
  { name: "YTT INDUSTRIES", projectCount: 2 },
  { name: "SHIVANI BUILDERS & DEVELOPERS", projectCount: 1 },
  { name: "MULTISTAR BUILDER LLP", projectCount: 1 },
  { name: "Abhilash Synergetic Constructions Exports Pvt. Ltd.", projectCount: 2 },
  { name: "LAXMI GROUP", projectCount: 7 },
  { name: "Ikigai Estates", projectCount: 1 },
  { name: "RIO DREAM CONSTRUCTION LLP", projectCount: 3 },
  { name: "TUV INDIA PVT LTD", projectCount: 2 },
  { name: "MAHADEV GREENS", contact: "Padmini Das", phone: "9938033250", projectCount: 3 },
  { name: "K M DEVELOPERS", contact: "Kushal", phone: "7738615810", projectCount: 2 },
  { name: "TRISHIKA DEVELOPERS LLP", contact: "Jash Bhanushali", phone: "9221615555", projectCount: 1 },
  { name: "Dwelite", contact: "Bismay", phone: "9827959229", projectCount: 3 },
  { name: "ISTA SPACES LLP", contact: "Parbin Singh", phone: "9902230794", projectCount: 10 },
  { name: "JE & VEE INFRASTRUCTURE", contact: "Hitesh Trivedi", phone: "7700998792", projectCount: 9 },
  { name: "LUXESTATES REALTY LLP", contact: "Kartik", phone: "6376972566", projectCount: 1 },
  { name: "VILLA PROJECT - RANA REALTORS", contact: "Bhoomi", phone: "9970690803", projectCount: 2 },
  { name: "MAVERICK REALTORS", contact: "Priya Chaturvedi", phone: "9004624232", projectCount: 2 },
  { name: "NEEL REALTORS", contact: "Bagesh Yadav", phone: "9920164646", projectCount: 1 },
  { name: "KYI SOFT SOLUTIONS PRIVATE LIMITED", contact: "Saurabh Agarwal", phone: "9650549090", projectCount: 1 },
  { name: "APLITE DEVELOPERS LLP", contact: "Mansi Kadam", phone: "9372011205", projectCount: 1 },
  { name: "KIARA GROUP (SANTUSHTI HOUSING LLP)", contact: "Shiv", phone: "9772545298", projectCount: 1 },
  { name: "SANCHAYA LAND AND ESTATE PRIVATE LIMITED", contact: "Vasanth Raju", phone: "9036099342", projectCount: 2 },
  { name: "TRIGUNA PROJECTS", contact: "Jagadeesh Reddy", phone: "9986263959", projectCount: 1 },
  { name: "AKULA LANDMARKS", contact: "Namrata Ankur", phone: "9890309371", projectCount: 11 },
  { name: "Skyboat Infrastructure", projectCount: 1 },
];

function formatPhone(raw?: string) {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return raw.trim();
}

function companyEmail(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 28);
  return `contact@${slug || "buildesk"}.com`;
}

function projectLabel(companyName: string, index: number, total: number) {
  const short = companyName.split(/[\s(-]/).filter(Boolean).slice(0, 2).join(" ");
  if (total === 1) return `${short} — Main Project`;
  return `${short} — Project ${index + 1}`;
}

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
  {
    id: "user-1",
    name: "Aditya Kulkarni",
    email: "aditya@buildesk.com",
    role: "Admin",
    active: true,
    phone: "+91 98765 43210",
    jobTitle: "Head of Implementation",
    department: "Customer Success",
    timezone: "Asia/Kolkata",
    bio: "Owns onboarding quality and go-live readiness for enterprise accounts.",
    notifyEmail: true,
    notifyInApp: true,
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: "user-2",
    name: "Priya Sharma",
    email: "priya@buildesk.com",
    role: "Manager",
    active: true,
    phone: "+91 98111 22334",
    jobTitle: "Onboarding Manager",
    department: "Implementation",
    timezone: "Asia/Kolkata",
    notifyEmail: true,
    notifyInApp: true,
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: "user-3",
    name: "Rohan Iyer",
    email: "rohan@buildesk.com",
    role: "Manager",
    active: true,
    phone: "+91 98222 33445",
    jobTitle: "Implementation Lead",
    department: "Implementation",
    timezone: "Asia/Kolkata",
    notifyEmail: true,
    notifyInApp: false,
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: "user-4",
    name: "Neha Kapoor",
    email: "neha@buildesk.com",
    role: "Viewer",
    active: true,
    phone: "+91 98333 44556",
    jobTitle: "CSM Associate",
    department: "Customer Success",
    timezone: "Asia/Kolkata",
    notifyEmail: false,
    notifyInApp: true,
    createdAt: ts,
    updatedAt: ts,
  },
];

/** Demo passwords for the local prototype — not for production use. */
export const seedCredentials: Record<string, string> = {
  "user-1": "buildesk123",
  "user-2": "buildesk123",
  "user-3": "buildesk123",
  "user-4": "buildesk123",
};

const PRESET_MODULE_KEYS: ModuleKey[][] = [
  ["post-sales", "customer-app", "vendor-management"],
  ["post-sales", "labor-management", "construction-management", "project-management"],
  ["post-sales", "vendor-management", "customer-app", "labor-management"],
  ["post-sales", "customer-app"],
  ["post-sales", "vendor-management", "labor-management", "construction-management", "project-management", "customer-app"],
];

export const seedCompanies: Company[] = COMPANY_ROSTER.map((row, i) => {
  const progressHint = Math.min(100, 8 + ((i * 17) % 93));
  const optedKeys = PRESET_MODULE_KEYS[i % PRESET_MODULE_KEYS.length];
  const phone = formatPhone(row.phone);
  return {
    id: `co-${i + 1}`,
    name: row.name,
    contact: row.contact?.trim() || "To be assigned",
    designation: row.contact ? "Contact Person" : "Pending",
    phone: phone || "—",
    email: companyEmail(row.name),
    city: cities[i % cities.length],
    region: regionForCity(cities[i % cities.length]),
    ownerName: row.contact?.trim() || "Owner TBD",
    ownerMobile: phone || "—",
    pocName: row.contact?.trim() || "To be assigned",
    pocMobile: phone || "—",
    officeAddress: `${100 + i}, Business Park, ${cities[i % cities.length]}`,
    gstNumber: `27AABCU${String(9600 + i).padStart(4, "0")}1Z${i % 10}`,
    billingInfo: `${plans[i % 3]} plan · Annual billing · ${row.projectCount} project${row.projectCount === 1 ? "" : "s"}`,
    onboardingManagerId: seedEmployees[i % managers.length].id,
    csmId: seedEmployees[managers.length + (i % csms.length)].id,
    status: progressHint >= 100 ? "completed" : statuses[i % statuses.length],
    modules: createCompanyModules(optedKeys, `2024-${String(1 + (i % 12)).padStart(2, "0")}-01`),
    agreementDate: `2024-${String(1 + (i % 12)).padStart(2, "0")}-${String(5 + (i % 20)).padStart(2, "0")}`,
    startDate: `2024-${String(1 + (i % 12)).padStart(2, "0")}-${String(5 + (i % 20)).padStart(2, "0")}`,
    goLiveTarget: `2025-${String(1 + ((i + 3) % 12)).padStart(2, "0")}-15`,
    planExpiry: `2026-${String(1 + (i % 12)).padStart(2, "0")}-20`,
    plan: plans[i % 3],
    health: healths[i % 3],
    createdAt: ts,
    updatedAt: ts,
  };
});

function progressSteps(project: PostSalesProject, approvedCount: number): PostSalesProject {
  const steps = project.steps.map((step, idx) => {
    if (idx >= approvedCount) return step;
    return {
      ...step,
      templateStatus: (step.requiresTemplate ? "received" : "not-required") as typeof step.templateStatus,
      templateSentOn: step.requiresTemplate ? ts : undefined,
      uploadStatus: "uploaded" as const,
      uploadedFile: {
        name: `${step.key}.xlsx`,
        uploadedAt: ts,
        recordCount: 80 + idx * 12,
      },
      approvalStatus: "approved" as const,
      approvedBy: "Aditya Kulkarni",
      approvedOn: ts,
    };
  });
  return { ...project, steps };
}

export const seedPostSalesProjects: PostSalesProject[] = seedCompanies.flatMap((c, ci) => {
  if (!c.modules.some((m) => m.moduleKey === "post-sales" && m.optedIn)) return [];
  // One Post Sales tracker per company (keeps seed size manageable with large project counts).
  const base: PostSalesProject = {
    id: `ps-${ci}-0`,
    companyId: c.id,
    projectNumber: `PRJ-${String(ci + 1).padStart(3, "0")}`,
    projectName: `${c.name.split(/[\s(-]/)[0]} Post Sales`,
    steps: buildDefaultPostSalesSteps(),
    createdAt: ts,
    updatedAt: ts,
  };
  return [progressSteps(base, ci % 6)];
});

const projTypes = ["Residential", "Commercial", "Township", "Mixed-use", "Villas"];

export const seedProjects: Project[] = COMPANY_ROSTER.flatMap((row, ci) => {
  const company = seedCompanies[ci];
  return Array.from({ length: row.projectCount }).map((_, pi) => ({
    id: `pr-${ci}-${pi}`,
    name: projectLabel(row.name, pi, row.projectCount),
    companyId: company.id,
    type: projTypes[(ci + pi) % projTypes.length],
    units: 40 + ((ci * 37 + pi * 19) % 460),
    city: company.city,
    rera: `P5${(1000 + ci * 10 + pi).toString()}0002024`,
    status: company.status,
    currentStep: (ci + pi) % 8,
    startDate: `2024-${String(1 + ((ci + pi) % 12)).padStart(2, "0")}-${String(8 + ((ci + pi) % 18)).padStart(2, "0")}`,
    createdAt: ts,
    updatedAt: ts,
  }));
});

/** New / imported projects always start at 0% — never invent completed steps. */
export function buildChecklistForProject(
  projectId: string,
  options?: { demoProgress?: boolean },
): OnboardingChecklistItem[] {
  const items: OnboardingChecklistItem[] = [];
  let seed = projectId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const rand = () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return seed / 2147483647;
  };
  const demo = options?.demoProgress === true;
  for (const [section, labels] of Object.entries(CHECKLIST_TEMPLATE)) {
    for (const label of labels) {
      const r = demo ? rand() : 0;
      items.push({
        id: newId(),
        projectId,
        section,
        label,
        collected: demo ? r > 0.3 : false,
        uploaded: demo ? r > 0.5 : false,
        live: demo ? r > 0.7 : false,
        notApplicable: false,
        remarks: "",
        source: "default",
        createdAt: ts,
        updatedAt: ts,
      });
    }
  }
  return items;
}

export const seedChecklistItems: OnboardingChecklistItem[] = seedProjects
  // Seed checklist for the first project of each company; others init on first open.
  .filter((p) => p.id.endsWith("-0"))
  .flatMap((p) => buildChecklistForProject(p.id, { demoProgress: true }));

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
  const companyProjects = seedProjects.filter((p) => p.companyId === company.id);
  const project = companyProjects[i % Math.max(companyProjects.length, 1)] ?? seedProjects[i % seedProjects.length];
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
    projectId: project?.id ?? "",
    description: `Details for ticket TKT-${1000 + i}: reported by onboarding team.`,
    assignedUserId: undefined,
    actionTaken: "",
    backendAssigned: i % 3 === 0,
    backendAssigneeId: i % 3 === 0 ? seedEmployees[(i + 1) % managers.length].id : undefined,
    backendForwardedAt: i % 3 === 0 ? ts : undefined,
    resolutionStatus:
      ticketStatuses[i % ticketStatuses.length] === "Closed" ||
      ticketStatuses[i % ticketStatuses.length] === "Released"
        ? "Resolved"
        : "Not Resolved",
    resolutionAt:
      ticketStatuses[i % ticketStatuses.length] === "Closed" ||
      ticketStatuses[i % ticketStatuses.length] === "Released"
        ? ts
        : undefined,
    etaRevisedAt: i % 4 === 0 ? ts : undefined,
    resolutionNotes: "",
    createdAt: ts,
    updatedAt: ts,
  };
});

function ago(ms: number) {
  const t = new Date(Date.now() - ms).toISOString();
  return { createdAt: t, updatedAt: t };
}

export const seedActivity: ActivityEntry[] = [
  { id: newId(), who: "Priya Sharma", what: "Marked Globe Group — Project 1 progress updated", kind: "success", companyId: "co-1", projectId: "pr-0-0", ...ago(600_000) },
  { id: newId(), who: "Aditya Kulkarni", what: "Approved Payment Plan step — PRJ-001", kind: "success", companyId: "co-1", projectId: "ps-0-0", ...ago(1_800_000) },
  { id: newId(), who: "Priya Sharma", what: "Submitted Unit Types for approval — PRJ-001", kind: "info", companyId: "co-1", projectId: "ps-0-0", ...ago(3_600_000) },
  { id: newId(), who: "Rohan Iyer", what: "Uploaded units.xlsx for Unit Types — PRJ-001", kind: "success", companyId: "co-1", projectId: "ps-0-0", ...ago(5_400_000) },
  { id: newId(), who: "Priya Sharma", what: "Sent template for Unit Types to customer — PRJ-001", kind: "info", companyId: "co-1", projectId: "ps-0-0", ...ago(7_200_000) },
  { id: newId(), who: "Aditya Kulkarni", what: "Updated company contact details — Globe Group", kind: "info", companyId: "co-1", ...ago(14_400_000) },
  { id: newId(), who: "System", what: "Go-live reminder: target approaching in 14 days", kind: "warning", companyId: "co-1", ...ago(28_800_000) },
  { id: newId(), who: "Priya Sharma", what: "Created Post Sales project PRJ-001", kind: "success", companyId: "co-1", projectId: "ps-0-0", ...ago(86_400_000) },
  { id: newId(), who: "Rohan Iyer", what: "Uploaded Customer Data for Gurukrupa Realcon", kind: "info", companyId: "co-2", ...ago(3_600_000) },
  { id: newId(), who: "System", what: "Renewal reminder sent to Syscom Edutech Pvt. Ltd.", kind: "warning", companyId: "co-3", ...ago(7_200_000) },
  { id: newId(), who: "Neha Kapoor", what: "Customization TKT-1008 moved to QA", kind: "info", ...ago(18_000_000) },
  { id: newId(), who: "Aarav Mehta", what: "Verified payment plan for Dimples Group", kind: "success", companyId: "co-4", ...ago(86_400_000) },
  { id: newId(), who: "Ishita Verma", what: "Bug TKT-1003 marked critical", kind: "danger", ...ago(86_400_000) },
  { id: newId(), who: "Vikram Rao", what: "Training completed for Neelam Realtors", kind: "success", companyId: "co-5", ...ago(172_800_000) },
];

export const seedNotes: CompanyNote[] = [
  {
    id: newId(),
    companyId: "co-1",
    author: "Priya Sharma",
    body: "Globe Group — large portfolio (18 projects). Prefer WhatsApp for template delivery. CC Aditya on approvals.",
    pinned: true,
    ...ago(172_800_000),
  },
  {
    id: newId(),
    companyId: "co-1",
    author: "Aditya Kulkarni",
    body: "Kickoff completed. Unit types and payment plan are first priorities for Post Sales.",
    pinned: false,
    projectId: "ps-0-0",
    ...ago(259_200_000),
  },
  {
    id: newId(),
    companyId: "co-37",
    author: "Rohan Iyer",
    body: "MAHADEV GREENS — contact Padmini Das (9938033250). Confirm GST before billing setup.",
    pinned: false,
    ...ago(86_400_000),
  },
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

export const seedUploads: UnitUpload[] = [
  {
    id: newId(),
    projectId: "pr-0-0",
    type: "unit",
    fileName: "sunrise_unit_config.xlsx",
    recordCount: 214,
    uploadedAt: new Date(Date.now() - 259_200_000).toISOString(),
    createdAt: new Date(Date.now() - 259_200_000).toISOString(),
    updatedAt: new Date(Date.now() - 259_200_000).toISOString(),
  },
  {
    id: newId(),
    projectId: "pr-0-0",
    type: "customer",
    fileName: "sunrise_customers.xlsx",
    recordCount: 186,
    uploadedAt: new Date(Date.now() - 172_800_000).toISOString(),
    createdAt: new Date(Date.now() - 172_800_000).toISOString(),
    updatedAt: new Date(Date.now() - 172_800_000).toISOString(),
  },
];
export const seedCustomerRecords: CustomerRecord[] = [];
export const seedPaymentRecords: PaymentRecord[] = [];

/** Seed attachments from migrated uploads + post-sales files with purpose labels. */
export const seedAttachments: CompanyAttachment[] = [
  ...seedUploads.map((u) => {
    const project = seedProjects.find((p) => p.id === u.projectId);
    const purposeMap = {
      unit: "Unit configuration",
      customer: "Customer data",
      booking: "Booking data",
      payment: "Payment data",
    } as const;
    return {
      id: newId(),
      companyId: project?.companyId ?? "co-1",
      projectId: u.projectId,
      fileName: u.fileName,
      purpose: purposeMap[u.type],
      category: u.type,
      context: project?.name ? `Onboarding · ${project.name}` : "Onboarding data migration",
      recordCount: u.recordCount,
      uploadedBy: "Rohan Iyer",
      uploadedAt: u.uploadedAt,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    } satisfies CompanyAttachment;
  }),
  ...seedPostSalesProjects.flatMap((project) =>
    project.steps
      .filter((s) => s.uploadedFile)
      .map((s) => ({
        id: newId(),
        companyId: project.companyId,
        projectId: project.id,
        fileName: s.uploadedFile!.name,
        purpose: s.label,
        category: "post-sales-step" as const,
        context: `Post Sales · ${project.projectNumber} · ${project.projectName}`,
        recordCount: s.uploadedFile!.recordCount,
        uploadedBy: "Priya Sharma",
        uploadedAt: s.uploadedFile!.uploadedAt,
        createdAt: s.uploadedFile!.uploadedAt,
        updatedAt: s.uploadedFile!.uploadedAt,
      } satisfies CompanyAttachment)),
  ),
];
