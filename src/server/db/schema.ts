import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("Viewer"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  avatarUrl: text("avatar_url"),
  phone: text("phone"),
  jobTitle: text("job_title"),
  department: text("department"),
  timezone: text("timezone"),
  bio: text("bio"),
  notifyEmail: integer("notify_email", { mode: "boolean" }).default(true),
  notifyInApp: integer("notify_in_app", { mode: "boolean" }).default(true),
  ...timestamps,
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const employees = sqliteTable("employees", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  region: text("region").notNull(),
  email: text("email").notNull(),
  ...timestamps,
});

export const companies = sqliteTable("companies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  contact: text("contact").notNull(),
  designation: text("designation").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  city: text("city").notNull(),
  officeAddress: text("office_address"),
  gstNumber: text("gst_number"),
  billingInfo: text("billing_info"),
  onboardingManagerId: text("onboarding_manager_id").notNull(),
  csmId: text("csm_id").notNull(),
  status: text("status").notNull(),
  agreementDate: text("agreement_date").notNull(),
  startDate: text("start_date"),
  goLiveTarget: text("go_live_target").notNull(),
  planExpiry: text("plan_expiry").notNull(),
  plan: text("plan").notNull(),
  health: text("health").notNull(),
  renewedAt: text("renewed_at"),
  ...timestamps,
});

export const companyModules = sqliteTable(
  "company_modules",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    moduleKey: text("module_key").notNull(),
    label: text("label").notNull(),
    optedIn: integer("opted_in", { mode: "boolean" }).notNull().default(false),
    optedOnDate: text("opted_on_date"),
  },
  (t) => [index("company_modules_company_idx").on(t.companyId)],
);

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    units: integer("units").notNull().default(0),
    city: text("city").notNull(),
    rera: text("rera").notNull().default(""),
    status: text("status").notNull(),
    currentStep: integer("current_step").notNull().default(0),
    startDate: text("start_date"),
    goLiveAt: text("go_live_at"),
    address: text("address"),
    state: text("state"),
    pinCode: text("pin_code"),
    totalTowers: integer("total_towers"),
    totalFloors: integer("total_floors"),
    agreementValue: integer("agreement_value"),
    otherChargesJson: text("other_charges_json").notNull().default("[]"),
    customChargesJson: text("custom_charges_json").notNull().default("[]"),
    logoUrl: text("logo_url"),
    ...timestamps,
  },
  (t) => [index("projects_company_idx").on(t.companyId)],
);

export const projectManualProgress = sqliteTable("project_manual_progress", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  contactPerson: text("contact_person"),
  contactNumber: text("contact_number"),
  checksJson: text("checks_json").notNull().default("{}"),
  notApplicableJson: text("not_applicable_json").notNull().default("{}"),
  remarks: text("remarks").notNull().default(""),
  ...timestamps,
});

export const onboardingChecklistItems = sqliteTable(
  "onboarding_checklist_items",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    section: text("section").notNull(),
    label: text("label").notNull(),
    collected: integer("collected", { mode: "boolean" }).notNull().default(false),
    uploaded: integer("uploaded", { mode: "boolean" }).notNull().default(false),
    live: integer("live", { mode: "boolean" }).notNull().default(false),
    notApplicable: integer("not_applicable", { mode: "boolean" }).notNull().default(false),
    remarks: text("remarks").notNull().default(""),
    /** default | required-document */
    source: text("source").notNull().default("default"),
    ...timestamps,
  },
  (t) => [index("checklist_project_idx").on(t.projectId)],
);

export const otherCharges = sqliteTable(
  "other_charges",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    amount: real("amount").notNull().default(0),
    type: text("type").notNull(),
    ...timestamps,
  },
  (t) => [index("other_charges_project_idx").on(t.projectId)],
);

export const unitUploads = sqliteTable(
  "unit_uploads",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    fileName: text("file_name").notNull(),
    recordCount: integer("record_count").notNull().default(0),
    uploadedAt: text("uploaded_at").notNull(),
    ...timestamps,
  },
  (t) => [index("unit_uploads_project_idx").on(t.projectId)],
);

export const customerAppConfigs = sqliteTable("customer_app_configs", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  mode: text("mode").notNull().default("buildesk"),
  appName: text("app_name").notNull(),
  primaryColor: text("primary_color").notNull().default("#009BFF"),
  logoUrl: text("logo_url").notNull().default(""),
  supportEmail: text("support_email").notNull().default(""),
  supportPhone: text("support_phone").notNull().default(""),
  publishStatus: text("publish_status").notNull().default("draft"),
  ...timestamps,
});

export const postSalesProjects = sqliteTable(
  "post_sales_projects",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    projectNumber: text("project_number").notNull(),
    projectName: text("project_name").notNull(),
    ...timestamps,
  },
  (t) => [index("post_sales_company_idx").on(t.companyId)],
);

