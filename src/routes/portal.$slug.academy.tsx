import { createFileRoute, Outlet, useChildMatches } from "@tanstack/react-router";

import { AcademyLibraryPage } from "@/components/portal/academy/academy-library-page";
import { useCompanyPortalStore } from "@/stores/useCompanyPortalStore";

export const Route = createFileRoute("/portal/$slug/academy")({
  component: PortalAcademyPage,
});

/** Child `/academy/$tutorialId` renders via Outlet; index is the library. */
function PortalAcademyPage() {
  const { slug } = Route.useParams();
  const access = useCompanyPortalStore((s) => s.getBySlug(slug));
  const childMatches = useChildMatches();

  if (!access) return null;
  if (childMatches.length > 0) return <Outlet />;
  return <AcademyLibraryPage slug={slug} />;
}
