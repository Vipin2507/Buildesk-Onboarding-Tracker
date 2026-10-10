import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, FileSpreadsheet, RefreshCw, Search } from "lucide-react";
import { z } from "zod";

import { CompanyCommercialBulkUpdateModal } from "@/components/companies/company-commercial-bulk-update-modal";
import { DataTable } from "@/components/data-table";
import {
  DesignTicketPageHeader,
  DesignTicketFilterBar,
} from "@/components/design-ticket/design-ticket-shared";
import { EmptyState } from "@/components/empty-state";
import { PageWrap } from "@/components/page-header";
import { ProgressBar } from "@/components/progress-bar";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { erpPaymentsKeys, useErpCompanyPaymentsList } from "@/hooks/use-erp-payments";
import { COMPANY_PAYMENT_STATUSES, type CompanyPaymentStatus } from "@/types";
import { cn, formatDate, formatInr } from "@/lib/utils";

const searchSchema = z.object({
  status: z.enum(["all", ...COMPANY_PAYMENT_STATUSES]).optional(),
});

export const Route = createFileRoute("/payments")({
  validateSearch: (search) => searchSchema.parse(search),
  component: ErpPaymentsPage,
});

type StatusFilter = "all" | CompanyPaymentStatus;

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  ...COMPANY_PAYMENT_STATUSES.map((s) => ({ id: s as StatusFilter, label: s })),
];

function paymentStatusTone(status: CompanyPaymentStatus) {
  if (status === "Fully paid") return "success" as const;
  if (status === "Partially paid" || status === "Part payment subscription") return "warning" as const;
  if (status === "Pending") return "danger" as const;
  return "muted" as const;
}

function ErpPaymentsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const statusFilter: StatusFilter = search.status ?? "all";
  const { data, isLoading, isError, refetch, isFetching } = useErpCompanyPaymentsList();
  const [query, setQuery] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);

  const filteredRows = useMemo(() => {
    const rows = data?.rows ?? [];
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.paymentStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        r.companyName.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q) ||
        (r.commercialStatus?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [data?.rows, query, statusFilter]);

  function setStatusFilter(next: StatusFilter) {
    void navigate({
      search: { status: next === "all" ? undefined : next },
      replace: true,
    });
  }

  const summary = data?.summary;

  return (
    <PageWrap compact>
      <DesignTicketPageHeader
        compact
        title="Payments"
        subtitle="ERP collections across onboarded companies — separate from CRM account payments."
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" className="h-8 gap-1" onClick={() => setBulkOpen(true)}>
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Bulk update
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
              Refresh
            </Button>
          </div>
        }
      />

      {summary ? (
        <div className="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Companies" value={String(summary.companyCount)} />
          <SummaryCard label="Total deal" value={formatInr(summary.totalDealSize)} />
          <SummaryCard label="Received" value={formatInr(summary.totalReceived)} />
          <SummaryCard label="Pending" value={formatInr(summary.totalPending)} />
          <SummaryCard
            label="Fully paid"
            value={`${summary.fullyPaidCount} / ${summary.companyCount}`}
          />
        </div>
      ) : null}

      <DesignTicketFilterBar className="mb-3">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search company or city…"
            className="h-8 pl-8 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                statusFilter === f.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </DesignTicketFilterBar>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading ERP payments…</p>
      ) : isError ? (
        <EmptyState
          title="Could not load payments"
          description="Try refreshing. This hub uses ERP company ledgers only."
          actionLabel="Retry"
          onAction={() => void refetch()}
        />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          title="No companies match"
          description="Adjust filters or add commercial data on a company Details tab."
        />
      ) : (
        <DataTable
          data={filteredRows}
          getRowId={(r) => r.companyId}
          hideSearch
          pageSize={20}
          flush
          columns={[
            {
              key: "company",
              header: "Company",
              render: (r) => (
                <div className="min-w-0">
                  <Link
                    to="/companies/$companyId"
                    params={{ companyId: r.companyId }}
                    search={{ tab: "Payments" }}
                    className="font-medium text-primary hover:underline"
                  >
                    {r.companyName}
                  </Link>
                  <div className="text-[11px] text-muted-foreground">{r.city}</div>
                </div>
              ),
            },
            {
              key: "commercial",
              header: "Subscription",
              render: (r) =>
                r.commercialStatus ? (
                  <Pill tone="muted">{r.commercialStatus}</Pill>
                ) : (
                  <span className="text-muted-foreground">—</span>
                ),
            },
            {
              key: "deal",
              header: "Deal",
              render: (r) => <span className="tabular-nums">{formatInr(r.dealSize)}</span>,
            },
            {
              key: "received",
              header: "Received",
              render: (r) => <span className="tabular-nums">{formatInr(r.paymentReceived)}</span>,
            },
            {
              key: "pending",
              header: "Pending",
              render: (r) => (
                <span className="font-medium tabular-nums">{formatInr(r.pendingAmount)}</span>
              ),
            },
            {
              key: "progress",
              header: "Collected",
              render: (r) => (
                <div className="min-w-[7rem]">
                  <ProgressBar value={r.collectionPercent} />
                  <div className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                    {r.collectionPercent}%
                  </div>
                </div>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (r) => <Pill tone={paymentStatusTone(r.paymentStatus)}>{r.paymentStatus}</Pill>,
            },
            {
              key: "due",
              header: "Installment due",
              render: (r) => (
                <span className="text-xs tabular-nums">
                  {r.installmentDueDate ? formatDate(r.installmentDueDate) : "—"}
                </span>
              ),
            },
            {
              key: "ledger",
              header: "Ledger",
              render: (r) => <span className="tabular-nums">{r.transactionCount}</span>,
            },
            {
              key: "open",
              header: "",
              render: (r) => (
                <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" asChild>
                  <Link
                    to="/companies/$companyId"
                    params={{ companyId: r.companyId }}
                    search={{ tab: "Payments" }}
                  >
                    Open <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              ),
            },
          ]}
        />
      )}

      <CompanyCommercialBulkUpdateModal
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title="Bulk update payments"
        description="Upload your ERP payments Excel sheet (Status, Name, Total Deal Value, Amount WITH GST, Taxable, GST, Plan Name, Payment status, Installment amount, Due date, Start date, End date / Renewal date, Cancelled On). Rows match companies by name. Quantity is ignored. Empty cells leave current values unchanged."
        onSuccess={() => {
          void queryClient.invalidateQueries({ queryKey: erpPaymentsKeys.list() });
        }}
      />
    </PageWrap>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-soft flex flex-col gap-0.5 px-3 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="truncate text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
