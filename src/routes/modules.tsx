import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PageWrap } from "@/components/page-header";
import { MODULES } from "@/data/constants";
import { CountUp } from "@/components/count-up";
import { useCompanyStore } from "@/stores";

export const Route = createFileRoute("/modules")({
  component: Modules,
});

function Modules() {
  const companies = useCompanyStore((s) => s.companies);

  return (
    <PageWrap>
      <PageHeader title="Modules & Add-ons" subtitle="Adoption of each Buildesk module across your customer base." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {MODULES.map((m) => {
          const opted = companies.filter((c) => c.modules.includes(m)).length;
          const pct = companies.length ? Math.round((opted / companies.length) * 100) : 0;
          return (
            <div key={m} className="card-soft p-5">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-semibold">{m}</div>
                <span className="text-xs text-muted-foreground">{pct}%</span>
              </div>
              <div className="mb-3 text-3xl font-semibold">
                <CountUp to={opted} /> <span className="text-sm font-normal text-muted-foreground">/ {companies.length}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-accent transition-[width] duration-700" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </PageWrap>
  );
}
