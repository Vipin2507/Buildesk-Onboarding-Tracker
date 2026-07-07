import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageWrap } from "@/components/page-header";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { CountUp } from "@/components/count-up";
import { useRenewalSelectors } from "@/stores";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/renewals")({
  component: Renewals,
});

function Renewals() {
  const { renewals, upcomingCount, overdueCount, markRenewed } = useRenewalSelectors();

  return (
    <PageWrap>
      <PageHeader title="Renewals" subtitle="Subscription renewals across all companies." />
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="card-soft p-4"><div className="text-xs text-muted-foreground">Upcoming (60d)</div><div className="text-2xl font-semibold"><CountUp to={upcomingCount} /></div></div>
        <div className="card-soft p-4"><div className="text-xs text-muted-foreground">Overdue</div><div className="text-2xl font-semibold text-destructive"><CountUp to={overdueCount} /></div></div>
        <div className="card-soft p-4"><div className="text-xs text-muted-foreground">Total Companies</div><div className="text-2xl font-semibold"><CountUp to={renewals.length} /></div></div>
      </div>
      <div className="card-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Company</th>
              <th className="px-4 py-2 text-left">Plan</th>
              <th className="px-4 py-2 text-left">Expiry</th>
              <th className="px-4 py-2 text-left">Days Left</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {renewals.map((r) => (
              <tr key={r.id} className="border-t hover:bg-muted/40">
                <td className="px-4 py-3 font-medium">
                  <Link to="/companies/$companyId" params={{ companyId: r.id }} className="hover:underline">{r.name}</Link>
                </td>
                <td className="px-4 py-3"><Pill tone="accent">{r.plan}</Pill></td>
                <td className="px-4 py-3 text-muted-foreground">{r.planExpiry}</td>
                <td className="px-4 py-3"><Pill tone={r.daysLeft < 15 ? "danger" : "warning"}>{r.daysLeft} days</Pill></td>
                <td className="px-4 py-3"><Pill tone={r.urgency === "overdue" ? "danger" : "info"}>{r.urgency}</Pill></td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="outline" onClick={() => { markRenewed(r.id); toast.success(`${r.name} renewed`); }}>Renew</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageWrap>
  );
}
