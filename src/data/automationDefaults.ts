import type {
  AutomationEndpoint,
  AutomationHealthConfig,
  AutomationRule,
  AutomationSettings,
} from "@/types/automation";
import { nowIso } from "@/types";

export const DEFAULT_N8N_WEBHOOK_BASE = "http://72.60.200.185:5678/webhook";
export const N8N_EMAIL_SEGMENT = "buildesk-support";
export const N8N_HEALTH_SEGMENT = "buildesk-health";

export const DEFAULT_WHATSAPP_WEBHOOK = "http://72.60.200.185:5678/webhook/buildesk-whatsapp";
export const DEFAULT_EMAIL_WEBHOOK = `${DEFAULT_N8N_WEBHOOK_BASE}/${N8N_EMAIL_SEGMENT}`;
export const DEFAULT_HEALTH_WEBHOOK = `${DEFAULT_N8N_WEBHOOK_BASE}/${N8N_HEALTH_SEGMENT}`;

export const DEFAULT_WAHA_API_URL = "http://72.60.200.185:3000";
export const DEFAULT_WAHA_API_KEY = "MySecretWAHAKey";
export const DEFAULT_WAHA_SESSION = "second";

export const DEFAULT_WAHA_CONFIG = {
  apiUrl: DEFAULT_WAHA_API_URL,
  apiKey: DEFAULT_WAHA_API_KEY,
  sessionName: DEFAULT_WAHA_SESSION,
  isEnabled: true,
};

export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  n8nWebhookBase: DEFAULT_N8N_WEBHOOK_BASE,
  automationsEnabled: true,
};

export const DEFAULT_AUTOMATION_ENDPOINTS: AutomationEndpoint[] = [
  {
    channel: "email",
    label: "Email (n8n)",
    provider: "n8n-webhook",
    webhookUrl: DEFAULT_EMAIL_WEBHOOK,
    isEnabled: true,
  },
  {
    channel: "whatsapp",
    label: "WhatsApp (WAHA)",
    provider: "waha",
    webhookUrl: DEFAULT_WAHA_API_URL,
    isEnabled: true,
  },
];

/** Merge seed endpoints; preserve isEnabled and custom webhook URLs across deploys. */
export function mergeAutomationEndpoints(
  existing: AutomationEndpoint[],
  seeds: AutomationEndpoint[] = DEFAULT_AUTOMATION_ENDPOINTS,
): AutomationEndpoint[] {
  const byChannel = new Map(existing.map((e) => [e.channel, e]));
  return seeds.map((seed) => {
    const current = byChannel.get(seed.channel);
    if (!current) return { ...seed };
    return {
      ...seed,
      ...current,
      label: current.label || seed.label,
      provider: current.provider || seed.provider,
      webhookUrl: current.webhookUrl?.trim() ? current.webhookUrl : seed.webhookUrl,
      isEnabled: current.isEnabled,
      lastHealthCheck: current.lastHealthCheck ?? seed.lastHealthCheck,
    };
  });
}

export const DEFAULT_HEALTH_CONFIG: AutomationHealthConfig = {
  label: "Health Check (n8n)",
  webhookUrl: DEFAULT_HEALTH_WEBHOOK,
  httpMethod: "POST",
};

function rule(
  partial: Omit<AutomationRule, "createdAt" | "updatedAt"> & { isActive: boolean },
): AutomationRule {
  const now = nowIso();
  return { ...partial, createdAt: now, updatedAt: now };
}

