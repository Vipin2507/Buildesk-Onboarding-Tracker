import type { CompanyAttachment, CompanyNote } from "@/types";

/** Prototype download — no real binary storage; export a descriptive file clients can keep. */
export function downloadAttachmentFile(attachment: CompanyAttachment) {
  const ext = attachment.fileName.includes(".")
    ? attachment.fileName.split(".").pop()?.toLowerCase()
    : "txt";

  const meta = [
    `File: ${attachment.fileName}`,
    `Purpose: ${attachment.purpose}`,
    `Category: ${attachment.category}`,
    attachment.context ? `Context: ${attachment.context}` : null,
    `Uploaded by: ${attachment.uploadedBy}`,
    `Uploaded at: ${new Date(attachment.uploadedAt).toLocaleString()}`,
    attachment.recordCount != null ? `Records: ${attachment.recordCount}` : null,
    "",
    "This is a Buildesk prototype export. Connect cloud storage to serve the original binary.",
  ]
    .filter(Boolean)
    .join("\n");

  const base = attachment.fileName.replace(/\.[^.]+$/, "") || "attachment";
  const downloadName =
    ext === "xlsx" || ext === "xls" || ext === "csv"
      ? `${base}-export.csv`
      : `${base}-export.txt`;

  const csvBody =
    ext === "xlsx" || ext === "xls" || ext === "csv"
      ? [
          "purpose,category,context,uploaded_by,uploaded_at,record_count,file_name",
          [
            csv(attachment.purpose),
            csv(attachment.category),
            csv(attachment.context ?? ""),
            csv(attachment.uploadedBy),
            csv(attachment.uploadedAt),
            attachment.recordCount ?? "",
            csv(attachment.fileName),
          ].join(","),
          "",
          "# Prototype placeholder rows",
          "row,value",
          "1,Sample",
          "2,Sample",
        ].join("\n")
      : meta;

  triggerDownload(downloadName, csvBody, downloadName.endsWith(".csv") ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8");
}

export function downloadNoteFile(note: CompanyNote) {
  const body = [
    "Buildesk Company Note",
    "====================",
    `Author: ${note.author}`,
    `Created: ${new Date(note.createdAt).toLocaleString()}`,
    note.pinned ? "Pinned: yes" : null,
    "",
    note.body,
  ]
    .filter(Boolean)
    .join("\n");

  const stamp = new Date(note.createdAt).toISOString().slice(0, 10);
  triggerDownload(`note-${stamp}.txt`, body, "text/plain;charset=utf-8");
}

function csv(value: string) {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

function triggerDownload(fileName: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
