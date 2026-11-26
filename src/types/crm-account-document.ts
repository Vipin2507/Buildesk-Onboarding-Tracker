export type CrmAccountDocumentKind = "file" | "signoff";

export type CrmAccountDocument = {
  id: string;
  accountId: string;
  kind: CrmAccountDocumentKind;
  title?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
};

export const CRM_ACCOUNT_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

const BLOCKED_EXTENSIONS = new Set([
  "exe",
  "bat",
  "cmd",
  "com",
  "msi",
  "scr",
  "ps1",
  "sh",
  "html",
  "htm",
  "svg",
  "js",
  "jar",
  "vbs",
]);

export function crmAccountDocumentExtension(fileName: string): string {
  const base = fileName.trim().toLowerCase();
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1);
}

export function crmAccountDocumentRejectReason(fileName: string, sizeBytes: number): string | null {
  if (sizeBytes <= 0) return "Choose a file to upload";
  if (sizeBytes > CRM_ACCOUNT_DOCUMENT_MAX_BYTES) {
    return `File exceeds ${Math.round(CRM_ACCOUNT_DOCUMENT_MAX_BYTES / 1024 / 1024)}MB`;
  }
  const ext = crmAccountDocumentExtension(fileName);
  if (ext && BLOCKED_EXTENSIONS.has(ext)) return "This file type cannot be uploaded";
  return null;
}

export function formatCrmAccountDocumentSize(bytes?: number): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10_240 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function crmAccountDocumentTypeLabel(mimeType: string, fileName: string): string {
  const mime = mimeType.toLowerCase();
  const name = fileName.toLowerCase();
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|heic)$/.test(name)) return "Image";
  if (mime.includes("pdf") || name.endsWith(".pdf")) return "PDF";
  if (
    mime.includes("sheet") ||
    mime.includes("excel") ||
    mime.includes("csv") ||
    /\.(xlsx?|csv|ods)$/.test(name)
  ) {
    return "Spreadsheet";
  }
  if (mime.includes("zip") || mime.includes("compressed") || /\.(zip|rar|7z)$/.test(name)) {
    return "Archive";
  }
  if (mime.includes("word") || /\.docx?$/.test(name)) return "Document";
  if (mime.includes("presentation") || /\.pptx?$/.test(name)) return "Slides";
  return "File";
}
