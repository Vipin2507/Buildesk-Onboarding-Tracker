import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { DesignTicketSearchableSelect } from "@/components/design-ticket/design-ticket-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { isCrmAccountEnded } from "@/lib/crm-account-status";
import { cn } from "@/lib/utils";
import { pullCrmAutomationConfigFromServer } from "@/lib/crm-automation-refresh";
import { listWahaGroups, type WahaGroupSummary } from "@/services/waha";
import { useCrmAccountStore } from "@/stores/useCrmAccountStore";
import type { CrmAccount } from "@/types/crm-account";

const UNLINK = "__unlink__";

type LinkFilter = "all" | "linked" | "not_linked";

function normalizeGroupId(raw: string) {
  const id = raw.trim();
  if (!id) return "";
  if (id.includes("@g.us")) return id;
  if (/^\d+$/.test(id)) return `${id}@g.us`;
  return id;
}

function isActiveAccount(account: CrmAccount) {
  return !isCrmAccountEnded(account.status);
}

type RowDraft = {
  accountId: string;
  groupId: string;
};

function draftFromAccounts(accounts: CrmAccount[]): RowDraft[] {
  return accounts
    .filter(isActiveAccount)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((a) => ({
      accountId: a.id,
      groupId: a.whatsappGroupId?.trim() ? normalizeGroupId(a.whatsappGroupId) : "",
    }));
}

