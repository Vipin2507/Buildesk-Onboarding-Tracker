import type { DesignTicketAttachment } from "@/types/design-ticket";

/** Max bytes per ticket attachment (stored as data URL in message JSON). */
export const DESIGN_TICKET_MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read file"));
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function isImageAttachment(file: DesignTicketAttachment) {
  if (file.mimeType?.startsWith("image/")) return true;
  if (file.url?.startsWith("data:image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name);
}

/** Snapshot FileList immediately — clearing the input empties a live FileList. */
export function snapshotFiles(fileList: FileList | File[] | null | undefined): File[] {
  return fileList ? Array.from(fileList) : [];
}

/** Read browser files into ticket attachments with embedded data URLs for preview. */
export async function filesToDesignTicketAttachments(
  fileList: FileList | File[],
): Promise<{ attachments: DesignTicketAttachment[]; errors: string[] }> {
  const files = snapshotFiles(fileList);
  const attachments: DesignTicketAttachment[] = [];
  const errors: string[] = [];

  for (const file of files) {
    if (file.size > DESIGN_TICKET_MAX_ATTACHMENT_BYTES) {
      errors.push(`${file.name} exceeds ${Math.round(DESIGN_TICKET_MAX_ATTACHMENT_BYTES / (1024 * 1024))}MB limit`);
      continue;
    }
    try {
      const url = await readFileAsDataUrl(file);
      attachments.push({
        name: file.name,
        url,
        mimeType: file.type || undefined,
      });
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `Failed to read ${file.name}`);
    }
  }

  return { attachments, errors };
}
