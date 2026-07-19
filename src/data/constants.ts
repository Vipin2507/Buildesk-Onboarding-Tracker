export const MODULES = [
  "Postel (General)",
  "Customer Management",
  "Customer App",
  "Vendor Management",
  "Construction Management",
  "Project Management",
  "Labor Management",
  "WATI",
] as const;

export const ONBOARDING_STEPS = [
  "Project Details",
  "Other Charges",
  "Unit Configuration",
  "Customer Data Upload",
  "Payment Data Upload",
  "Documents Upload",
  "Payment Plan & Due Matching",
  "Review & Complete",
] as const;

export const ONBOARDING_SECTIONS = [
  { key: "project", label: "Project Information" },
  { key: "unit", label: "Unit Information" },
  { key: "customer", label: "Customer Data" },
  { key: "payment", label: "Payment Information" },
  { key: "documents", label: "Documents & Formats" },
  { key: "integrations", label: "Integrations (WATI etc.)" },
  { key: "golive", label: "Go Live & Handover" },
] as const;

export const CHECKLIST_TEMPLATE: Record<string, string[]> = {
  project: ["Project master created", "Address & RERA captured", "POCs assigned", "Other charges defined"],
  unit: ["Unit Detail Uploaded"],
  customer: ["Excel Uploaded"],
  payment: ["Uploaded"],
  documents: ["Agreement template uploaded", "Demand letter tested", "Receipt template live", "Reminder templates approved"],
  integrations: ["WATI API connected", "SMS gateway configured", "Email SMTP verified"],
  golive: ["Team training completed", "Client sign-off received", "Go-live date confirmed"],
};

export const DOCUMENT_TEMPLATE_NAMES = [
  { name: "Welcome Letter", category: "Customer" },
  { name: "Allotment Letter", category: "Legal" },
  { name: "Allotment Letter (Stilt)", category: "Legal" },
  { name: "Allotment Letter (Stack)", category: "Legal" },
  { name: "Parking Letter", category: "Legal" },
  { name: "No Parking Letter", category: "Legal" },
  { name: "Possession Letter", category: "Handover" },
  { name: "RERA Extension Letter", category: "Legal" },
  { name: "Consent Letter", category: "Legal" },
  { name: "Agreement Handover Letter", category: "Handover" },
  { name: "Sale Agreement", category: "Legal" },
  { name: "Demand Letter", category: "Billing" },
  { name: "Payment Receipt", category: "Billing" },
  { name: "Payment Reminder 1", category: "Billing" },
  { name: "Payment Reminder 2", category: "Billing" },
  { name: "Final Payment Reminder", category: "Billing" },
  { name: "Termination Letter 1", category: "Legal" },
  { name: "Termination Letter 2", category: "Legal" },
  { name: "Cancellation Letter", category: "Legal" },
  { name: "Cost Sheet", category: "Sales" },
  { name: "Booking Form", category: "Sales" },
  { name: "NOC Template", category: "Legal" },
  { name: "Interest Letter", category: "Billing" },
];

export const INTEGRATION_NAMES = [
  { name: "WATI WhatsApp", description: "WhatsApp Business API for customer notifications" },
  { name: "SMS Gateway", description: "Transactional SMS for OTP and alerts" },
  { name: "Email SMTP", description: "Outbound email for documents and reminders" },
  { name: "Website Lead Form", description: "Capture leads from company website" },
  { name: "Payment Gateway", description: "Online payment collection integration" },
  { name: "Google Analytics", description: "Track customer app usage" },
];

export const TRIGGER_EVENTS = [
  { name: "Booking Confirmed", event: "booking.confirmed", channel: "WhatsApp" },
  { name: "Payment Received", event: "payment.received", channel: "SMS" },
  { name: "Demand Generated", event: "demand.generated", channel: "Email" },
  { name: "Overdue Reminder", event: "payment.overdue", channel: "WhatsApp" },
  { name: "Document Signed", event: "document.signed", channel: "Email" },
];

export const TICKET_KANBAN_COLUMNS = [
  "Open",
  "In Progress",
  "Pending",
  "Resolved",
  "Closed",
  // Legacy statuses kept so existing records remain editable during migration.
  "New",
  "Assigned",
  "QA",
  "Ready for Release",
  "Released",
] as const;
