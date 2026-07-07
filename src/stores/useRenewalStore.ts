import { useMemo } from "react";
import { useCompanyStore } from "./useCompanyStore";

export type RenewalUrgency = "overdue" | "urgent" | "upcoming" | "ok";

export function getDaysUntilExpiry(planExpiry: string) {
  const expiry = new Date(planExpiry);
  const now = new Date();
  return Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
}

export function getRenewalUrgency(planExpiry: string): RenewalUrgency {
  const days = getDaysUntilExpiry(planExpiry);
  if (days < 0) return "overdue";
  if (days < 15) return "urgent";
  if (days < 60) return "upcoming";
  return "ok";
}

export function useRenewalSelectors() {
  const companies = useCompanyStore((s) => s.companies);
  const markRenewed = useCompanyStore((s) => s.markRenewed);

  const renewals = useMemo(
    () =>
      companies
        .map((c) => ({
          ...c,
          daysLeft: getDaysUntilExpiry(c.planExpiry),
          urgency: getRenewalUrgency(c.planExpiry),
        }))
        .sort((a, b) => a.daysLeft - b.daysLeft),
    [companies],
  );

  const upcomingCount = useMemo(
    () => renewals.filter((r) => r.urgency === "upcoming" || r.urgency === "urgent").length,
    [renewals],
  );
  const overdueCount = useMemo(() => renewals.filter((r) => r.urgency === "overdue").length, [renewals]);

  return { renewals, upcomingCount, overdueCount, markRenewed };
}

export const useRenewalStore = useCompanyStore;
