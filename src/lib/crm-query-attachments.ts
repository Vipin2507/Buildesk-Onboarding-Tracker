import type { CrmAccountQueryMessageType } from "@/types/crm-account-query";

export const CRM_QUERY_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function crmQueryMessageTypeForMime(
  mimeType: string,
): Exclude<CrmAccountQueryMessageType, "system"> {
  const mime = mimeType.toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "voice";
  return "file";
}

export function crmQueryDefaultAttachmentBody(fileName: string, mimeType: string): string {
  const mime = mimeType.toLowerCase();
  if (mime.startsWith("image/")) return "Shared an image";
  if (mime.startsWith("video/")) return "Shared a video";
  if (mime.startsWith("audio/")) return "Shared audio";
  return `Shared ${fileName}`;
}

export function crmQueryAttachmentPreviewLabel(
  messageType: CrmAccountQueryMessageType,
  attachment?: { name?: string; mimeType?: string },
): string {
  const mime = attachment?.mimeType?.toLowerCase() ?? "";
  if (messageType === "image" || mime.startsWith("image/")) return "Image";
  if (messageType === "voice" || mime.startsWith("audio/")) return "Voice note";
  if (mime.startsWith("video/")) return "Video";
  if (attachment?.name) return attachment.name.length > 40 ? `${attachment.name.slice(0, 37)}…` : attachment.name;
  return "Attachment";
}

export function formatCrmQueryFileSize(bytes?: number): string {
  if (bytes == null || !Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10_240 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isCrmQueryVideoMime(mimeType?: string) {
  return mimeType?.toLowerCase().startsWith("video/") ?? false;
}

export function isCrmQueryImageMime(mimeType?: string) {
  return mimeType?.toLowerCase().startsWith("image/") ?? false;
}

export function isCrmQueryAudioMime(mimeType?: string) {
  return mimeType?.toLowerCase().startsWith("audio/") ?? false;
}
