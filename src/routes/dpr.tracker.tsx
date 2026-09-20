import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { DprTrackerHub } from "@/components/dpr/dpr-tracker-hub";
import { PageWrap } from "@/components/page-header";
import { dprTrackerSearchSchema } from "@/lib/dpr-tracker-search";

export const Route = createFileRoute("/dpr/tracker")({
  validateSearch: (search) => dprTrackerSearchSchema.parse(search),
  component: DprTrackerPage,
});

function DprTrackerPage() {
  const navigate = useNavigate({ from: "/dpr/tracker" });
  const search = Route.useSearch();

  function onSearchChange(patch: Partial<typeof search>) {
    void navigate({
      search: (prev: typeof search) => {
        const next = { ...prev, ...patch };
        for (const [k, v] of Object.entries(next)) {
          if (v === undefined || v === "") delete (next as Record<string, unknown>)[k];
        }
        return next;
      },
      replace: true,
    });
  }

  return (
    <PageWrap>
      <DprTrackerHub search={search} onSearchChange={onSearchChange} />
    </PageWrap>
  );
}