export const DEFAULT_AUTOMATION_RULES: AutomationRule[] = [
  rule({
    id: "rule-ticket-created-email",
    name: "Ticket Created — Email",
    trigger: "ticket-created",
    channel: "email",
    isActive: true,
    templateSubject: "New support ticket {{ticketNumber}} — {{companyName}}",
    templateBody:
      "Hi {{customerName}},\n\nYour support ticket {{ticketNumber}} has been created.\n\nSubject: {{title}}\nStatus: {{status}}\n\nView details: {{ticketUrl}}",
  }),
  rule({
    id: "rule-ticket-closed-email",
    name: "Ticket Closed — Email",
    trigger: "ticket-closed",
    channel: "email",
    isActive: true,
    templateSubject: "Ticket {{ticketNumber}} closed — {{companyName}}",
    templateBody:
      "Hi {{customerName}},\n\nYour ticket {{ticketNumber}} is now closed.\n\nSubject: {{title}}\nStatus: {{status}}\n\nThank you for working with us.",
  }),
  rule({
    id: "rule-ticket-created-whatsapp",
    name: "Ticket Created — WhatsApp",
    trigger: "ticket-created",
    channel: "whatsapp",
    isActive: false,
    templateBody:
      "Hi {{customerName}}, ticket {{ticketNumber}} was created for {{companyName}}. Status: {{status}}. {{ticketUrl}}",
  }),
  rule({
    id: "rule-ticket-closed-whatsapp",
    name: "Ticket Closed — WhatsApp",
    trigger: "ticket-closed",
    channel: "whatsapp",
    isActive: false,
    templateBody:
      "Hi {{customerName}}, ticket {{ticketNumber}} for {{companyName}} is now closed. Status: {{status}}.",
  }),
  rule({
    id: "rule-company-created-email",
    name: "Company Created — Implementation Email",
    description:
      "Sends kickoff document request to POC; Owner is CC’d when different. Attach Excel templates on this rule (or the WhatsApp twin) — they go out with the email.",
    trigger: "company-created",
    channel: "email",
    isActive: true,
    templateSubject: "ERP Implementation — Required Information & Documents | {{companyName}}",
    templateBody: `Dear Team,

Greetings from Buildesk!

As part of the ERP implementation process for {{companyName}}, we request you to kindly share the required information and documents to initiate the project setup and data migration.

Required Information & Documents:
Project Name, Total Units & Project Address
Company Name & GST Details
Site Address
Complete Payment Plan Details
Unit Configuration Details (Excel Format)
Existing Demand Letter Format
High-Resolution Project Logo
Existing Payment Receipt Format
Historical Customer Data (if any)
Historical Payment Data (if any)

We request you to share the above details along with the relevant Excel sheets and document formats at the earliest.

Important: Once we receive the complete information, our implementation team will proceed with master setup, data verification and migration.

For any clarification or assistance, please feel free to contact us.

Regards,
Gaurav Singh
ERP Implementation | Buildesk
📞 +91 88531 77075
📧 gaurav@cravingcode.in`,
  }),
  rule({
    id: "rule-company-created-whatsapp",
    name: "Company Created — Implementation WhatsApp",
    description:
      "Posts kickoff checklist to the company WhatsApp group. Attach Excel templates on this rule.",
    trigger: "company-created",
    channel: "whatsapp",
    isActive: true,
    templateBody: `Dear Team,
Greetings from Buildesk!

As discussed, we are initiating the ERP implementation process for {{companyName}}.

To ensure a smooth implementation, accurate master configuration and seamless data migration, we request you to share the following information and documents.

1. Project Information
Project Name
Total Number of Units
Complete Project Address
Other Charges (excluding Agreement Value)

2. Company Information
Company Name
GST Registration Details

3. Site Address Information
Complete Site Address

4. Payment Plans
Complete Payment Plan Details, including installment percentages, milestones and applicable conditions.

5. Unit Configuration
Excel sheet containing all unit configurations, including unit numbers, configurations, carpet area and other applicable details.

6. Demand Letter Formats
Existing Demand Letter Templates/Formats.

7. Project Logos
High-resolution project logo files.

8. Payment Receipt Formats
Existing Payment Receipt Templates/Formats.

9. Customer Details
Historical/Previous Customer Data, apart from the details already shared in the Excel sheets, if available.

10. Payment Details
Historical/Previous Payment Data, apart from the details already shared in the Excel sheets, if available.

Implementation Process
Once we receive the required information, our implementation team will follow the below process:
Review and verification of the submitted information.
Configuration of company, project and other master data.
Unit master setup and verification.
Customer and payment data migration.
Data validation and reconciliation with your team.
ERP configuration and readiness for further training.

Implementation Timeline: The initial master setup and verification process generally requires approximately 7–8 working days after receiving the complete required information, subject to data quality and verification.

We request you to share the above details at the earliest so that we can proceed without delays.

For any assistance or clarification, please feel free to reach out to me.

Looking forward to your cooperation.

Best Regards,
Gaurav Singh
ERP Implementation SPOC
Buildesk | Craving Code
Mobile: +91 88531 77075
Email: gaurav@cravingcode.in
Support: support@buildesk.in`,
  }),
];
