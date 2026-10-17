import { Link } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { flushCrmMasterConfigPersistence } from "@/lib/config-persistence";
import {
  getCrmMasterOnboardingTargets,
  useCrmMasterStore,
} from "@/stores/useCrmMasterStore";
import { newId } from "@/types/common";
import type { CrmOnboardingTargetBucket } from "@/types/crm-master";

type Props = {
  /** When true, show a short link to CRM Master for full management context. */
  showMasterLink?: boolean;
  className?: string;
};

/** Editable 45-day onboarding SLA buckets — Master + Automation share this. */
export function CrmOnboardingTargetsEditor({ showMasterLink, className }: Props) {
  const stored = useCrmMasterStore((s) => s.onboardingTargets);
  const setOnboardingTargets = useCrmMasterStore((s) => s.setOnboardingTargets);
  const settings = stored?.buckets?.length ? stored : getCrmMasterOnboardingTargets();
  const buckets = settings.buckets.slice().sort((a, b) => a.order - b.order);

  function commit(next: typeof settings) {
    setOnboardingTargets(next);
  }

  function updateBucket(index: number, patch: Partial<CrmOnboardingTargetBucket>) {
    const nextBuckets = buckets.map((b, i) => (i === index ? { ...b, ...patch } : b));
    commit({ ...settings, buckets: nextBuckets });
  }

  function addBucket() {
    const last = buckets[buckets.length - 1];
    const dayFrom = last ? last.dayTo + 1 : 0;
    const dayTo = Math.min(settings.targetDays, dayFrom + 4);
    const row: CrmOnboardingTargetBucket = {
      id: `days-${dayFrom}-${dayTo}-${newId().slice(0, 6)}`,
      dayFrom,
      dayTo,
      minProgressPercent: 100,
      remarks:
        "If The Overall % is Less than this, Push Whats app message notification to Support 1 & 2 & Admin",
      active: true,
      order: (last?.order ?? 0) + 1,
    };
    commit({ ...settings, buckets: [...buckets, row] });
    toast.success("Bucket added");
  }

  function removeBucket(index: number) {
    if (buckets.length <= 1) {
      toast.error("Keep at least one target bucket");
      return;
    }
    commit({
      ...settings,
      buckets: buckets.filter((_, i) => i !== index).map((b, i) => ({ ...b, order: i + 1 })),
    });
    toast.success("Bucket removed");
  }

  function save() {
    flushCrmMasterConfigPersistence();
    toast.success("Onboarding targets saved", {
      description: "Synced for all admins. Automation SLA uses these buckets on the next check.",
    });
  }

  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Onboarding target</h3>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Default window is {settings.targetDays} days from account start. When overall onboarding %
            is below the bucket threshold, WhatsApp notifies Support 1, Support 2, and Admins (via
            Automation → Onboarding SLA).
          </p>
          {showMasterLink ? (
            <p className="mt-1 text-[10px]">
              <Link to="/crm/master" className="text-primary hover:underline">
                Open in CRM Master
              </Link>{" "}
              for the full catalog (same data).
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={addBucket}>
            <Plus className="h-3.5 w-3.5" />
            Add bucket
          </Button>
          <Button type="button" size="sm" className="h-7 text-xs" onClick={save}>
            Save targets
          </Button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium">
          Target days
          <input
            type="number"
            min={1}
            max={365}
            value={settings.targetDays}
            onChange={(e) =>
              commit({
                ...settings,
                targetDays: Math.max(1, Math.min(365, Number(e.target.value) || 45)),
              })
            }
            className="mt-1 h-8 w-24 rounded-md border bg-background px-2 text-xs tabular-nums"
          />
        </label>
        <p className="pb-1 text-[10px] text-muted-foreground">
          Accounts past this day are outside the SLA window (no further push).
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[640px] text-xs">
          <thead className="bg-muted/40 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left">From days</th>
              <th className="px-2 py-2 text-left">To days</th>
              <th className="px-2 py-2 text-left">%</th>
              <th className="px-2 py-2 text-left">Remarks</th>
              <th className="px-2 py-2 text-left">Active</th>
              <th className="px-2 py-2 text-right"> </th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket, index) => (
              <tr key={bucket.id} className="border-t border-border/70">
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    min={0}
                    value={bucket.dayFrom}
                    onChange={(e) =>
                      updateBucket(index, {
                        dayFrom: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="h-8 w-20 rounded-md border bg-background px-2 tabular-nums"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    min={0}
                    value={bucket.dayTo}
                    onChange={(e) =>
                      updateBucket(index, {
                        dayTo: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="h-8 w-20 rounded-md border bg-background px-2 tabular-nums"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={bucket.minProgressPercent}
                    onChange={(e) =>
                      updateBucket(index, {
                        minProgressPercent: Math.min(
                          100,
                          Math.max(0, Number(e.target.value) || 0),
                        ),
                      })
                    }
                    className="h-8 w-16 rounded-md border bg-background px-2 tabular-nums"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <textarea
                    value={bucket.remarks}
                    onChange={(e) => updateBucket(index, { remarks: e.target.value })}
                    className="min-h-[52px] w-full min-w-[12rem] rounded-md border bg-background px-2 py-1.5 text-[11px]"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Switch
                    size="sm"
                    checked={bucket.active}
                    onCheckedChange={(v) => updateBucket(index, { active: v === true })}
                  />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => removeBucket(index)}
                    aria-label="Remove bucket"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
