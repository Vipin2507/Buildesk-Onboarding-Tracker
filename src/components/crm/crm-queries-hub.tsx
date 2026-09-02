import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Search } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { DesignTicketFilterBar, TICKET_EASE } from "@/components/design-ticket/design-ticket-shared";
import { EmptyState } from "@/components/empty-state";
import { PageWrap } from "@/components/page-header";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CRM_ACCOUNT_QUERY_CATEGORY_LABEL,
  CRM_ACCOUNT_QUERY_STATUS_LABEL,
  type CrmAccountQueryStatus,
  type CrmAccountQuerySummary,
} from "@/types/crm-account-query";
import { useCrmAccountQueryStore } from "@/stores";
import { cn, formatDate, formatTime } from "@/lib/utils";

const STATUS_FILTERS = ["all", "open", "resolved", "archived"] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number];

function statusTone(status: CrmAccountQueryStatus) {
  if (status === "open") return "warning" as const;
  if (status === "resolved") return "success" as const;
  return "muted" as const;
}

type Props = {
  statusFilter: StatusFilter;
  onStatusFilterChange: (status: StatusFilter) => void;
  selectedQueryId?: string;
};

export function CrmQueriesHub({ statusFilter, onStatusFilterChange, selectedQueryId }: Props) {
  const navigate = useNavigate();
  const tableRef = useRef<HTMLDivElement>(null);
  const allQueries = useCrmAccountQueryStore((s) => s.allQueries);
  const loading = useCrmAccountQueryStore((s) => s.allQueriesLoading);
  const refreshAllQueries = useCrmAccountQueryStore((s) => s.refreshAllQueries);
  const refreshCompanyQueries = useCrmAccountQueryStore((s) => s.refreshCompanyQueries);

  const [search, setSearch] = useState("");

  useEffect(() => {
    void refreshAllQueries("all").catch((err) => {
      toast.error(err instanceof Error ? err.message : "Failed to load queries");
    });
  }, [refreshAllQueries]);

  const counts = useMemo(() => {
    const base = { all: allQueries.length, open: 0, resolved: 0, archived: 0 };
    for (const q of allQueries) {
      if (q.status in base) base[q.status as keyof typeof base] += 1;
    }
    return base;
  }, [allQueries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allQueries
      .filter((row) => statusFilter === "all" || row.status === statusFilter)
      .filter((row) => {
        if (!q) return true;
        return (
          row.title.toLowerCase().includes(q) ||
          row.accountName?.toLowerCase().includes(q) ||
          row.createdByName.toLowerCase().includes(q) ||
          row.lastMessagePreview?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [allQueries, search, statusFilter]);

  const columns = useMemo(
    () => [
      {
        key: "account",
        header: "Account",
        render: (row: CrmAccountQuerySummary) => (
          <span className="font-medium">{row.accountName ?? "—"}</span>
        ),
      },
      {
        key: "title",
        header: "Subject",
        render: (row: CrmAccountQuerySummary) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.title}</p>
            <p className="truncate text-[10px] text-muted-foreground">
              {row.lastMessagePreview ?? "No messages yet"}
            </p>
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (row: CrmAccountQuerySummary) => (
          <Pill tone={statusTone(row.status)} className="text-[9px]">
            {CRM_ACCOUNT_QUERY_STATUS_LABEL[row.status]}
          </Pill>
        ),
      },
      {
        key: "category",
        header: "Category",
        render: (row: CrmAccountQuerySummary) =>
          row.category ? CRM_ACCOUNT_QUERY_CATEGORY_LABEL[row.category] : "—",
      },
      {
        key: "author",
        header: "Started by",
        render: (row: CrmAccountQuerySummary) => row.createdByName,
      },
      {
        key: "updated",
        header: "Updated",
        render: (row: CrmAccountQuerySummary) => (
          <span className="tabular-nums text-muted-foreground">
            {formatDate(row.updatedAt)} {formatTime(row.updatedAt)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <PageWrap compact flushTop>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: TICKET_EASE }}
        className="space-y-3"
      >
        <div className="mb-0 border-b border-border pb-2 pt-1">
          <div className="min-w-0">
            <h1 className="text-base font-medium tracking-tight">Account queries</h1>
            <p className="text-xs text-muted-foreground">
              All internal discussions across your accounts
            </p>
          </div>

          <DesignTicketFilterBar className="mt-2">
            {STATUS_FILTERS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onStatusFilterChange(id)}
                className={cn(
                  "flex min-w-[5.5rem] flex-col rounded-lg border px-2.5 py-1.5 text-left transition-colors",
                  statusFilter === id
                    ? "border-primary/40 bg-primary/5"
                    : "border-border/60 bg-card hover:border-border",
                )}
              >
                <span className="text-[10px] capitalize text-muted-foreground">{id}</span>
                <span className="text-lg font-semibold tabular-nums leading-tight">
                  {counts[id]}
                </span>
              </button>
            ))}
          </DesignTicketFilterBar>

          <div className="relative mt-2 max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search account, subject, or author…"
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        {loading && allQueries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading queries…</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No queries found"
            description={
              statusFilter === "all"
                ? "Internal account discussions will appear here."
                : `No ${statusFilter} queries match your filters.`
            }
          />
        ) : (
          <div ref={tableRef}>
            <DataTable
              data={filtered}
              columns={columns}
              hideSearch
              density="compact"
              flush
              pageSize={25}
              getRowId={(row) => row.id}
              actions={(row) => (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 px-2 text-[10px]"
                  onClick={() => {
                    void refreshCompanyQueries(row.companyId)
                      .catch(() => {})
                      .finally(() => {
                        void navigate({
                          to: "/crm/accounts/$accountId",
                          params: { accountId: row.companyId },
                          search: { tab: "queries", queryId: row.id },
                        });
                      });
                  }}
                >
                  Open
                  <ArrowRight className="h-3 w-3" />
                </Button>
              )}
            />
          </div>
        )}
      </motion.div>
    </PageWrap>
  );
}
