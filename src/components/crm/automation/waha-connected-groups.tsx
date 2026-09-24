import { useState } from "react";
import { Copy, Loader2, RefreshCw, Send, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listWahaGroups, sendWahaText, type WahaGroupSummary } from "@/services/waha";
import { useCrmAutomationStore } from "@/stores/useCrmAutomationStore";

export function WahaConnectedGroups() {
  const waha = useCrmAutomationStore((s) => s.waha);
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [groups, setGroups] = useState<WahaGroupSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const [testMessage, setTestMessage] = useState(
    "Buildesk test — WAHA group delivery check",
  );

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
    setHint(null);
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
        setHint(
          "WAHA returned no groups after refresh + chats fallback. Confirm session name matches the linked phone, wait 1–2 minutes after joining, and ensure NOWEB Store is enabled if you use that engine.",
        );
        toast.message("Still no groups — check session / WAHA store sync");
      } else {
        const via =
          result.source === "chats-overview"
            ? " (via chats)"
            : result.source === "groups-refresh"
              ? " (after refresh)"
              : "";
        toast.success(`Loaded ${result.groups.length} group${result.groups.length === 1 ? "" : "s"}${via}`);
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

  async function sendTest(group: WahaGroupSummary) {
    if (!waha.isEnabled) {
      toast.error("Enable WAHA first");
      return;
    }
    const text = testMessage.trim();
    if (!text) {
      toast.error("Enter a test message");
      return;
    }
    setSendingId(group.id);
    try {
      const stamp = new Date().toLocaleString();
      const body = `${text}\n\nGroup: ${group.subject}\nSent: ${stamp}`;
      const result = await sendWahaText(waha, group.id, body);
      if (!result.ok) {
        toast.error(`Send failed (HTTP ${result.status}): ${result.body.slice(0, 160)}`);
        return;
      }
      toast.success(`Test message sent to ${group.subject}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send test message");
    } finally {
      setSendingId(null);
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
            Groups where this WAHA session is a member. Use Send test to verify delivery, or copy the{" "}
            <code className="rounded bg-muted px-1">@g.us</code> ID.
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

      {groups != null && groups.length > 0 ? (
        <div className="mb-2">
          <label className="mb-1 block text-[10px] text-muted-foreground">Test message</label>
          <Input
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            className="h-8 text-xs"
            placeholder="Message to send to a group…"
          />
        </div>
      ) : null}

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

      {hint && !error ? (
        <p className="rounded-md border border-dashed px-2 py-1.5 text-[10px] text-muted-foreground">{hint}</p>
      ) : null}

      {groups != null && !error && !hint && filtered.length === 0 ? (
        <p className="rounded-md border border-dashed px-2 py-3 text-center text-[10px] text-muted-foreground">
          No groups match your filter.
        </p>
      ) : null}

      {filtered.length > 0 ? (
        <ul className="max-h-64 space-y-1.5 overflow-y-auto">
          {filtered.map((group) => {
            const busy = sendingId === group.id;
            return (
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
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={busy || !!sendingId}
                    onClick={() => void sendTest(group)}
                    title="Send test WhatsApp message to this group"
                  >
                    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    Send test
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => void copyId(group.id)}
                    title="Copy group chat ID"
                  >
                    <Copy className="h-3 w-3" />
                    Copy ID
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
