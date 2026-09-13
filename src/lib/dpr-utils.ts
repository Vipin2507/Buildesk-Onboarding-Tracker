export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function isDprFollowUpOverdue(nextFollowUpDate: string | null | undefined, status: string) {
  if (status === "Completed") return false;
  if (!nextFollowUpDate?.trim()) return false;
  return nextFollowUpDate.slice(0, 10) < todayIsoDate();
}
