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
  unit: ["Unit configuration Excel uploaded", "Tower/floor plan mapped", "Unit types validated", "Pricing sheet locked"],
  customer: ["Customer data Excel uploaded", "Duplicate check completed", "KYC linked", "Contact numbers verified"],
  payment: ["Payment plans defined", "Booking data uploaded", "Payment data uploaded", "Ledger reconciled"],
  documents: ["Agreement template uploaded", "Demand letter tested", "Receipt template live", "Reminder templates approved"],
  integrations: ["WATI API connected", "SMS gateway configured", "Website form integrated", "Email SMTP verified"],
  golive: ["Team training completed", "Client sign-off received", "Go-live date confirmed", "Handover to CSM"],
};

export const DOCUMENT_TEMPLATE_NAMES = [
  { name: "Sale Agreement", category: "Legal" },
  { name: "Allotment Letter", category: "Legal" },
  { name: "Demand Letter", category: "Billing" },
  { name: "Payment Receipt", category: "Billing" },
  { name: "Cancellation Letter", category: "Legal" },
  { name: "Possession Letter", category: "Handover" },
  { name: "NOC Template", category: "Legal" },
  { name: "Booking Form", category: "Sales" },
  { name: "Cost Sheet", category: "Sales" },
  { name: "Welcome Kit", category: "Customer" },
  { name: "Reminder Notice", category: "Billing" },
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
  "New",
  "Assigned",
  "In Progress",
  "QA",
  "Ready for Release",
  "Released",
  "Closed",
] as const;
