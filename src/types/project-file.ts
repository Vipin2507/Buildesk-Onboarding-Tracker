import type { Timestamps } from "./common";

export type ProjectFileCategory =
  | "agreement"
  | "configuration"
  | "customer-data"
  | "payment"
  | "training"
  | "handover"
  | "other";

export type ProjectFile = Timestamps & {
  id: string;
  projectId: string;
  companyId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  category: ProjectFileCategory;
  /** Optional short description of what the file is for. */
  purpose?: string;
  notes?: string;
  storageKey: string;
  url: string;
  uploadedBy: string;
  uploadedByUserId?: string;
  uploadedAt: string;
};

export const PROJECT_FILE_CATEGORY_LABEL: Record<ProjectFileCategory, string> = {
  agreement: "Agreement / contract",
  configuration: "Configuration",
  "customer-data": "Customer data",
  payment: "Payment",
  training: "Training",
  handover: "Go-live / handover",
  other: "Other",
};

export const PROJECT_FILE_CATEGORIES = Object.keys(
  PROJECT_FILE_CATEGORY_LABEL,
) as ProjectFileCategory[];

export const PROJECT_FILE_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function formatProjectFileSize(bytes?: number): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10_240 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function projectFileTypeLabel(mimeType: string, fileName: string): string {
  const mime = mimeType.toLowerCase();
  if (mime.startsWith("image/")) return "Image";
  if (mime.startsWith("video/")) return "Video";
  if (mime.startsWith("audio/")) return "Audio";
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("sheet") || mime.includes("excel") || /\.xlsx?$/i.test(fileName)) return "Spreadsheet";
  if (mime.includes("word") || /\.docx?$/i.test(fileName)) return "Document";
  if (mime.includes("zip") || mime.includes("compressed")) return "Archive";
  const ext = fileName.includes(".") ? fileName.split(".").pop()?.toUpperCase() : undefined;
  return ext || "File";
}
