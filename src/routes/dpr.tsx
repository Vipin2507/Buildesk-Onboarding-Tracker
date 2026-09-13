import { createFileRoute, Outlet, useChildMatches } from "@tanstack/react-router";

import { MyDprHub } from "@/components/dpr/my-dpr-hub";
import { PageWrap } from "@/components/page-header";

export const Route = createFileRoute("/dpr")({
  component: DprLayout,
});

/** Child routes (e.g. /dpr/tracker) render via Outlet; index is My DPR. */
function DprLayout() {
  const childMatches = useChildMatches();
  if (childMatches.length > 0) return <Outlet />;
  return (
    <PageWrap>
      <MyDprHub />
    </PageWrap>
  );
}
