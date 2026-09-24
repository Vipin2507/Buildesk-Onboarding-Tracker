import { useState } from "react";
import { Copy, Loader2, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listWahaGroups, type WahaGroupSummary } from "@/services/waha";
import { useCrmAutomationStore } from "@/stores/useCrmAutomationStore";

export function WahaConnectedGroups() {
  const waha = useCrmAutomationStore((s) => s.waha);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<WahaGroupSummary[] | null>(null);
  const [query, setQuery] = useState("");

  const filtered = (groups ?? []).filter((g) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return g.subject.toLowerCase().includes(q) || g.id.toLowerCase().includes(q);
  });

  async function loadGroups() {
    if (!waha.apiUrl.trim() || !waha.apiKey.trim() || !waha.sessionName.trim()) {
      toast.error("Save WAHA URL, API key, and session name first");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await listWahaGroups(waha);
      if (!result.ok) {
        setGroups([]);
        setError(result.error ?? "Failed to load groups");
        toast.error(result.error ?? "Failed to load WhatsApp groups");
        return;
      }
      setGroups(result.groups);
      if (result.groups.length === 0) {
        toast.message("No groups found — add the WAHA session number to a group, then refresh");
      } else {
        toast.success(`Loaded ${result.groups.length} group${result.groups.length === 1 ? "" : "s"}`);
      }
    } finally {
      setLoading(false);
    }
  }

  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      toast.success("Group chat ID copied");
    } catch {
      toast.error("Could not copy — select the ID manually");
    }
  }

  return (
    <div className="mt-3 border-t pt-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            Connected WhatsApp groups
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Groups where this WAHA session is a member. Use the <code className="rounded bg-muted px-1">@g.us</code>{" "}
            ID to send messages.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          type="button"
          className="h-7 shrink-0 gap-1 px-2.5 text-xs"
          disabled={loading}
          onClick={() => void loadGroups()}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          {groups == null ? "Fetch groups" : "Refresh"}
        </Button>
      </div>

      {groups != null && groups.length > 4 ? (
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-2 h-8 text-xs"
          placeholder="Filter by name or ID…"
        />
      ) : null}

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-[10px] text-destructive">
          {error}
        </p>
      ) : null}

      {groups != null && !error && filtered.length === 0 ? (
        <p className="rounded-md border border-dashed px-2 py-3 text-center text-[10px] text-muted-foreground">
          {groups.length === 0
            ? "No connected groups yet. Add the WAHA WhatsApp number to a group, then refresh."
            : "No groups match your filter."}
        </p>
      ) : null}

      {filtered.length > 0 ? (
        <ul className="max-h-56 space-y-1.5 overflow-y-auto">
          {filtered.map((group) => (
            <li
              key={group.id}
              className="flex items-center gap-2 rounded-md border bg-background/60 px-2 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{group.subject}</div>
                <div className="truncate font-mono text-[10px] text-muted-foreground">{group.id}</div>
                {group.participantsCount != null ? (
                  <div className="text-[10px] text-muted-foreground">
                    {group.participantsCount} participant{group.participantsCount === 1 ? "" : "s"}
                  </div>
                ) : null}
              </div>
              <Button
                size="sm"
                variant="ghost"
                type="button"
                className="h-7 shrink-0 gap-1 px-2 text-xs"
                onClick={() => void copyId(group.id)}
                title="Copy group chat ID"
              >
                <Copy className="h-3 w-3" />
                Copy ID
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
