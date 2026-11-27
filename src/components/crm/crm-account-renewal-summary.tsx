import { useQuery } from "@tanstack/react-query";

import { getCrmAccountRenewalSummary } from "@/lib/api";

function inr(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

export function CrmAccountRenewalSummary({ accountId }: { accountId: string }) {
  const query = useQuery({
    queryKey: ["crm-account-renewal-years", accountId],
    queryFn: () => getCrmAccountRenewalSummary({ data: { accountId } }),
  });
  const summary = query.data;
  if (!summary) return null;

  const notRenewed = summary.yearsKnown && !summary.renewedThisYear;

  return (
    <div className="mt-2 space-y-1 border-t border-border/60 pt-2 text-xs text-muted-foreground">
      <div>
        Renewals: <span className="font-medium tabular-nums text-foreground">{summary.renewalCount}</span>
      </div>
      <div>
        Total value:{" "}
        <span className="font-medium tabular-nums text-foreground">{inr(summary.lifetimeValue)}</span>
      </div>
      {summary.latestFyLabel ? <div>Latest year: {summary.latestFyLabel}</div> : null}
      {notRenewed ? (
        <div className="font-medium text-amber-700 dark:text-amber-400">
          Not renewed for {summary.currentFyLabel}
        </div>
      ) : null}
      {summary.years.length > 0 ? (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {summary.years.map((year) => (
            <span
              key={year.fyStartYear}
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-foreground"
            >
              {year.label} {inr(year.dealValue)}
            </span>
          ))}
        </div>
      ) : (
        <div className="text-[10px]">
          No yearly history yet. Upload the renewal sheet from Payments.
        </div>
      )}
    </div>
  );
}
