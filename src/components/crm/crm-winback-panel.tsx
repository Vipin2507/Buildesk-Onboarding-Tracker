import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  Pause,
  Play,
  Plus,
  Search,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import {
  DesignTicketFilterField,
  DesignTicketSelect,
} from "@/components/design-ticket/design-ticket-fields";
import {
  DesignTicketFilterBar,
  DesignTicketTabNav,
} from "@/components/design-ticket/design-ticket-shared";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  bulkUpdateCrmWinbackContacts,
  cancelCrmWinbackCampaign,
  createCrmWinbackCampaign,
  getCrmWinbackCampaign,
  importCrmWinbackContacts,
  listCrmWinbackActivity,
  listCrmWinbackCampaigns,
  listCrmWinbackContacts,
  pauseCrmWinbackCampaign,
  resumeCrmWinbackCampaign,
  updateCrmWinbackContact,
} from "@/lib/api";
import { CRM_WINBACK_WAVE_LIMIT } from "@/lib/crm-winback-limits";
import { parseWinbackCsv } from "@/lib/crm-winback-import";
import {
  campaignSemantic,
  outcomeSemantic,
  type WbSemantic,
} from "@/lib/crm-winback-tokens";
import { formatDate, formatDateTime } from "@/lib/utils";
import type {
  CrmWinbackCampaign,
  CrmWinbackContact,
  CrmWinbackDelivery,
  CrmWinbackOutcome,
} from "@/types/crm-winback";
import { CRM_WINBACK_OUTCOME_LABELS } from "@/types/crm-winback";

type TabId = "contacts" | "campaigns" | "activity";
type OutcomeChipId = "all" | CrmWinbackOutcome;
type ContactedFilter = "all" | "yes" | "no";
type CampaignStatusFilter = "all" | CrmWinbackCampaign["status"];
type ActivityStatusFilter = "all" | CrmWinbackDelivery["status"];

const TABS = [
  { id: "contacts" as const, label: "Contacts" },
  { id: "campaigns" as const, label: "Campaigns" },
  { id: "activity" as const, label: "Activity" },
];

const OUTCOME_CHIPS: { id: OutcomeChipId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "none", label: "Not contacted" },
  { id: "interested", label: "Interested" },
  { id: "callback", label: "Callback" },
  { id: "not_interested", label: "Not interested" },
  { id: "wrong_number", label: "Wrong number" },
  { id: "do_not_contact", label: "Do not contact" },
];

const OUTCOME_OPTIONS = Object.entries(CRM_WINBACK_OUTCOME_LABELS).map(([value, label]) => ({
  value,
  label,
}));

function WbPill({ tone, children }: { tone: WbSemantic; children: ReactNode }) {
  return (
    <span className="crm-winback-pill" data-tone={tone}>
      <span className="crm-winback-dot" data-tone={tone} aria-hidden />
      {children}
    </span>
  );
}

