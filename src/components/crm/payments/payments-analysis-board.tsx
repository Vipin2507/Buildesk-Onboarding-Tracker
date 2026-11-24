import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  formatPaymentsInr,
  type PaymentsSummaryView,
} from "@/components/crm/payments/payments-format";

const BAND_COLORS = ["#f59e0b", "#3b82f6", "#10b981"];

export function PaymentsAnalysisBoard({
  summary,
  loading,
}: {
  summary?: PaymentsSummaryView | null;
  loading?: boolean;
}) {
  if (loading && !summary?.analysis) {
    return <div className="h-64 animate-pulse rounded-2xl border bg-card" />;
  }
  const analysis = summary?.analysis;
  if (!summary || !analysis) {
    return (
      <div className="rounded-2xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        No payment figures in this filter.
      </div>
    );
  }

  const health = [
    { label: "Paid", value: analysis.paidCount, color: "bg-emerald-500" },
    { label: "Partial", value: analysis.partialCount, color: "bg-sky-500" },
    { label: "Pending", value: analysis.pendingCount, color: "bg-amber-500" },
    { label: "Overdue", value: analysis.overdueInstallmentCount, color: "bg-rose-500" },
  ];
  const healthTotal = Math.max(
    1,
    health.reduce((sum, item) => sum + item.value, 0),
  );
  const maxBand = Math.max(1, ...analysis.collectionBands.map((band) => band.count));

  return (
    <div className="space-y-3 py-3">
      <div>
        <h2 className="text-sm font-semibold">Payment analysis</h2>
        <p className="text-[11px] text-muted-foreground">
          {summary.accountCount ?? 0} accounts in the current filters. Installment figures include
          every scheduled line, not only the next due.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Deal value"
          value={formatPaymentsInr(summary.totalContractValue)}
          detail={`${summary.collectionRatePercent}% collected`}
          tone="text-foreground"
        />
        <Metric
          label="Received"
          value={formatPaymentsInr(summary.totalReceived)}
          detail={`Avg ${analysis.avgCollectionPercent}% per account`}
          tone="text-emerald-600 dark:text-emerald-400"
        />
        <Metric
          label="Still to collect"
          value={formatPaymentsInr(summary.totalPending)}
          detail={`${formatPaymentsInr(summary.totalOverdueAmount)} overdue · ${summary.overdueAccountCount} accounts`}
          tone="text-amber-700 dark:text-amber-400"
        />
        <Metric
          label="Renewals"
          value={String(analysis.renewalAccountCount)}
          detail={`${formatPaymentsInr(analysis.renewalCollected)} collected beyond deal · ${formatPaymentsInr(analysis.renewalInstallmentRemaining)} renewal installments open`}
          tone="text-violet-700 dark:text-violet-400"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-3">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="text-xs font-semibold">Installment health</h3>
            <span className="text-[10px] text-muted-foreground">
              {analysis.installmentCount} lines · {formatPaymentsInr(analysis.scheduledAmount)}{" "}
              scheduled
            </span>
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
            {health.map((item) => (
              <div
                key={item.label}
                className={item.color}
                style={{ width: `${(item.value / healthTotal) * 100}%` }}
              />
            ))}
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {health.map((item) => (
              <div key={item.label}>
                <div className="text-[10px] text-muted-foreground">{item.label}</div>
                <div className="text-sm font-semibold tabular-nums">{item.value}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {formatPaymentsInr(analysis.paidOnInstallments)} applied to installments ·{" "}
            {formatPaymentsInr(analysis.remainingAmount)} still open
          </p>
        </section>

        <section className="rounded-2xl border bg-card p-3">
          <h3 className="mb-2 text-xs font-semibold">Collection depth</h3>
          <div className="space-y-2">
            {analysis.collectionBands.map((band, index) => (
              <div key={band.key}>
                <div className="mb-0.5 flex justify-between text-[11px]">
                  <span>{band.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {band.count} · {formatPaymentsInr(band.pending)} pending
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(band.count / maxBand) * 100}%`,
                      background: BAND_COLORS[index] ?? "#64748b",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard
          title="Open installments by due month"
          empty={analysis.schedule.length === 0}
          emptyLabel="No open installments in this filter."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analysis.schedule} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={shortInr} />
              <Tooltip
                formatter={(value: number) => formatPaymentsInr(value)}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar
                dataKey="dealRemaining"
                name="Deal installments"
                stackId="due"
                fill="#f59e0b"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="renewalRemaining"
                name="Renewal installments"
                stackId="due"
                fill="#8b5cf6"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard
          title="License renewals by end month"
          empty={analysis.renewalsByMonth.length === 0}
          emptyLabel="No renewal dates in this filter."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={analysis.renewalsByMonth}
              margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={shortInr} />
              <Tooltip
                formatter={(value: number, name: string) =>
                  name === "count" ? [value, "Accounts"] : [formatPaymentsInr(value), "Deal value"]
                }
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="dealValue" name="Deal value" fill="#009bff" radius={[3, 3, 0, 0]}>
                {analysis.renewalsByMonth.map((row) => (
                  <Cell key={row.month} fill="#009bff" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <section className="rounded-2xl border bg-card p-3">
          <h3 className="mb-2 text-xs font-semibold">Support 1 · open balance</h3>
          {analysis.bySupport.length === 0 ? (
            <p className="text-xs text-muted-foreground">No accounts in this filter.</p>
          ) : (
            <ul className="space-y-2">
              {analysis.bySupport.map((row) => (
                <li key={row.name} className="text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="truncate font-medium">{row.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{row.rate}%</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {row.accounts} accounts · {formatPaymentsInr(row.pending)} pending
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <AccountList
          title="Largest balances"
          empty="Nothing pending in this filter."
          rows={analysis.largestPending.map((row) => ({
            id: row.id,
            name: row.name,
            primary: formatPaymentsInr(row.pending),
            secondary: `${row.percent}% of ${formatPaymentsInr(row.deal)} collected`,
          }))}
        />
        <AccountList
          title="Largest overdue"
          empty="No overdue amount in this filter."
          rows={analysis.largestOverdue.map((row) => ({
            id: row.id,
            name: row.name,
            primary: formatPaymentsInr(row.overdue),
            secondary: row.days != null ? `${row.days} days past due` : "Past due",
          }))}
        />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border bg-card px-3 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${tone}`}>{value}</div>
      <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{detail}</div>
    </div>
  );
}

function ChartCard({
  title,
  empty,
  emptyLabel,
  children,
}: {
  title: string;
  empty: boolean;
  emptyLabel: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-3">
      <h3 className="mb-2 text-xs font-semibold">{title}</h3>
      {empty ? (
        <p className="flex h-48 items-center justify-center text-xs text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        <div className="h-52">{children}</div>
      )}
    </section>
  );
}

function AccountList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: { id: string; name: string; primary: string; secondary: string }[];
}) {
  return (
    <section className="rounded-2xl border bg-card p-3">
      <h3 className="mb-2 text-xs font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-2 text-xs">
              <div className="min-w-0">
                <Link
                  to="/crm/accounts/$accountId"
                  params={{ accountId: row.id }}
                  className="block truncate font-medium hover:underline"
                >
                  {row.name}
                </Link>
                <div className="text-[10px] text-muted-foreground">{row.secondary}</div>
              </div>
              <div className="shrink-0 tabular-nums">{row.primary}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function shortInr(value: number) {
  if (value >= 10000000) return `${Math.round(value / 10000000)}Cr`;
  if (value >= 100000) return `${Math.round(value / 100000)}L`;
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return String(value);
}
