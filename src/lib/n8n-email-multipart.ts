/** Shared helpers for n8n email webhooks with binary attachments (multipart). */

export type N8nEmailFile = {
  filename: string;
  mimetype: string;
  /** Raw base64 (no data: prefix) or data-URL. */
  dataBase64: string;
};

/** Primary binary field name for the first email attachment (n8n Email node). */
export const N8N_EMAIL_FILE_FIELD = "email_file";

export function n8nEmailFileFieldName(index: number): string {
  return index === 0 ? N8N_EMAIL_FILE_FIELD : `${N8N_EMAIL_FILE_FIELD}_${index}`;
}

function stripDataUrlPrefix(dataBase64: string): string {
  const trimmed = dataBase64.trim();
  if (!trimmed.includes(",")) return trimmed;
  return trimmed.split(",").pop() ?? trimmed;
}

export function decodeBase64ToUint8Array(dataBase64: string): Uint8Array {
  const raw = stripDataUrlPrefix(dataBase64);
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(raw, "base64"));
  }
  const binary = atob(raw);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Replace inlined base64 attachment blobs with filename/mimetype/field metadata. */
export function stripAttachmentBinariesFromPayload(
  body: Record<string, unknown>,
  files?: N8nEmailFile[],
): Record<string, unknown> {
  const source =
    files?.length
      ? files
      : Array.isArray(body.attachments)
        ? (body.attachments as Array<Record<string, unknown>>)
        : [];

  const meta = source.map((a, i) => {
    const filename =
      typeof a.filename === "string" && a.filename.trim()
        ? a.filename
        : typeof (a as { name?: unknown }).name === "string"
          ? String((a as { name: string }).name)
          : `attachment-${i + 1}`;
    const mimetype =
      typeof a.mimetype === "string" && a.mimetype.trim()
        ? a.mimetype
        : typeof (a as { contentType?: unknown }).contentType === "string"
          ? String((a as { contentType: string }).contentType)
          : "application/octet-stream";
    return {
      filename,
      name: filename,
      mimetype,
      contentType: mimetype,
      type: mimetype,
      field: n8nEmailFileFieldName(i),
    };
  });

  return {
    ...body,
    hasAttachments: meta.length > 0,
    attachmentCount: meta.length,
    attachments: meta,
    attachmentFields: meta.map((m) => m.field),
  };
}

/**
 * Build multipart/form-data for n8n:
 * - `data` = full JSON string of the text payload
 * - each payload key as a flat text field
 * - binary files as `email_file`, `email_file_1`, …
 *
 * Do not set Content-Type manually — the runtime sets the boundary.
 */
export function buildN8nEmailFormData(
  payload: Record<string, unknown>,
  files: N8nEmailFile[],
): FormData {
  const textPayload = stripAttachmentBinariesFromPayload(payload, files);
  const form = new FormData();
  form.append("data", JSON.stringify(textPayload));

  for (const [key, value] of Object.entries(textPayload)) {
    if (value == null) continue;
    if (typeof value === "object") {
      form.append(key, JSON.stringify(value));
      continue;
    }
    form.append(key, String(value));
  }

  files.forEach((file, i) => {
    const bytes = decodeBase64ToUint8Array(file.dataBase64);
    // Copy into a plain ArrayBuffer so BlobPart typing accepts it (TS 5.x / SharedArrayBuffer).
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const blob = new Blob([copy], {
      type: file.mimetype || "application/octet-stream",
    });
    form.append(n8nEmailFileFieldName(i), blob, file.filename || `attachment-${i + 1}`);
  });

  return form;
}
