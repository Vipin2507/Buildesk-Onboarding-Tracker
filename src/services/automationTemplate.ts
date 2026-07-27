export function renderAutomationTemplate(
  template: string,
  vars: Record<string, string | undefined>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key]?.trim() ?? "");
}

export function renderAutomationSubject(
  template: string | undefined,
  vars: Record<string, string | undefined>,
): string {
  if (!template?.trim()) return vars.subject ?? vars.title ?? "Buildesk notification";
  return renderAutomationTemplate(template, vars);
}

export const AUTOMATION_SAMPLE_VARS: Record<string, string> = {
  customerName: "Priya Sharma",
  ticketNumber: "TKT-1042",
  companyName: "Skyline Developers",
  status: "Open",
  ticketUrl: "https://portal.buildesk.app/portal/acme/support/TKT-1042",
  subject: "Dashboard login issue",
  title: "Dashboard login issue",
};
