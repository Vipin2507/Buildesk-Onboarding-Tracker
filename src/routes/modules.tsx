import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PageWrap } from "@/components/page-header";
import { CountUp } from "@/components/count-up";
import { useCompanyStore } from "@/stores";
import { MODULE_CATALOG } from "@/data/module-catalog";

export const Route = createFileRoute("/modules")({
  component: Modules,
});

function Modules() {
  const companies = useCompanyStore((s) => s.companies);

  return (
    <PageWrap>
      <PageHeader title="Modules & Add-ons" subtitle="Adoption of each Buildesk module across your customer base." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {MODULE_CATALOG.map((m) => {
          const opted = companies.filter((c) => c.modules.some((x) => x.moduleKey === m.key && x.optedIn)).length;
          const pct = companies.length ? Math.round((opted / companies.length) * 100) : 0;
          return (
            <div key={m.key} className="card-soft p-5">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-semibold">{m.label}</div>
                <span className="text-xs text-muted-foreground">{pct}%</span>
              </div>
              <div className="mb-3 text-3xl font-semibold">
                <CountUp to={opted} /> <span className="text-sm font-normal text-muted-foreground">/ {companies.length}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-[width] duration-700" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </PageWrap>
  );
}
