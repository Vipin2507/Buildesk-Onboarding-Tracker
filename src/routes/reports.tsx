import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PageWrap } from "@/components/page-header";
import { FileBarChart2, DollarSign, Truck, HardHat, Users, TrendingDown, Plug, Bug, Timer, Wrench, PieChart } from "lucide-react";

export const Route = createFileRoute("/reports")({
  component: Reports,
});

const REPORTS = [
  { name: "Onboarding Report", desc: "Progress across all companies", icon: FileBarChart2 },
  { name: "Due Report", desc: "Outstanding balances by project", icon: DollarSign },
  { name: "Collection Report", desc: "Payments received", icon: DollarSign },
  { name: "Vendor Report", desc: "PO / bill status", icon: Truck },
  { name: "Labor Report", desc: "Attendance & site coverage", icon: HardHat },
  { name: "Team Productivity", desc: "Onboarding manager performance", icon: Users },
  { name: "Delay Analysis", desc: "Time in each onboarding step", icon: TrendingDown },
  { name: "Integration Status", desc: "Connected & tested integrations", icon: Plug },
  { name: "Ticket Aging", desc: "Open tickets by age band", icon: Timer },
  { name: "Bug Resolution", desc: "Bug MTTR and closure rate", icon: Bug },
  { name: "Custom Report", desc: "Build your own", icon: Wrench },
  { name: "Executive Summary", desc: "One-pager for leadership", icon: PieChart },
];

function Reports() {
  return (
    <PageWrap>
      <PageHeader title="Reports" subtitle="Download or share operational insights." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((r) => (
          <button key={r.name} className="card-soft group flex items-start gap-4 p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent group-hover:bg-accent group-hover:text-white">
              <r.icon className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">{r.name}</div>
              <div className="text-sm text-muted-foreground">{r.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </PageWrap>
  );
}
