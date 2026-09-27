import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { listWahaGroups, type WahaGroupSummary } from "@/services/waha";
import { useCrmAccountStore } from "@/stores/useCrmAccountStore";
import { useCrmAutomationStore } from "@/stores/useCrmAutomationStore";
import type { CrmAccount } from "@/types/crm-account";

const UNLINK = "__unlink__";

function normalizeGroupId(raw: string) {
  const id = raw.trim();
  if (!id) return "";
  if (id.includes("@g.us")) return id;
  if (/^\d+$/.test(id)) return `${id}@g.us`;
  return id;
}

type RowDraft = {
  accountId: string;
  groupId: string;
};

function draftFromAccounts(accounts: CrmAccount[]): RowDraft[] {
  return accounts
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
  const waha = useCrmAutomationStore((s) => s.waha);
  const updateAccount = useCrmAccountStore((s) => s.updateAccount);

  const [search, setSearch] = useState("");
  const [groups, setGroups] = useState<WahaGroupSummary[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<RowDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setDrafts(draftFromAccounts(accounts));
    setGroupsError(null);

    if (!waha.apiUrl || !waha.apiKey || !waha.sessionName) {
      setGroups([]);
      setGroupsError("WAHA is not configured — set API URL, key, and session in Automation.");
      return;
    }

    let cancelled = false;
    setLoadingGroups(true);
    void (async () => {
      const result = await listWahaGroups(waha);
      if (cancelled) return;
      if (!result.ok) {
        setGroups([]);
        setGroupsError(result.error ?? "Could not load WhatsApp groups");
        toast.error(result.error ?? "Could not load WhatsApp groups");
      } else {
        setGroups(result.groups);
        setGroupsError(null);
      }
      setLoadingGroups(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, accounts, waha]);

  const accountById = useMemo(() => {
    const map = new Map<string, CrmAccount>();
    for (const a of accounts) map.set(a.id, a);
    return map;
  }, [accounts]);

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

  const filteredDrafts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return drafts;
    return drafts.filter((d) => {
      const a = accountById.get(d.accountId);
      if (!a) return false;
      return (
        a.name.toLowerCase().includes(q) ||
        (a.pocName ?? "").toLowerCase().includes(q) ||
        (a.whatsappGroupName ?? "").toLowerCase().includes(q) ||
        (a.whatsappGroupId ?? "").toLowerCase().includes(q)
      );
    });
  }, [drafts, search, accountById]);

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

  const linkedCount = drafts.filter((d) => Boolean(normalizeGroupId(d.groupId))).length;

  function setRowGroup(accountId: string, groupId: string) {
    const nextId = groupId === UNLINK ? "" : normalizeGroupId(groupId);
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.accountId === accountId) return { ...d, groupId: nextId };
        // One group → one account: clear from any other row that had it.
        if (nextId && normalizeGroupId(d.groupId) === nextId) {
          return { ...d, groupId: "" };
        }
        return d;
      }),
    );
  }

  async function reloadGroups() {
    if (!waha.apiUrl || !waha.apiKey || !waha.sessionName) {
      setGroupsError("WAHA is not configured — set API URL, key, and session in Automation.");
      return;
    }
    setLoadingGroups(true);
    setGroupsError(null);
    const result = await listWahaGroups(waha);
    if (!result.ok) {
      setGroups([]);
      setGroupsError(result.error ?? "Could not load WhatsApp groups");
      toast.error(result.error ?? "Could not load WhatsApp groups");
    } else {
      setGroups(result.groups);
      toast.success(`Loaded ${result.groups.length} WhatsApp groups`);
    }
    setLoadingGroups(false);
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
    const opts: { value: string; label: string; disabled?: boolean }[] = [
      { value: UNLINK, label: "— Not linked —" },
    ];

    for (const g of groups) {
      const gid = normalizeGroupId(g.id);
      if (!gid) continue;
      const takenBy = takenByDraft.get(gid);
      const takenElsewhere = Boolean(takenBy && takenBy !== accountId);
      const takenAccount = takenBy ? accountById.get(takenBy) : undefined;
      const label = takenElsewhere
        ? `${g.subject || gid} · taken by ${takenAccount?.name ?? "another account"}`
        : g.subject || gid;
      opts.push({
        value: gid,
        label,
        // Keep current selection selectable; block stealing from other draft rows.
        disabled: takenElsewhere && gid !== current,
      });
    }

    // Orphan binding (group no longer in WAHA list) — still show so it can be kept/cleared.
    if (current && !opts.some((o) => o.value === current)) {
      const a = accountById.get(accountId);
      opts.push({
        value: current,
        label: `${a?.whatsappGroupName?.trim() || current} (current)`,
      });
    }

    return opts;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <MessageCircle className="h-4 w-4 text-teal-700" />
            Sync accounts · WhatsApp groups
          </DialogTitle>
          <p className="text-[11px] text-muted-foreground">
            Map each CRM account to a WhatsApp group. After sync, open the account’s WhatsApp tab to
            load messages.
          </p>
        </DialogHeader>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts…"
            className="h-8 max-w-xs text-xs"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            disabled={loadingGroups}
            onClick={() => void reloadGroups()}
          >
            {loadingGroups ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh groups
          </Button>
          <span className="ml-auto text-[11px] text-muted-foreground">
            {linkedCount}/{drafts.length} linked
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
            <div className="py-12 text-center text-xs text-muted-foreground">No accounts match.</div>
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
                      className={cn(
                        "border-b border-border/60",
                        dirty && "bg-amber-500/5",
                      )}
                    >
                      <td className="px-4 py-2 align-middle">
                        <div className="font-medium text-foreground">{account.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {account.pocName?.trim() || account.city?.trim() || account.status}
                          {prev ? " · previously linked" : ""}
                        </div>
                      </td>
                      <td className="px-4 py-2 align-middle">
                        <select
                          className="h-8 w-full max-w-md rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring/40"
                          value={selectValue}
                          onChange={(e) => setRowGroup(d.accountId, e.target.value)}
                          disabled={loadingGroups && groups.length === 0}
                        >
                          {opts.map((o) => (
                            <option key={o.value} value={o.value} disabled={o.disabled}>
                              {o.label}
                            </option>
                          ))}
                        </select>
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