export const postSalesSteps = sqliteTable(
  "post_sales_steps",
  {
    id: text("id").primaryKey(),
    postSalesProjectId: text("post_sales_project_id")
      .notNull()
      .references(() => postSalesProjects.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    requiresTemplate: integer("requires_template", { mode: "boolean" }).notNull().default(false),
    templateStatus: text("template_status").notNull(),
    templateSentOn: text("template_sent_on"),
    uploadStatus: text("upload_status").notNull(),
    uploadedFileJson: text("uploaded_file_json"),
    approvalStatus: text("approval_status").notNull(),
    approvedBy: text("approved_by"),
    approvedOn: text("approved_on"),
    remarks: text("remarks"),
    order: integer("order").notNull().default(0),
  },
  (t) => [index("post_sales_steps_project_idx").on(t.postSalesProjectId)],
);

export const activityEntries = sqliteTable(
  "activity_entries",
  {
    id: text("id").primaryKey(),
    who: text("who").notNull(),
    what: text("what").notNull(),
    kind: text("kind").notNull(),
    companyId: text("company_id"),
    projectId: text("project_id"),
    ...timestamps,
  },
  (t) => [
    index("activity_company_idx").on(t.companyId),
    index("activity_project_idx").on(t.projectId),
  ],
);

export const companyNotes = sqliteTable(
  "company_notes",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    projectId: text("project_id"),
    body: text("body").notNull(),
    author: text("author").notNull(),
    pinned: integer("pinned", { mode: "boolean" }).default(false),
    ...timestamps,
  },
  (t) => [index("notes_company_idx").on(t.companyId)],
);

export const companyAttachments = sqliteTable(
  "company_attachments",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    projectId: text("project_id"),
    fileName: text("file_name").notNull(),
    purpose: text("purpose").notNull(),
    category: text("category").notNull(),
    context: text("context"),
    recordCount: integer("record_count"),
    uploadedBy: text("uploaded_by").notNull(),
    uploadedAt: text("uploaded_at").notNull(),
    ...timestamps,
  },
  (t) => [index("attachments_company_idx").on(t.companyId)],
);

/* ---------- Phase 2 tables ---------- */

export const tickets = sqliteTable("tickets", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  priority: text("priority").notNull(),
  status: text("status").notNull(),
  raisedOn: text("raised_on").notNull(),
  eta: text("eta").notNull(),
  developerId: text("developer_id"),
  companyId: text("company_id"),
  description: text("description").notNull().default(""),
  ...timestamps,
});

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    kind: text("kind").notNull().default("info"),
    href: text("href"),
    readAt: text("read_at"),
    companyId: text("company_id"),
    ticketId: text("ticket_id"),
    ...timestamps,
  },
  (t) => [index("notifications_user_idx").on(t.userId), index("notifications_created_idx").on(t.createdAt)],
);
export const trainingSessions = sqliteTable("training_sessions", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  trainerId: text("trainer_id").notNull(),
  companyId: text("company_id").notNull(),
  date: text("date").notNull(),
  attendance: text("attendance").notNull(),
  recording: text("recording").notNull(),
  status: text("status").notNull(),
  ...timestamps,
});

export const labor = sqliteTable("labor", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  phone: text("phone").notNull(),
  ...timestamps,
});

export const attendanceRecords = sqliteTable("attendance_records", {
  id: text("id").primaryKey(),
  fileName: text("file_name").notNull(),
  uploadedAt: text("uploaded_at").notNull(),
  recordCount: integer("record_count").notNull().default(0),
  ...timestamps,
});

export const materials = sqliteTable("materials", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  unit: text("unit").notNull(),
  ...timestamps,
});

export const suppliers = sqliteTable("suppliers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  contact: text("contact").notNull(),
  phone: text("phone").notNull(),
  ...timestamps,
});

export const contractors = sqliteTable("contractors", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  contact: text("contact").notNull(),
  phone: text("phone").notNull(),
  ...timestamps,
});

export const purchaseOrders = sqliteTable("purchase_orders", {
  id: text("id").primaryKey(),
  number: text("number").notNull(),
  supplierId: text("supplier_id").notNull(),
  projectId: text("project_id").notNull(),
  date: text("date").notNull(),
  status: text("status").notNull(),
  amount: real("amount").notNull().default(0),
  ...timestamps,
});

export const workOrders = sqliteTable("work_orders", {
  id: text("id").primaryKey(),
  number: text("number").notNull(),
  contractorId: text("contractor_id").notNull(),
  projectId: text("project_id").notNull(),
  date: text("date").notNull(),
  status: text("status").notNull(),
  amount: real("amount").notNull().default(0),
  ...timestamps,
});

export const boqs = sqliteTable("boqs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  projectId: text("project_id").notNull(),
  status: text("status").notNull(),
  ...timestamps,
});

export const approvalFlows = sqliteTable("approval_flows", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  stagesJson: text("stages_json").notNull().default("[]"),
  ...timestamps,
});

export const documentTemplates = sqliteTable("document_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull(),
  ...timestamps,
});

export const integrations = sqliteTable("integrations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  connected: integer("connected", { mode: "boolean" }).notNull().default(false),
  tested: integer("tested", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
});

export const triggers = sqliteTable("triggers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  event: text("event").notNull(),
  channel: text("channel").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

/** JSON blob stores for admin config catalogs (master + app settings). */
export const appConfig = sqliteTable("app_config", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull().default("{}"),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
