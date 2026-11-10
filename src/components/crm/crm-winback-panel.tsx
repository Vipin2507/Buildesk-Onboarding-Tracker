import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Loader2,
  Pause,
  Play,
  Plus,
  Search,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  DesignTicketFilterField,
  DesignTicketSelect,
} from "@/components/design-ticket/design-ticket-fields";
import { DesignTicketTabNav } from "@/components/design-ticket/design-ticket-shared";
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
import { cn, formatDate } from "@/lib/utils";
import type {
  CrmWinbackCampaign,
  CrmWinbackContact,
  CrmWinbackDelivery,
  CrmWinbackOutcome,
} from "@/types/crm-winback";
import { CRM_WINBACK_OUTCOME_LABELS } from "@/types/crm-winback";

type TabId = "contacts" | "campaigns" | "activity";

const TABS = [
  { id: "contacts" as const, label: "Contacts" },
  { id: "campaigns" as const, label: "Campaigns" },
  { id: "activity" as const, label: "Activity" },
];

const OUTCOME_OPTIONS = [
  { value: "all", label: "All outcomes" },
  ...Object.entries(CRM_WINBACK_OUTCOME_LABELS).map(([value, label]) => ({ value, label })),
];

function statusTone(status: string) {
  if (status === "sent" || status === "done") return "text-emerald-700 dark:text-emerald-400";
  if (status === "failed" || status === "cancelled") return "text-destructive";
  if (status === "running" || status === "scheduled") return "text-sky-700 dark:text-sky-400";
  if (status === "paused") return "text-amber-700 dark:text-amber-400";
  return "text-muted-foreground";
}