export function CrmWinbackPanel() {
  const [tab, setTab] = useState<TabId>("contacts");
  const [contacts, setContacts] = useState<CrmWinbackContact[]>([]);
  const [campaigns, setCampaigns] = useState<CrmWinbackCampaign[]>([]);
  const [activity, setActivity] = useState<CrmWinbackDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [outcomeChip, setOutcomeChip] = useState<OutcomeChipId>("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [contactedFilter, setContactedFilter] = useState<ContactedFilter>("all");
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<CampaignStatusFilter>("all");
  const [activityStatusFilter, setActivityStatusFilter] = useState<ActivityStatusFilter>("all");
  const [activityQuery, setActivityQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [batchOffset, setBatchOffset] = useState(0);
  const [importing, setImporting] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [campaignBody, setCampaignBody] = useState(
    "Hi {{contactPerson}},\n\nWe miss working with {{companyName}}. Ready to restart Buildesk CRM?\n\nReply YES and we will connect you with your account team.",
  );
  const [scheduleLocal, setScheduleLocal] = useState("");
  const [sendNow, setSendNow] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [campaignDetail, setCampaignDetail] = useState<CrmWinbackDelivery[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [contactRes, campaignRes, activityRes] = await Promise.all([
        listCrmWinbackContacts({ data: { limit: 2000 } }),
        listCrmWinbackCampaigns({ data: { limit: 50 } }),
        listCrmWinbackActivity({ data: { limit: 200 } }),
      ]);
      setContacts(contactRes.contacts);
      setCampaigns(campaignRes.campaigns);
      setActivity(activityRes.deliveries);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load Win-back");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const hasActive = campaigns.some((c) => c.status === "scheduled" || c.status === "running");
    if (!hasActive) return;
    const id = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(id);
  }, [campaigns, refresh]);

  const cityOptions = useMemo(() => {
    const cities = [
      ...new Set(contacts.map((c) => c.city?.trim()).filter((c): c is string => Boolean(c))),
    ].sort((a, b) => a.localeCompare(b));
    return [{ value: "all", label: "All cities" }, ...cities.map((c) => ({ value: c, label: c }))];
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (outcomeChip !== "all" && contact.outcome !== outcomeChip) return false;
      if (cityFilter !== "all" && (contact.city?.trim() || "") !== cityFilter) return false;
      if (contactedFilter === "yes" && !contact.lastContactedAt) return false;
      if (contactedFilter === "no" && contact.lastContactedAt) return false;
      if (!q) return true;
      return (
        contact.companyName.toLowerCase().includes(q) ||
        contact.contactPerson.toLowerCase().includes(q) ||
        contact.mobile.toLowerCase().includes(q) ||
        (contact.city ?? "").toLowerCase().includes(q) ||
        (contact.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [contacts, query, outcomeChip, cityFilter, contactedFilter]);

  const outcomeCounts = useMemo(() => {
    const counts: Record<OutcomeChipId, number> = {
      all: contacts.length,
      none: 0,
      interested: 0,
      callback: 0,
      not_interested: 0,
      wrong_number: 0,
      do_not_contact: 0,
    };
    for (const contact of contacts) {
      counts[contact.outcome] += 1;
    }
    return counts;
  }, [contacts]);

  const activeFilterCount =
    (cityFilter !== "all" ? 1 : 0) + (contactedFilter !== "all" ? 1 : 0) + (query.trim() ? 1 : 0);

  const filteredCampaigns = useMemo(() => {
    if (campaignStatusFilter === "all") return campaigns;
    return campaigns.filter((c) => c.status === campaignStatusFilter);
  }, [campaigns, campaignStatusFilter]);

  const filteredActivity = useMemo(() => {
    const q = activityQuery.trim().toLowerCase();
    return activity.filter((row) => {
      if (activityStatusFilter !== "all" && row.status !== activityStatusFilter) return false;
      if (!q) return true;
      return (
        row.companyName.toLowerCase().includes(q) ||
        row.contactPerson.toLowerCase().includes(q) ||
        row.mobile.toLowerCase().includes(q)
      );
    });
  }, [activity, activityQuery, activityStatusFilter]);

  const eligibleContacts = useMemo(
    () => filteredContacts.filter((c) => c.outcome !== "do_not_contact"),
    [filteredContacts],
  );

  const eligibleSelected = useMemo(
    () => contacts.filter((c) => selectedIds.has(c.id) && c.outcome !== "do_not_contact").length,
    [contacts, selectedIds],
  );

  function clearFilters() {
    setQuery("");
    setCityFilter("all");
    setContactedFilter("all");
  }

  function toggleSelection(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleSelectionAll(ids: string[], checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function selectEligibleBatch(start: number) {
    const slice = eligibleContacts.slice(start, start + CRM_WINBACK_WAVE_LIMIT).map((c) => c.id);
    setSelectedIds(new Set(slice));
    setBatchOffset(start);
  }

  function selectNextBatch() {
    const nextStart =
      batchOffset + CRM_WINBACK_WAVE_LIMIT < eligibleContacts.length
        ? batchOffset + CRM_WINBACK_WAVE_LIMIT
        : 0;
    selectEligibleBatch(nextStart);
  }

  async function onImportFile(file: File | null) {
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = parseWinbackCsv(text);
      if (parsed.errors.length) toast.message(parsed.errors.slice(0, 3).join(" · "));
      if (!parsed.rows.length) {
        toast.error("No valid rows found");
        return;
      }
      const result = await importCrmWinbackContacts({ data: { rows: parsed.rows } });
      toast.success(
        `Import done · ${result.created} new · ${result.updated} updated · ${result.skipped} skipped`,
      );
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function setOutcome(ids: string[], outcome: CrmWinbackOutcome) {
    try {
      await bulkUpdateCrmWinbackContacts({ data: { ids, outcome } });
      toast.success("Outcome updated");
      setSelectedIds(new Set());
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update");
    }
  }

  async function onOutcomeChange(id: string, outcome: CrmWinbackOutcome) {
    try {
      await updateCrmWinbackContact({ data: { id, outcome } });
      setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, outcome } : c)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  }

  async function createCampaign() {
    if (selectedIds.size === 0) {
      toast.error("Select at least one contact");
      return;
    }
    if (!campaignName.trim() || !campaignBody.trim()) {
      toast.error("Campaign name and message are required");
      return;
    }
    setSubmitting(true);
    try {
      const scheduledAt =
        !sendNow && scheduleLocal ? new Date(scheduleLocal).toISOString() : undefined;
      await createCrmWinbackCampaign({
        data: {
          name: campaignName.trim(),
          body: campaignBody.trim(),
          contactIds: [...selectedIds],
          sendNow,
          scheduledAt,
          waveSize: CRM_WINBACK_WAVE_LIMIT,
        },
      });
      toast.success(sendNow ? "Campaign started" : "Campaign scheduled");
      setComposeOpen(false);
      setCampaignName("");
      setSelectedIds(new Set());
      setTab("campaigns");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create campaign");
    } finally {
      setSubmitting(false);
    }
  }

  async function openCampaign(id: string) {
    if (expandedCampaignId === id) {
      setExpandedCampaignId(null);
      setCampaignDetail([]);
      return;
    }
    setExpandedCampaignId(id);
    try {
      const detail = await getCrmWinbackCampaign({ data: { id } });
      setCampaignDetail(detail.deliveries);
    } catch {
      toast.error("Could not load campaign detail");
    }
  }

  const nextBatchCount = Math.min(
    CRM_WINBACK_WAVE_LIMIT,
    Math.max(0, eligibleContacts.length - (batchOffset + CRM_WINBACK_WAVE_LIMIT)),
  );

  return (
    <div className="crm-winback space-y-0">
      <div className="crm-winback-hero mb-3">
        <div className="relative z-[1] flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="crm-winback-title">Win-back</h1>
            <p className="crm-winback-subtitle">
              {contacts.length} {contacts.length === 1 ? "former client" : "former clients"} · waves of{" "}
              {CRM_WINBACK_WAVE_LIMIT} · WhatsApp outreach
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => void onImportFile(e.target.files?.[0] ?? null)}
            />
            <Button
              size="sm"
              variant="outline"
              className="crm-winback-btn-ghost h-8 gap-1 px-3 text-xs"
              disabled={importing}
              onClick={() => fileRef.current?.click()}
            >
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Import CSV
            </Button>
            <Button
              size="sm"
              className="crm-winback-btn-primary h-8 gap-1 px-3 text-xs"
              disabled={selectedIds.size === 0}
              onClick={() => setComposeOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              New campaign ({eligibleSelected})
            </Button>
          </div>
        </div>

        {tab === "contacts" ? (
          <div
            className="relative z-[1] mt-3 flex min-w-0 gap-1.5 overflow-x-auto pb-0.5"
            role="tablist"
            aria-label="Outcome filters"
          >
            {OUTCOME_CHIPS.map((chip) => {
              const active = outcomeChip === chip.id;
              const count = outcomeCounts[chip.id];
              const tone = outcomeSemantic(chip.id);
              return (
                <button
                  key={chip.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-active={active}
                  data-tone={tone}
                  onClick={() => setOutcomeChip(chip.id)}
                  className="crm-winback-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--wb-primary-400)]"
                >
                  <span className="crm-winback-chip-label truncate">{chip.label}</span>
                  <span className="crm-winback-chip-count">{count}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <DesignTicketTabNav
        compact
        tabs={TABS.map((item) => ({ id: item.id, label: item.label }))}
        activeId={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      {tab === "contacts" ? (
        <>
          <DesignTicketFilterBar
            variant="inline"
            compact
            className="xl:grid-cols-4"
            activeFilterCount={activeFilterCount}
            onClear={clearFilters}
            resultCount={filteredContacts.length}
            resultLabel={filteredContacts.length === 1 ? "contact" : "contacts"}
            trailing={
              <div className="relative min-w-[140px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search company, contact, mobile…"
                  aria-label="Search contacts"
                  className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
            }
          >
            <DesignTicketFilterField label="City" compact>
              <DesignTicketSelect compact value={cityFilter} onChange={setCityFilter} options={cityOptions} />
            </DesignTicketFilterField>
            <DesignTicketFilterField label="Contacted" compact>
              <DesignTicketSelect
                compact
                value={contactedFilter}
                onChange={(v) => setContactedFilter(v as ContactedFilter)}
                options={[
                  { value: "all", label: "Any" },
                  { value: "no", label: "Never contacted" },
                  { value: "yes", label: "Contacted before" },
                ]}
              />
            </DesignTicketFilterField>
            <DesignTicketFilterField label="Outcome" compact>
              <DesignTicketSelect
                compact
                value={outcomeChip}
                onChange={(v) => setOutcomeChip(v as OutcomeChipId)}
                options={[
                  { value: "all", label: "All outcomes" },
                  ...OUTCOME_OPTIONS,
                ]}
              />
            </DesignTicketFilterField>
          </DesignTicketFilterBar>

          {selectedIds.size > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="crm-winback-selection"
            >
              <span className="text-xs font-semibold" style={{ color: "var(--wb-primary-700)" }}>
                {selectedIds.size} {selectedIds.size === 1 ? "contact" : "contacts"} selected
              </span>
              <Button
                size="sm"
                className="crm-winback-btn-primary h-7 gap-1 text-xs"
                onClick={() => setComposeOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Campaign ({eligibleSelected})
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                style={{ borderColor: "var(--wb-success-200)", color: "var(--wb-success-700)" }}
                onClick={() => void setOutcome([...selectedIds], "interested")}
              >
                Mark interested
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                style={{ borderColor: "var(--wb-warning-200)", color: "var(--wb-warning-700)" }}
                onClick={() => void setOutcome([...selectedIds], "callback")}
              >
                Callback
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                style={{ borderColor: "var(--wb-error-200)", color: "var(--wb-error-700)" }}
                onClick={() => void setOutcome([...selectedIds], "do_not_contact")}
              >
                Do not contact
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => selectEligibleBatch(0)}
              >
                First {CRM_WINBACK_WAVE_LIMIT}
              </Button>
              {eligibleContacts.length > CRM_WINBACK_WAVE_LIMIT ? (
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={selectNextBatch}>
                  Next {nextBatchCount || CRM_WINBACK_WAVE_LIMIT}
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </Button>
            </motion.div>
          ) : (
            <div className="crm-winback-muted mb-2 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="tabular-nums">
                {filteredContacts.length} shown · {eligibleContacts.length} eligible
              </span>
              <button type="button" className="crm-winback-link" onClick={() => selectEligibleBatch(0)}>
                Select first{" "}
                {Math.min(CRM_WINBACK_WAVE_LIMIT, eligibleContacts.length || CRM_WINBACK_WAVE_LIMIT)}
              </button>
              {eligibleContacts.length > CRM_WINBACK_WAVE_LIMIT ? (
                <button type="button" className="crm-winback-link" onClick={selectNextBatch}>
                  Next {CRM_WINBACK_WAVE_LIMIT}
                </button>
              ) : null}
            </div>
          )}

          {loading && contacts.length === 0 ? (
            <p className="px-1 py-10 text-center text-sm text-muted-foreground">Loading contacts…</p>
          ) : contacts.length === 0 ? (
            <EmptyState
              title="No former clients yet"
              description="Import a CSV with CompanyName, ContactPerson, and Mobile to start win-back outreach."
              actionLabel="Import CSV"
              onAction={() => fileRef.current?.click()}
            />
          ) : filteredContacts.length === 0 ? (
            <EmptyState
              title="No matches"
              description="Try another filter, clear filters, or adjust your search."
              actionLabel="Clear filters"
              onAction={clearFilters}
            />
          ) : (
            <div className="crm-winback-table-shell [&_tbody_tr]:bg-transparent [&_thead]:bg-[var(--wb-neutral-50)]">
              <DataTable
                flush
                data={filteredContacts}
                getRowId={(r) => r.id}
                hideSearch
                searchQuery={query}
                onSearchQueryChange={setQuery}
                density="compact"
                pageSize={50}
                selection={{
                  selectedIds,
                  onToggle: toggleSelection,
                  onToggleAll: toggleSelectionAll,
                }}
                getRowClassName={(r) =>
                  r.outcome === "do_not_contact"
                    ? "crm-winback-row-dnc"
                    : r.outcome === "interested"
                      ? "crm-winback-row-interested"
                      : undefined
                }
                columns={[
                  {
                    key: "companyName",
                    header: "Company",
                    sortable: true,
                    className: "min-w-[11rem]",
                    render: (r) => (
                      <div className="min-w-0">
                        <div className="truncate font-medium" style={{ color: "var(--wb-neutral-900)" }}>
                          {r.companyName}
                        </div>
                        {r.email ? (
                          <div className="crm-winback-muted truncate text-[10px]">{r.email}</div>
                        ) : null}
                      </div>
                    ),
                  },
                  {
                    key: "contactPerson",
                    header: "Contact",
                    sortable: true,
                    className: "min-w-[8rem]",
                    render: (r) => (
                      <div className="min-w-0 text-xs">
                        <div className="truncate font-medium" style={{ color: "var(--wb-neutral-800)" }}>
                          {r.contactPerson || "—"}
                        </div>
                        <div className="crm-winback-muted font-mono tabular-nums">{r.mobile}</div>
                      </div>
                    ),
                  },
                  {
                    key: "city",
                    header: "City",
                    sortable: true,
                    className: "w-[7rem]",
                    render: (r) => (
                      <span className="crm-winback-muted text-xs">{r.city || "—"}</span>
                    ),
                  },
                  {
                    key: "outcome",
                    header: "Outcome",
                    sortable: true,
                    className: "w-[10.5rem]",
                    render: (r) => (
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <span
                          className="crm-winback-dot"
                          data-tone={outcomeSemantic(r.outcome)}
                          aria-hidden
                        />
                        <select
                          className="crm-winback-select"
                          value={r.outcome}
                          aria-label={`Outcome for ${r.companyName}`}
                          onChange={(e) =>
                            void onOutcomeChange(r.id, e.target.value as CrmWinbackOutcome)
                          }
                        >
                          {OUTCOME_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ),
                  },
                  {
                    key: "lastContactedAt",
                    header: "Last contact",
                    sortable: true,
                    className: "w-[7.5rem]",
                    render: (r) => (
                      <span className="crm-winback-muted text-xs tabular-nums">
                        {r.lastContactedAt ? formatDate(r.lastContactedAt) : "—"}
                      </span>
                    ),
                  },
                ]}
              />
            </div>
          )}
        </>
      ) : null}

      {tab === "campaigns" ? (
        <>
          <DesignTicketFilterBar
            variant="inline"
            compact
            className="xl:grid-cols-3"
            activeFilterCount={campaignStatusFilter !== "all" ? 1 : 0}
            onClear={() => setCampaignStatusFilter("all")}
            resultCount={filteredCampaigns.length}
            resultLabel={filteredCampaigns.length === 1 ? "campaign" : "campaigns"}
          >
            <DesignTicketFilterField label="Status" compact>
              <DesignTicketSelect
                compact
                value={campaignStatusFilter}
                onChange={(v) => setCampaignStatusFilter(v as CampaignStatusFilter)}
                options={[
                  { value: "all", label: "All statuses" },
                  { value: "scheduled", label: "Scheduled" },
                  { value: "running", label: "Running" },
                  { value: "paused", label: "Paused" },
                  { value: "done", label: "Done" },
                  { value: "cancelled", label: "Cancelled" },
                ]}
              />
            </DesignTicketFilterField>
          </DesignTicketFilterBar>

          {loading && campaigns.length === 0 ? (
            <p className="px-1 py-10 text-center text-sm text-muted-foreground">Loading campaigns…</p>
          ) : campaigns.length === 0 ? (
            <EmptyState
              title="No campaigns yet"
              description="Select contacts on the Contacts tab, then create a WhatsApp win-back campaign."
              actionLabel="Go to contacts"
              onAction={() => setTab("contacts")}
            />
          ) : filteredCampaigns.length === 0 ? (
            <EmptyState
              title="No matches"
              description="No campaigns match this status filter."
              actionLabel="Clear filters"
              onAction={() => setCampaignStatusFilter("all")}
            />
          ) : (
            <div className="crm-winback-table-shell">
              <DataTable
                flush
                data={filteredCampaigns}
                getRowId={(r) => r.id}
                hideSearch
                density="compact"
                pageSize={15}
                expandedRowId={expandedCampaignId}
                onRowClick={(r) => void openCampaign(r.id)}
                renderExpandedRow={() => (
                  <div
                    className="max-h-56 overflow-y-auto rounded-md border"
                    style={{
                      borderColor: "var(--wb-neutral-200)",
                      background: "var(--wb-neutral-50)",
                    }}
                  >
                    {campaignDetail.length === 0 ? (
                      <p className="crm-winback-muted px-3 py-4 text-center text-[11px]">
                        No deliveries
                      </p>
                    ) : (
                      <table className="w-full text-left text-[11px]">
                        <thead
                          className="sticky top-0 border-b"
                          style={{
                            borderColor: "var(--wb-neutral-200)",
                            color: "var(--wb-neutral-500)",
                            background: "var(--wb-primary-50)",
                          }}
                        >
                          <tr>
                            <th className="px-3 py-1.5 font-medium">Company</th>
                            <th className="px-3 py-1.5 font-medium">Mobile</th>
                            <th className="px-3 py-1.5 font-medium">Status</th>
                            <th className="px-3 py-1.5 font-medium">Wave</th>
                            <th className="px-3 py-1.5 font-medium">Detail</th>
                          </tr>
                        </thead>
                        <tbody>
                          {campaignDetail.slice(0, 100).map((row) => (
                            <tr
                              key={row.id}
                              className="border-b last:border-0"
                              style={{ borderColor: "var(--wb-neutral-200)" }}
                            >
                              <td className="px-3 py-1.5 font-medium">{row.companyName}</td>
                              <td className="crm-winback-muted px-3 py-1.5 font-mono tabular-nums">
                                {row.mobile}
                              </td>
                              <td className="px-3 py-1.5">
                                <WbPill tone={campaignSemantic(row.status)}>{row.status}</WbPill>
                              </td>
                              <td className="crm-winback-muted px-3 py-1.5 tabular-nums">
                                {row.waveNumber}
                              </td>
                              <td className="crm-winback-muted px-3 py-1.5">
                                {row.errorMessage || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
                columns={[
                  {
                    key: "name",
                    header: "Campaign",
                    sortable: true,
                    className: "min-w-[12rem]",
                    render: (r) => (
                      <div className="min-w-0">
                        <div className="truncate font-medium" style={{ color: "var(--wb-neutral-900)" }}>
                          {r.name}
                        </div>
                        <div className="crm-winback-muted truncate text-[10px]">
                          {r.createdByName || "—"}
                          {r.scheduledAt ? ` · next ${formatDateTime(r.scheduledAt)}` : ""}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    sortable: true,
                    className: "w-[7rem]",
                    render: (r) => <WbPill tone={campaignSemantic(r.status)}>{r.status}</WbPill>,
                  },
                  {
                    key: "sentCount",
                    header: "Progress",
                    sortable: true,
                    className: "w-[11rem]",
                    render: (r) => (
                      <div className="crm-winback-muted text-xs tabular-nums">
                        <span className="font-semibold" style={{ color: "var(--wb-success-600)" }}>
                          {r.sentCount}
                        </span>{" "}
                        sent · {r.pendingCount} pending
                        <div className="text-[10px]">
                          <span style={{ color: "var(--wb-error-600)" }}>{r.failedCount}</span> failed ·{" "}
                          {r.recipientCount} total
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "actions",
                    header: "",
                    className: "w-[12rem]",
                    render: (r) => (
                      <div className="flex flex-wrap justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {r.status === "scheduled" || r.status === "running" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="crm-winback-btn-ghost h-7 gap-1 px-2 text-[10px]"
                            onClick={() =>
                              void pauseCrmWinbackCampaign({ data: { id: r.id } })
                                .then(() => refresh())
                                .catch((e) =>
                                  toast.error(e instanceof Error ? e.message : "Pause failed"),
                                )
                            }
                          >
                            <Pause className="h-3 w-3" /> Pause
                          </Button>
                        ) : null}
                        {r.status === "paused" ? (
                          <Button
                            size="sm"
                            className="crm-winback-btn-primary h-7 gap-1 px-2 text-[10px]"
                            onClick={() =>
                              void resumeCrmWinbackCampaign({ data: { id: r.id } })
                                .then(() => refresh())
                                .catch((e) =>
                                  toast.error(e instanceof Error ? e.message : "Resume failed"),
                                )
                            }
                          >
                            <Play className="h-3 w-3" /> Resume
                          </Button>
                        ) : null}
                        {r.status !== "done" && r.status !== "cancelled" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 px-2 text-[10px]"
                            style={{ borderColor: "var(--wb-error-200)", color: "var(--wb-error-700)" }}
                            onClick={() =>
                              void cancelCrmWinbackCampaign({ data: { id: r.id } })
                                .then(() => refresh())
                                .catch((e) =>
                                  toast.error(e instanceof Error ? e.message : "Cancel failed"),
                                )
                            }
                          >
                            <X className="h-3 w-3" /> Cancel
                          </Button>
                        ) : null}
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          )}
        </>
      ) : null}

      {tab === "activity" ? (
        <>
          <DesignTicketFilterBar
            variant="inline"
            compact
            className="xl:grid-cols-3"
            activeFilterCount={
              (activityStatusFilter !== "all" ? 1 : 0) + (activityQuery.trim() ? 1 : 0)
            }
            onClear={() => {
              setActivityStatusFilter("all");
              setActivityQuery("");
            }}
            resultCount={filteredActivity.length}
            resultLabel={filteredActivity.length === 1 ? "delivery" : "deliveries"}
            trailing={
              <div className="relative min-w-[140px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={activityQuery}
                  onChange={(e) => setActivityQuery(e.target.value)}
                  placeholder="Search deliveries…"
                  aria-label="Search activity"
                  className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
            }
          >
            <DesignTicketFilterField label="Status" compact>
              <DesignTicketSelect
                compact
                value={activityStatusFilter}
                onChange={(v) => setActivityStatusFilter(v as ActivityStatusFilter)}
                options={[
                  { value: "all", label: "All statuses" },
                  { value: "sent", label: "Sent" },
                  { value: "failed", label: "Failed" },
                  { value: "pending", label: "Pending" },
                  { value: "skipped", label: "Skipped" },
                ]}
              />
            </DesignTicketFilterField>
          </DesignTicketFilterBar>

          {loading && activity.length === 0 ? (
            <p className="px-1 py-10 text-center text-sm text-muted-foreground">Loading activity…</p>
          ) : activity.length === 0 ? (
            <EmptyState
              title="No sends yet"
              description="Activity appears here after win-back campaigns start sending WhatsApp messages."
            />
          ) : filteredActivity.length === 0 ? (
            <EmptyState
              title="No matches"
              description="No deliveries match these filters."
              actionLabel="Clear filters"
              onAction={() => {
                setActivityStatusFilter("all");
                setActivityQuery("");
              }}
            />
          ) : (
            <div className="crm-winback-table-shell">
              <DataTable
                flush
                data={filteredActivity}
                getRowId={(r) => r.id}
                hideSearch
                density="compact"
                pageSize={50}
                columns={[
                  {
                    key: "companyName",
                    header: "Company",
                    sortable: true,
                    className: "min-w-[10rem]",
                    render: (r) => (
                      <div className="min-w-0">
                        <div className="truncate font-medium" style={{ color: "var(--wb-neutral-900)" }}>
                          {r.companyName}
                        </div>
                        <div className="crm-winback-muted truncate text-[10px]">
                          {r.contactPerson || "—"} · {r.mobile}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    sortable: true,
                    className: "w-[6.5rem]",
                    render: (r) => <WbPill tone={campaignSemantic(r.status)}>{r.status}</WbPill>,
                  },
                  {
                    key: "waveNumber",
                    header: "Wave",
                    sortable: true,
                    className: "w-[4.5rem]",
                    render: (r) => (
                      <span className="crm-winback-muted text-xs tabular-nums">{r.waveNumber}</span>
                    ),
                  },
                  {
                    key: "sentAt",
                    header: "When",
                    sortable: true,
                    className: "w-[9rem]",
                    render: (r) => (
                      <span className="crm-winback-muted text-xs tabular-nums">
                        {r.sentAt ? formatDateTime(r.sentAt) : "—"}
                      </span>
                    ),
                  },
                  {
                    key: "errorMessage",
                    header: "Detail",
                    className: "min-w-[8rem]",
                    render: (r) => (
                      <span className="crm-winback-muted line-clamp-2 text-[11px]">
                        {r.errorMessage || "—"}
                      </span>
                    ),
                  },
                ]}
              />
            </div>
          )}
        </>
      ) : null}

      {composeOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div className="crm-winback-modal w-full max-w-lg rounded-xl p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h3 className="crm-winback-title text-sm">New Win-back campaign</h3>
                <p className="crm-winback-subtitle">
                  {eligibleSelected} recipients · WhatsApp · waves of {CRM_WINBACK_WAVE_LIMIT}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setComposeOpen(false)}
                className="crm-winback-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-[11px] font-medium">
                Campaign name
                <Input
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="mt-1 h-8 text-xs"
                  placeholder="Mar 2026 closed renewals"
                />
              </label>
              <label className="block text-[11px] font-medium">
                Message
                <Textarea
                  value={campaignBody}
                  onChange={(e) => setCampaignBody(e.target.value)}
                  className="mt-1 min-h-[8rem] text-xs"
                />
                <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                  Variables: {"{{companyName}}"}, {"{{contactPerson}}"}, {"{{mobile}}"}
                </span>
              </label>
              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                <label className="inline-flex items-center gap-1.5">
                  <input type="checkbox" checked={sendNow} onChange={(e) => setSendNow(e.target.checked)} />
                  Send first wave now
                </label>
                {!sendNow ? (
                  <Input
                    type="datetime-local"
                    value={scheduleLocal}
                    onChange={(e) => setScheduleLocal(e.target.value)}
                    className="h-8 w-auto text-xs"
                  />
                ) : null}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="crm-winback-btn-ghost h-8 text-xs"
                  onClick={() => setComposeOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="crm-winback-btn-primary h-8 gap-1 text-xs"
                  disabled={submitting}
                  onClick={() => void createCampaign()}
                >
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {sendNow ? "Start campaign" : "Schedule campaign"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
