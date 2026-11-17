import { useEffect, useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Loader2, MessageCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { listWahaGroups, type WahaGroupSummary } from "@/services/waha";
import { useAutomationStore } from "@/stores/useAutomationStore";
import { cn } from "@/lib/utils";

function normalizeGroupId(raw: string) {
  return raw.trim();
}

type FormWithWhatsapp = {
  whatsappGroupId?: string;
  whatsappGroupName?: string;
};

export function CompanyWhatsappGroupFields<T extends FormWithWhatsapp>({
  form,
}: {
  form: UseFormReturn<T>;
}) {
  const waha = useAutomationStore((s) => s.waha);
  const [groups, setGroups] = useState<WahaGroupSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupId = String(form.watch("whatsappGroupId" as never) ?? "");
  const groupName = String(form.watch("whatsappGroupName" as never) ?? "");

  async function loadGroups() {
    setLoading(true);
    setError(null);
    try {
      const result = await listWahaGroups(waha);
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

  const options = useMemo(() => {
    const seen = new Set<string>();
    const rows: { id: string; label: string }[] = [];
    for (const g of groups) {
      const id = normalizeGroupId(g.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      rows.push({ id, label: g.subject?.trim() || id });
    }
    const current = normalizeGroupId(groupId);
    if (current && !seen.has(current)) {
      rows.unshift({ id: current, label: groupName.trim() || current });
    }
    return rows.sort((a, b) => a.label.localeCompare(b.label));
  }, [groups, groupId, groupName]);

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <MessageCircle className="h-3.5 w-3.5" />
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
          className="h-8 gap-1.5 text-xs"
          disabled={loading}
          onClick={() => void loadGroups()}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>

      <div>
        <label className="text-xs font-medium">Connect WhatsApp group</label>
        <select
          className={cn(
            "mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/40",
          )}
          value={normalizeGroupId(groupId)}
          disabled={loading}
          onChange={(e) => {
            const next = e.target.value;
            const match = options.find((o) => o.id === next);
            form.setValue("whatsappGroupId" as never, next as never, { shouldDirty: true });
            form.setValue("whatsappGroupName" as never, (match?.label || "") as never, {
              shouldDirty: true,
            });
          }}
        >
          <option value="">No group linked</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
        {!error && !loading && options.length === 0 ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            No groups found. Check WAHA session in Automation settings.
          </p>
        ) : null}
      </div>
    </div>
  );
}
