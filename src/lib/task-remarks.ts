export type FollowUpTaskRemark = {
  text: string;
  authorName?: string;
  authorUserId?: string;
  createdAt: string;
};

export function parseTaskRemarksJson(json: string | null | undefined): FollowUpTaskRemark[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is FollowUpTaskRemark =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as FollowUpTaskRemark).text === "string" &&
          typeof (item as FollowUpTaskRemark).createdAt === "string",
      )
      .map((item) => ({
        text: item.text.trim(),
        authorName: item.authorName,
        authorUserId: item.authorUserId,
        createdAt: item.createdAt,
      }))
      .filter((item) => item.text.length > 0);
  } catch {
    return [];
  }
}

export function serializeTaskRemarks(remarks: FollowUpTaskRemark[]): string {
  return JSON.stringify(remarks);
}

/** Build remark list from stored JSON, falling back to legacy latestRemark. */
export function resolveTaskRemarks(
  remarksJson: string | null | undefined,
  latestRemark: string | null | undefined,
  fallbackCreatedAt?: string,
): FollowUpTaskRemark[] {
  const parsed = parseTaskRemarksJson(remarksJson);
  if (parsed.length) return parsed;
  const legacy = latestRemark?.trim();
  if (!legacy) return [];
  return [{ text: legacy, createdAt: fallbackCreatedAt ?? new Date().toISOString() }];
}

export function appendTaskRemark(
  remarksJson: string | null | undefined,
  latestRemark: string | null | undefined,
  text: string,
  meta: Omit<FollowUpTaskRemark, "text">,
): { remarksJson: string; latestRemark: string; remarks: FollowUpTaskRemark[] } {
  const trimmed = text.trim();
  const existing = resolveTaskRemarks(remarksJson, latestRemark, meta.createdAt);
  if (!trimmed) {
    return {
      remarksJson: remarksJson ?? serializeTaskRemarks(existing),
      latestRemark: latestRemark?.trim() ?? existing.at(-1)?.text ?? "",
      remarks: existing,
    };
  }
  const remarks = [...existing, { text: trimmed, ...meta }];
  return {
    remarksJson: serializeTaskRemarks(remarks),
    latestRemark: trimmed,
    remarks,
  };
}
