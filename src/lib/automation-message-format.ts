/**
 * Automation templates use WhatsApp-style markers:
 *   *bold*   _italic_
 * WhatsApp (WAHA) sends them as-is; email converts to HTML for n8n.
 */

export function wrapAutomationTemplateMarker(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  marker: "*" | "_",
): { value: string; selectionStart: number; selectionEnd: number } {
  const start = Math.max(0, Math.min(selectionStart, text.length));
  const end = Math.max(start, Math.min(selectionEnd, text.length));
  const selected = text.slice(start, end) || "text";
  const wrapped = `${marker}${selected}${marker}`;
  const value = text.slice(0, start) + wrapped + text.slice(end);
  const innerStart = start + marker.length;
  return {
    value,
    selectionStart: innerStart,
    selectionEnd: innerStart + selected.length,
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Turn *bold* / _italic_ lines into simple HTML for email webhooks. */
export function automationMessageToEmailHtml(body: string): string {
  return body
    .split("\n")
    .map((line) => {
      const escaped = escapeHtml(line);
      return escaped
        .replace(/\*([^*]+)\*/g, "<strong>$1</strong>")
        .replace(/_([^_]+)_/g, "<em>$1</em>");
    })
    .join("<br />\n");
}

export const AUTOMATION_FORMAT_HINT =
  "Use *bold* and _italic_ in templates. WhatsApp shows them formatted; email sends HTML with the same styling.";
