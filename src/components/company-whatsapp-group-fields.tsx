import { useEffect, useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Check, CheckCircle2, Hash, Loader2, MessageCircle, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listWahaGroups, type WahaGroupSummary } from "@/services/waha";
import { useAutomationStore } from "@/stores/useAutomationStore";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { useCrmAccountStore } from "@/stores/useCrmAccountStore";
import { listCrmAccounts } from "@/lib/api";
import { cn } from "@/lib/utils";

function normalizeGroupId(raw: string | null | undefined): string {
  if (!raw) return "";
  const t = raw.trim();
  if (!t) return "";
  return t.includes("@") ? t.toLowerCase() : `${t.toLowerCase()}@g.us`;
}

type FormWithWhatsapp = {
  whatsappGroupId?: string;
  whatsappGroupName?: string;
};

export function CompanyWhatsappGroupFields<T extends FormWithWhatsapp>({
  form,
  companyId,
}: {
  form: UseFormReturn<T>;
  companyId?: string;
}) {
  const waha = useAutomationStore((s) => s.waha);
  const erpCompanies = useCompanyStore((s) => s.companies);
  const crmAccounts = useCrmAccountStore((s) => s.accounts);

  const [groups, setGroups] = useState<WahaGroupSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualIdInput, setManualIdInput] = useState("");
  const [manualNameInput, setManualNameInput] = useState("");

  const rawGroupId = String(form.watch("whatsappGroupId" as never) ?? "");
  const rawGroupName = String(form.watch("whatsappGroupName" as never) ?? "");
  const currentSelectedId = normalizeGroupId(rawGroupId);

  async function loadGroups() {
    setLoading(true);
    setError(null);
    try {
      const [result, fetchedCrmAccounts] = await Promise.all([
        listWahaGroups(waha),
        crmAccounts.length === 0 ? listCrmAccounts().catch(() => null) : Promise.resolve(null),
      ]);
      if (fetchedCrmAccounts) {
        useCrmAccountStore.getState().hydrateAccounts(fetchedCrmAccounts);
      }
      if (!result.ok) {
        setError(result.error || "Could not load WhatsApp groups");
        setGroups([]);
        return;
      }
      setGroups(result.groups ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load WhatsApp groups");
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when modal mounts
  }, []);

  // Map of normalized group ID -> taken source details (ERP company or CRM account)
  const takenGroupMap = useMemo(() => {
    const map = new Map<string, { name: string; source: "erp" | "crm" }>();

    for (const c of erpCompanies) {
      if (companyId && c.id === companyId) continue;
      const gid = normalizeGroupId(c.whatsappGroupId);
      if (gid) {
        map.set(gid, { name: c.name, source: "erp" });
      }
    }

    for (const a of crmAccounts) {
      const gid = normalizeGroupId(a.whatsappGroupId);
      if (gid && !map.has(gid)) {
        map.set(gid, { name: a.name, source: "crm" });
      }
    }

    return map;
  }, [erpCompanies, crmAccounts, companyId]);

  // How many groups returned by WAHA are already taken
  const takenCount = useMemo(() => {
    let count = 0;
    const counted = new Set<string>();
    for (const g of groups) {
      const id = normalizeGroupId(g.id);
      if (!id || counted.has(id)) continue;
      counted.add(id);
      if (takenGroupMap.has(id)) {
        count++;
      }
    }
    return count;
  }, [groups, takenGroupMap]);

  // Groups available for selection: not taken by any other company in ERP or any account in CRM
  const availableGroups = useMemo(() => {
    const seen = new Set<string>();
    const rows: { id: string; normalizedId: string; label: string }[] = [];

    for (const g of groups) {
      const id = normalizeGroupId(g.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);

      // Exclude if already linked elsewhere (allow if it's this company's own selected group)
      const isTaken = takenGroupMap.has(id);
      const isCurrentSelected = currentSelectedId && currentSelectedId === id;
      if (isTaken && !isCurrentSelected) {
        continue;
      }

      rows.push({
        id: g.id.trim(),
        normalizedId: id,
        label: g.subject?.trim() || g.id.trim(),
      });
    }

    // Preserve currently selected group if not in WAHA's fetched list
    if (currentSelectedId && !seen.has(currentSelectedId)) {
      rows.unshift({
        id: rawGroupId.trim(),
        normalizedId: currentSelectedId,
        label: rawGroupName.trim() || rawGroupId.trim(),
      });
    }

    return rows.sort((a, b) => a.label.localeCompare(b.label));
  }, [groups, takenGroupMap, currentSelectedId, rawGroupId, rawGroupName]);

  // Filtered by search query
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return availableGroups;
    return availableGroups.filter(
      (g) => g.label.toLowerCase().includes(q) || g.normalizedId.includes(q),
    );
  }, [availableGroups, searchQuery]);

  // Find label of currently selected group
  const selectedGroupLabel = useMemo(() => {
    if (!currentSelectedId) return null;
    const fromAvailable = availableGroups.find((g) => g.normalizedId === currentSelectedId);
    if (fromAvailable) return fromAvailable.label;
    const fromRaw = groups.find((g) => normalizeGroupId(g.id) === currentSelectedId);
    if (fromRaw) return fromRaw.subject?.trim() || fromRaw.id.trim();
    return null;
  }, [availableGroups, groups, currentSelectedId]);

  function handleSelectGroup(id: string, name: string) {
    form.setValue("whatsappGroupId" as never, id as never, { shouldDirty: true });
    form.setValue("whatsappGroupName" as never, name as never, { shouldDirty: true });
    setIsPickerOpen(false);
    setSearchQuery("");
  }

  function handleClearGroup() {
    form.setValue("whatsappGroupId" as never, "" as never, { shouldDirty: true });
    form.setValue("whatsappGroupName" as never, "" as never, { shouldDirty: true });
    setIsPickerOpen(true);
    setSearchQuery("");
  }

  function handleApplyManual() {
    const id = manualIdInput.trim();
    if (!id) {
      toast.error("Please enter a WhatsApp group ID");
      return;
    }
    const normalized = normalizeGroupId(id);
    const taken = takenGroupMap.get(normalized);
    if (taken) {
      toast.error(
        `This group is already connected to ${taken.source === "erp" ? "ERP company" : "CRM account"} "${taken.name}"`,
      );
      return;
    }
    const name = manualNameInput.trim() || id;
    handleSelectGroup(normalized, name);
    setShowManual(false);
    setManualIdInput("");
    setManualNameInput("");
    toast.success("WhatsApp group linked");
  }

  const showList = !currentSelectedId || isPickerOpen;

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
            WhatsApp group
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Linked group receives the implementation kickoff WhatsApp (with Excel attachments from
            Automation Rules).
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 px-2 text-xs"
          disabled={loading}
          onClick={() => void loadGroups()}
          title="Refresh WhatsApp groups"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Refresh
        </Button>
      </div>

      {/* Selected Group Card */}
      {currentSelectedId ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 dark:bg-emerald-500/10">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-medium text-foreground">
                {selectedGroupLabel || rawGroupName || rawGroupId}
              </div>
              <div className="truncate font-mono text-[10px] text-muted-foreground">
                {rawGroupId}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setIsPickerOpen((v) => !v)}
            >
              {isPickerOpen ? "Hide" : "Change"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              title="Unlink group"
              onClick={handleClearGroup}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : null}

      {/* Picker Area (shown when no group is selected or when "Change" is clicked) */}
      {showList ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label className="font-medium">
              {currentSelectedId ? "Change WhatsApp group" : "Connect WhatsApp group"}
            </label>
            {takenCount > 0 ? (
              <span className="text-[10px] text-muted-foreground">
                {takenCount} connected group{takenCount === 1 ? "" : "s"} hidden
              </span>
            ) : null}
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search groups by name or ID…"
              className="h-8 pl-8 pr-8 text-xs"
              disabled={loading}
              aria-label="Search WhatsApp groups"
            />
            {searchQuery ? (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchQuery("")}
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {/* Available Groups Scrollable List */}
          <div className="max-h-48 overflow-y-auto rounded-md border border-border/80 bg-background/80 p-1 space-y-0.5">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
                Fetching WhatsApp groups…
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                {searchQuery.trim() ? (
                  <div>
                    No available groups match “
                    <span className="font-semibold text-foreground">{searchQuery.trim()}</span>”
                  </div>
                ) : availableGroups.length === 0 && groups.length > 0 ? (
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">All connected groups are already in use</p>
                    <p className="text-[11px]">
                      All {groups.length} groups in this WAHA session are linked to other ERP companies or CRM accounts.
                    </p>
                  </div>
                ) : error ? (
                  <p className="text-destructive">{error}</p>
                ) : (
                  <p>No groups found. Check WAHA session in Automation settings.</p>
                )}
              </div>
            ) : (
              filteredGroups.map((g) => {
                const isSelected = currentSelectedId === g.normalizedId;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleSelectGroup(g.id, g.label)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
                      isSelected
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {isSelected ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                      ) : (
                        <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                      )}
                      <span className="truncate">{g.label}</span>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {g.id}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[10px] text-muted-foreground">
              {filteredGroups.length} available group{filteredGroups.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              className="text-[11px] text-muted-foreground hover:text-foreground underline decoration-dotted"
              onClick={() => setShowManual((v) => !v)}
            >
              {showManual ? "← Hide manual input" : "Can’t find group? Enter ID manually"}
            </button>
          </div>

          {/* Manual Input Fallback */}
          {showManual ? (
            <div className="space-y-2 rounded-lg border border-border/80 bg-muted/40 p-2.5">
              <div className="text-[11px] font-medium text-foreground">
                Enter WhatsApp Group ID manually
              </div>
              <Input
                placeholder="Group ID ending in @g.us (e.g. 120363294844731660@g.us)"
                value={manualIdInput}
                onChange={(e) => setManualIdInput(e.target.value)}
                className="h-8 font-mono text-xs"
              />
              <Input
                placeholder="Group Name (e.g. Acme ERP Implementation)"
                value={manualNameInput}
                onChange={(e) => setManualNameInput(e.target.value)}
                className="h-8 text-xs"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleApplyManual}
                >
                  Link Group
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setShowManual(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
