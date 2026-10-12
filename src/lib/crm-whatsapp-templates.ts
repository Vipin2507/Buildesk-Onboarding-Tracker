import type { CrmAccount } from "@/types/crm-account";
import type { CrmWhatsappTemplateDef } from "@/types/crm-master";
import { renderAutomationTemplate } from "@/services/automationTemplate";

export const CRM_WHATSAPP_TEMPLATE_VARIABLES = [
  { key: "clientName", label: "Client / owner name" },
  { key: "accountName", label: "Account name" },
  { key: "pocName", label: "POC name" },
  { key: "accountManagerName", label: "Account manager" },
  { key: "salesManagerName", label: "Sales manager" },
  { key: "status", label: "Account status" },
  { key: "city", label: "City" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
] as const;

export function seedCrmWhatsappTemplates(): CrmWhatsappTemplateDef[] {
  return [
    {
      id: "wa-tpl-crm-checkin",
      name: "CRM & Usage check-in",
      category: "Check-in",
      body: [
        "Hi {{clientName}},",
        "",
        "Hope everything is going well on your end.",
        "",
        "I am reaching out to see how things are moving along with *CRM* and *Usage*. I wanted to personally connect to see if there is anything you need from us right now.",
        "",
        "Are you available for a quick *5-minute catch-up* sometime this week?",
        "",
        "Best regards,",
      ].join("\n"),
      active: true,
      order: 1,
    },
    {
      id: "wa-tpl-onboarding-followup",
      name: "Onboarding follow-up",
      category: "Onboarding",
      body: [
        "Hi {{clientName}},",
        "",
        "Quick follow-up on *{{accountName}}* — how is onboarding progressing on your side?",
        "",
        "If anything is blocking go-live (data, users, or training), reply here and we’ll sort it out.",
        "",
        "_Looking forward to your update._",
        "",
        "Best regards,",
      ].join("\n"),
      active: true,
      order: 2,
    },
    {
      id: "wa-tpl-training-nudge",
      name: "Training nudge",
      category: "Training",
      body: [
        "Hi {{clientName}},",
        "",
        "Just checking in on *training* for {{accountName}}.",
        "",
        "Would your team be free for a short session this week? We can cover the areas that matter most for day-to-day usage.",
        "",
        "Reply with a couple of slots that work and we’ll lock one in.",
        "",
        "Best regards,",
      ].join("\n"),
      active: true,
      order: 3,
    },
    {
      id: "wa-tpl-renewal-touch",
      name: "Renewal touchpoint",
      category: "Renewal",
      body: [
        "Hi {{clientName}},",
        "",
        "Hope you’re doing well. I wanted to connect regarding *{{accountName}}* and plan ahead for the upcoming renewal cycle.",
        "",
        "Is there a good time this week for a quick call? Happy to include {{pocName}} if helpful.",
        "",
        "Best regards,",
      ].join("\n"),
      active: true,
      order: 4,
    },
    {
      id: "wa-tpl-support-check",
      name: "Support pulse",
      category: "Support",
      body: [
        "Hi {{clientName}},",
        "",
        "I’m reaching out from the *support* side for {{accountName}}.",
        "",
        "Is everything running smoothly, or is there anything we can help unblock right now?",
        "",
        "Feel free to share screenshots or details here — we’re happy to jump in.",
        "",
        "Best regards,",
      ].join("\n"),
      active: true,
      order: 5,
    },
  ];
}

function slugifyTemplateId(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

/** Normalize Master WhatsApp templates; missing/invalid → seed defaults. */
export function normalizeCrmWhatsappTemplates(
  existing: CrmWhatsappTemplateDef[] | undefined | null,
): CrmWhatsappTemplateDef[] {
  if (!Array.isArray(existing)) return seedCrmWhatsappTemplates();

  const seen = new Set<string>();
  const out: CrmWhatsappTemplateDef[] = [];

  for (const [i, row] of existing.entries()) {
    const name = String(row?.name ?? "").trim();
    const body = String(row?.body ?? "").trim();
    if (!name || !body) continue;

    let id = String(row?.id ?? "").trim() || slugifyTemplateId(name);
    id = slugifyTemplateId(id) || `wa-tpl-${i + 1}`;
    if (seen.has(id)) id = `${id}-${i + 1}`;
    seen.add(id);

    out.push({
      id,
      name,
      category: String(row?.category ?? "").trim() || "General",
      body,
      active: row?.active !== false,
      order: typeof row?.order === "number" && Number.isFinite(row.order) ? row.order : i + 1,
    });
  }

  return out.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

/** Build `{{variable}}` map from a CRM account for template fill. */
export function buildCrmWhatsappTemplateVars(
  account: CrmAccount | undefined | null,
): Record<string, string> {
  if (!account) {
    return {
      clientName: "there",
      accountName: "",
      pocName: "",
      accountManagerName: "",
      salesManagerName: "",
      status: "",
      city: "",
      phone: "",
      email: "",
    };
  }
  const clientName =
    account.ownerName?.trim() ||
    account.contact?.trim() ||
    account.pocName?.trim() ||
    account.name?.trim() ||
    "there";
  return {
    clientName,
    accountName: account.name?.trim() || "",
    pocName: account.pocName?.trim() || "",
    accountManagerName: account.accountManagerName?.trim() || "",
    salesManagerName: account.salesManagerName?.trim() || "",
    status: account.status?.trim() || "",
    city: account.city?.trim() || "",
    phone: account.phone?.trim() || account.ownerPhone?.trim() || "",
    email: account.email?.trim() || account.ownerEmail?.trim() || "",
  };
}

export function applyCrmWhatsappTemplate(
  body: string,
  account: CrmAccount | undefined | null,
): string {
  return renderAutomationTemplate(body, buildCrmWhatsappTemplateVars(account));
}

/** List `{{var}}` keys referenced in a template body. */
export function listCrmWhatsappTemplateVarsInBody(body: string): string[] {
  const found = new Set<string>();
  for (const m of body.matchAll(/\{\{(\w+)\}\}/g)) {
    if (m[1]) found.add(m[1]);
  }
  return [...found];
}