export function CrmAccountWhatsappSyncModal({
  open,
  onOpenChange,
  accounts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: CrmAccount[];
}) {
  const updateAccount = useCrmAccountStore((s) => s.updateAccount);

  const [accountSearch, setAccountSearch] = useState("");
  const [linkFilter, setLinkFilter] = useState<LinkFilter>("all");
  const [groups, setGroups] = useState<WahaGroupSummary[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<RowDraft[]>([]);
  /** Snapshot of accounts at open time — used for dirty checks so live store updates don't reset picks. */
  const [baselineAccounts, setBaselineAccounts] = useState<CrmAccount[]>([]);
  const [saving, setSaving] = useState(false);

  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;
  const sessionOpenRef = useRef(false);

  const loadGroups = useCallback(async (opts?: { quiet?: boolean }) => {
    setLoadingGroups(true);
    if (!opts?.quiet) setGroupsError(null);
    const live = await pullCrmAutomationConfigFromServer();
    if (!live.apiUrl || !live.apiKey || !live.sessionName) {
      setGroups([]);
      setGroupsError("WAHA is not configured — set API URL, key, and session in Automation.");
      setLoadingGroups(false);
      return;
    }
    const result = await listWahaGroups({
      apiUrl: live.apiUrl,
      apiKey: live.apiKey,
      sessionName: live.sessionName,
      isEnabled: live.isEnabled ?? true,
    });
    if (!result.ok) {
      setGroups([]);
      setGroupsError(result.error ?? "Could not load WhatsApp groups");
      if (!opts?.quiet) toast.error(result.error ?? "Could not load WhatsApp groups");
    } else {
      setGroups(result.groups);
      setGroupsError(null);
      if (!opts?.quiet) toast.success(`Loaded ${result.groups.length} WhatsApp groups`);
    }
    setLoadingGroups(false);
  }, []);

  // Initialize drafts + load groups once per open. Do NOT depend on `accounts` /
  // store object identity — that was resetting selections on every refresh.
  useEffect(() => {
    if (!open) {
      sessionOpenRef.current = false;
      return;
    }
    if (sessionOpenRef.current) return;
    sessionOpenRef.current = true;

    const snapshot = accountsRef.current.filter(isActiveAccount).map((a) => ({ ...a }));
    setBaselineAccounts(snapshot);
    setDrafts(draftFromAccounts(snapshot));
    setAccountSearch("");
    setLinkFilter("all");
    setGroupsError(null);
    void loadGroups({ quiet: true });
  }, [open, loadGroups]);

  const accountById = useMemo(() => {
    const map = new Map<string, CrmAccount>();
    for (const a of baselineAccounts) map.set(a.id, a);
    return map;
  }, [baselineAccounts]);

  /** groupId → account currently bound to it (from draft selections). */
  const takenByDraft = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of drafts) {
      const gid = normalizeGroupId(d.groupId);
      if (!gid) continue;
      map.set(gid, d.accountId);
    }
    return map;
  }, [drafts]);

  const linkCounts = useMemo(() => {
    let linked = 0;
    let notLinked = 0;
    for (const d of drafts) {
      if (normalizeGroupId(d.groupId)) linked += 1;
      else notLinked += 1;
    }
    return { linked, notLinked, all: drafts.length };
  }, [drafts]);

  const filteredDrafts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();
    return drafts.filter((d) => {
      const linked = Boolean(normalizeGroupId(d.groupId));
      if (linkFilter === "linked" && !linked) return false;
      if (linkFilter === "not_linked" && linked) return false;

      if (!q) return true;
      const a = accountById.get(d.accountId);
      if (!a) return false;
      return (
        a.name.toLowerCase().includes(q) ||
        (a.pocName ?? "").toLowerCase().includes(q) ||
        (a.userId ?? "").toLowerCase().includes(q) ||
        (a.whatsappGroupName ?? "").toLowerCase().includes(q) ||
        (a.whatsappGroupId ?? "").toLowerCase().includes(q)
      );
    });
  }, [drafts, accountSearch, accountById, linkFilter]);

  const dirtyCount = useMemo(() => {
    let n = 0;
    for (const d of drafts) {
      const a = accountById.get(d.accountId);
      if (!a) continue;
      const prev = a.whatsappGroupId?.trim() ? normalizeGroupId(a.whatsappGroupId) : "";
      const next = normalizeGroupId(d.groupId);
      if (prev !== next) n += 1;
    }
    return n;
  }, [drafts, accountById]);

  function setRowGroup(accountId: string, groupId: string) {
    const nextId = groupId === UNLINK ? "" : normalizeGroupId(groupId);
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.accountId === accountId) return { ...d, groupId: nextId };
        if (nextId && normalizeGroupId(d.groupId) === nextId) {
          return { ...d, groupId: "" };
        }
        return d;
      }),
    );
  }

  function applySync() {
    if (dirtyCount === 0) {
      toast.message("No WhatsApp group changes to sync");
      return;
    }
    setSaving(true);
    let linked = 0;
    let unlinked = 0;
    try {
      for (const d of drafts) {
        const a = accountById.get(d.accountId);
        if (!a) continue;
        const prev = a.whatsappGroupId?.trim() ? normalizeGroupId(a.whatsappGroupId) : "";
        const next = normalizeGroupId(d.groupId);
        if (prev === next) continue;

        if (!next) {
          updateAccount(a.id, { whatsappGroupId: undefined, whatsappGroupName: undefined });
          unlinked += 1;
          continue;
        }

        const group = groups.find((g) => normalizeGroupId(g.id) === next);
        const name = group?.subject?.trim() || a.whatsappGroupName?.trim() || next;
        updateAccount(a.id, { whatsappGroupId: next, whatsappGroupName: name });
        linked += 1;
      }

      const parts: string[] = [];
      if (linked) parts.push(`${linked} linked`);
      if (unlinked) parts.push(`${unlinked} unlinked`);
      toast.success(`WhatsApp sync saved · ${parts.join(", ") || "done"}`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSaving(false);
    }
  }

  function optionsForRow(accountId: string, currentGroupId: string) {
    const current = normalizeGroupId(currentGroupId);
    const opts: { value: string; label: string }[] = [
      { value: UNLINK, label: "— Not linked —" },
    ];

    for (const g of groups) {
      const gid = normalizeGroupId(g.id);
      if (!gid) continue;
      const takenBy = takenByDraft.get(gid);
      // Hide groups already picked on another row (keep this row's current pick).
      if (takenBy && takenBy !== accountId) continue;
      const subject = g.subject?.trim() || gid;
      opts.push({
        value: gid,
        label: subject === gid ? subject : `${subject}`,
      });
    }

    if (current && !opts.some((o) => o.value === current)) {
      const a = accountById.get(accountId);
      opts.push({
        value: current,
        label: `${a?.whatsappGroupName?.trim() || current} (current)`,
      });
    }

    return opts;
  }

  const linkFilterOptions: { id: LinkFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: linkCounts.all },
    { id: "linked", label: "Linked", count: linkCounts.linked },
    { id: "not_linked", label: "Not linked", count: linkCounts.notLinked },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <MessageCircle className="h-4 w-4 text-teal-700" />
            Sync accounts · WhatsApp groups
          </DialogTitle>
          <p className="text-[11px] text-muted-foreground">
            Map each active CRM account to a WhatsApp group. After sync, open the account’s WhatsApp
            tab to load messages.
          </p>
        </DialogHeader>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2">
          <Input
            value={accountSearch}
            onChange={(e) => setAccountSearch(e.target.value)}
            placeholder="Search accounts…"
            className="h-8 max-w-xs text-xs"
          />
          <div className="flex flex-wrap items-center gap-1">
            {linkFilterOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setLinkFilter(opt.id)}
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors",
                  linkFilter === opt.id
                    ? "bg-foreground text-background"
                    : "border bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                {opt.label}
                <span className="tabular-nums opacity-80">{opt.count}</span>
              </button>
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            disabled={loadingGroups}
            onClick={() => void loadGroups()}
          >
            {loadingGroups ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh groups
          </Button>
          <span className="ml-auto text-[11px] text-muted-foreground">
            {linkCounts.linked}/{linkCounts.all} linked
            {dirtyCount > 0 ? ` · ${dirtyCount} pending` : ""}
          </span>
        </div>

        {groupsError ? (
          <div className="shrink-0 border-b bg-amber-500/10 px-4 py-2 text-[11px] text-amber-900 dark:text-amber-200">
            {groupsError}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadingGroups && groups.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading WhatsApp groups…
            </div>
          ) : filteredDrafts.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              {drafts.length === 0
                ? "No active accounts to sync."
                : "No accounts match this filter."}
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 border-b bg-background">
                <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Account</th>
                  <th className="px-4 py-2 font-medium">WhatsApp group</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrafts.map((d) => {
                  const account = accountById.get(d.accountId);
                  if (!account) return null;
                  const opts = optionsForRow(d.accountId, d.groupId);
                  const selectValue = d.groupId ? normalizeGroupId(d.groupId) : UNLINK;
                  const prev = account.whatsappGroupId?.trim()
                    ? normalizeGroupId(account.whatsappGroupId)
                    : "";
                  const dirty = prev !== normalizeGroupId(d.groupId);
                  return (
                    <tr
                      key={d.accountId}
                      className={cn("border-b border-border/60", dirty && "bg-amber-500/5")}
                    >
                      <td className="px-4 py-2 align-middle">
                        <div className="font-medium text-foreground">{account.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {account.pocName?.trim() || account.city?.trim() || account.status}
                          {prev ? " · previously linked" : ""}
                        </div>
                      </td>
                      <td className="px-4 py-2 align-middle">
                        <div className="max-w-md">
                          <DesignTicketSearchableSelect
                            value={selectValue}
                            options={opts}
                            onChange={(v) => setRowGroup(d.accountId, v)}
                            placeholder="Search WhatsApp groups…"
                            emptyLabel="No groups found"
                            disabled={loadingGroups && groups.length === 0}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t px-4 py-3">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1"
            disabled={saving || dirtyCount === 0}
            onClick={applySync}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Sync {dirtyCount > 0 ? `(${dirtyCount})` : "accounts"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