export function CrmWinbackPanel() {
  const [tab, setTab] = useState<TabId>("contacts");
  const [contacts, setContacts] = useState<CrmWinbackContact[]>([]);
  const [campaigns, setCampaigns] = useState<CrmWinbackCampaign[]>([]);
  const [activity, setActivity] = useState<CrmWinbackDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
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
        listCrmWinbackContacts({
          data: {
            search: query.trim() || undefined,
            outcome: outcomeFilter === "all" ? undefined : (outcomeFilter as CrmWinbackOutcome),
            limit: 1000,
          },
        }),
        listCrmWinbackCampaigns({ data: { limit: 50 } }),
        listCrmWinbackActivity({ data: { limit: 100 } }),
      ]);
      setContacts(contactRes.contacts);
      setCampaigns(campaignRes.campaigns);
      setActivity(activityRes.deliveries);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load Win-back");
    } finally {
      setLoading(false);
    }
  }, [outcomeFilter, query]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const hasActive = campaigns.some((c) => c.status === "scheduled" || c.status === "running");
    if (!hasActive) return;
    const id = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(id);
  }, [campaigns, refresh]);

  const filteredContacts = contacts;

  function toggleContact(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectEligibleBatch(start: number) {
    const eligible = filteredContacts.filter((c) => c.outcome !== "do_not_contact");
    const slice = eligible.slice(start, start + CRM_WINBACK_WAVE_LIMIT).map((c) => c.id);
    setSelectedIds(new Set(slice));
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
        !sendNow && scheduleLocal
          ? new Date(scheduleLocal).toISOString()
          : undefined;
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

  const eligibleSelected = useMemo(
    () => contacts.filter((c) => selectedIds.has(c.id) && c.outcome !== "do_not_contact").length,
    [contacts, selectedIds],
  );

  return (
    <div className="space-y-3">
      <DesignTicketTabNav
        compact
        tabs={TABS.map((item) => ({ id: item.id, label: item.label }))}
        activeId={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      {tab === "contacts" ? (
        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Former clients</h2>
              <p className="text-[11px] text-muted-foreground">
                Import CompanyName, ContactPerson, Mobile. Waves send up to {CRM_WINBACK_WAVE_LIMIT}{" "}
                contacts with a 30-minute gap.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
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
                className="h-8 gap-1 text-xs"
                disabled={importing}
                onClick={() => fileRef.current?.click()}
              >
                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Import CSV
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1 text-xs"
                disabled={selectedIds.size === 0}
                onClick={() => setComposeOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                New campaign ({eligibleSelected})
              </Button>
            </div>
          </div>

          <div className="space-y-2 border-b px-4 py-3">
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-[12rem] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search company, contact, or mobile"
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <DesignTicketFilterField label="Outcome" compact>
                <DesignTicketSelect compact value={outcomeFilter} onChange={setOutcomeFilter} options={OUTCOME_OPTIONS} />
              </DesignTicketFilterField>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px]">
              <span className="tabular-nums text-muted-foreground">
                {selectedIds.size} selected · {filteredContacts.length} shown
              </span>
              <button type="button" className="text-primary hover:underline" onClick={() => selectEligibleBatch(0)}>
                Select first {CRM_WINBACK_WAVE_LIMIT}
              </button>
              {filteredContacts.length > CRM_WINBACK_WAVE_LIMIT ? (
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => selectEligibleBatch(CRM_WINBACK_WAVE_LIMIT)}
                >
                  Next {Math.min(CRM_WINBACK_WAVE_LIMIT, filteredContacts.length - CRM_WINBACK_WAVE_LIMIT)}
                </button>
              ) : null}
              <button
                type="button"
                className="text-muted-foreground hover:underline"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </button>
              {selectedIds.size > 0 ? (
                <>
                  <button
                    type="button"
                    className="text-emerald-700 hover:underline dark:text-emerald-400"
                    onClick={() => void setOutcome([...selectedIds], "interested")}
                  >
                    Mark interested
                  </button>
                  <button
                    type="button"
                    className="text-destructive hover:underline"
                    onClick={() => void setOutcome([...selectedIds], "do_not_contact")}
                  >
                    Do not contact
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <div className="max-h-[28rem] overflow-y-auto">
            {loading ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading contacts…</p>
            ) : filteredContacts.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No former clients yet. Import a CSV with CompanyName, ContactPerson, Mobile.
              </p>
            ) : (
              filteredContacts.map((contact) => {
                const on = selectedIds.has(contact.id);
                return (
                  <div
                    key={contact.id}
                    className={cn(
                      "flex items-start gap-2.5 border-b border-border/50 px-4 py-2.5 last:border-0",
                      on && "bg-primary/[0.05]",
                    )}
                  >
                    <button
                      type="button"
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30",
                      )}
                      onClick={() => toggleContact(contact.id)}
                    >
                      {on ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{contact.companyName}</div>
                      <div className="truncate text-[10px] text-muted-foreground">
                        {contact.contactPerson || "—"} · {contact.mobile}
                        {contact.city ? ` · ${contact.city}` : ""}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px]">
                        <span className="text-muted-foreground">
                          {CRM_WINBACK_OUTCOME_LABELS[contact.outcome]}
                          {contact.lastContactedAt
                            ? ` · last ${formatDate(contact.lastContactedAt)}`
                            : ""}
                        </span>
                        <select
                          className="h-6 rounded border bg-background px-1 text-[10px]"
                          value={contact.outcome}
                          onChange={(e) => {
                            void updateCrmWinbackContact({
                              data: { id: contact.id, outcome: e.target.value as CrmWinbackOutcome },
                            })
                              .then(() => refresh())
                              .catch((err) =>
                                toast.error(err instanceof Error ? err.message : "Update failed"),
                              );
                          }}
                        >
                          {Object.entries(CRM_WINBACK_OUTCOME_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      ) : null}

      {tab === "campaigns" ? (
        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Campaigns</h2>
            <p className="text-[11px] text-muted-foreground">
              Scheduled waves run automatically. Pause, resume, or cancel anytime.
            </p>
          </div>
          <div className="divide-y">
            {loading ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading campaigns…</p>
            ) : campaigns.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No campaigns yet. Select contacts and create one.
              </p>
            ) : (
              campaigns.map((campaign) => (
                <div key={campaign.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <button type="button" className="min-w-0 text-left" onClick={() => void openCampaign(campaign.id)}>
                      <div className="text-xs font-semibold">{campaign.name}</div>
                      <div className={cn("text-[10px] font-medium capitalize", statusTone(campaign.status))}>
                        {campaign.status}
                        {campaign.scheduledAt ? ` · next ${formatDate(campaign.scheduledAt)}` : ""}
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {campaign.sentCount} sent · {campaign.pendingCount} pending · {campaign.failedCount} failed ·{" "}
                        {campaign.recipientCount} total
                      </div>
                    </button>
                    <div className="flex gap-1">
                      {campaign.status === "scheduled" || campaign.status === "running" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 px-2 text-[10px]"
                          onClick={() =>
                            void pauseCrmWinbackCampaign({ data: { id: campaign.id } })
                              .then(() => refresh())
                              .catch((e) => toast.error(e instanceof Error ? e.message : "Pause failed"))
                          }
                        >
                          <Pause className="h-3 w-3" /> Pause
                        </Button>
                      ) : null}
                      {campaign.status === "paused" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 px-2 text-[10px]"
                          onClick={() =>
                            void resumeCrmWinbackCampaign({ data: { id: campaign.id } })
                              .then(() => refresh())
                              .catch((e) => toast.error(e instanceof Error ? e.message : "Resume failed"))
                          }
                        >
                          <Play className="h-3 w-3" /> Resume
                        </Button>
                      ) : null}
                      {campaign.status !== "done" && campaign.status !== "cancelled" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 px-2 text-[10px] text-destructive"
                          onClick={() =>
                            void cancelCrmWinbackCampaign({ data: { id: campaign.id } })
                              .then(() => refresh())
                              .catch((e) => toast.error(e instanceof Error ? e.message : "Cancel failed"))
                          }
                        >
                          <X className="h-3 w-3" /> Cancel
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {expandedCampaignId === campaign.id ? (
                    <div className="mt-2 max-h-48 overflow-y-auto rounded-md border bg-muted/20">
                      {campaignDetail.length === 0 ? (
                        <p className="px-3 py-4 text-center text-[10px] text-muted-foreground">No deliveries</p>
                      ) : (
                        campaignDetail.slice(0, 80).map((row) => (
                          <div key={row.id} className="border-b border-border/40 px-3 py-1.5 text-[10px] last:border-0">
                            <span className="font-medium">{row.companyName}</span>
                            <span className={cn("ml-2 capitalize", statusTone(row.status))}>{row.status}</span>
                            {row.errorMessage ? (
                              <span className="ml-2 text-muted-foreground">{row.errorMessage}</span>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      {tab === "activity" ? (
        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Activity</h2>
            <p className="text-[11px] text-muted-foreground">Recent Win-back WhatsApp sends and failures.</p>
          </div>
          <div className="max-h-[32rem] overflow-y-auto divide-y">
            {loading ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading activity…</p>
            ) : activity.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No sends yet.</p>
            ) : (
              activity.map((row) => (
                <div key={row.id} className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium">{row.companyName}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {row.contactPerson || "—"} · {row.mobile}
                        {row.sentAt ? ` · ${formatDate(row.sentAt)}` : ""}
                        {` · wave ${row.waveNumber}`}
                      </div>
                    </div>
                    <span className={cn("text-[10px] font-medium capitalize", statusTone(row.status))}>
                      {row.status}
                    </span>
                  </div>
                  {row.errorMessage ? (
                    <p className="mt-1 text-[10px] text-destructive">{row.errorMessage}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      {composeOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div className="w-full max-w-lg rounded-xl border bg-card p-4 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">New Win-back campaign</h3>
                <p className="text-[11px] text-muted-foreground">
                  {eligibleSelected} recipients · WhatsApp · waves of {CRM_WINBACK_WAVE_LIMIT}
                </p>
              </div>
              <button type="button" onClick={() => setComposeOpen(false)} className="text-muted-foreground">
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
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setComposeOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" className="h-8 text-xs" disabled={submitting} onClick={() => void createCampaign()}>
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
