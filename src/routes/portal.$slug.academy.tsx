import { createFileRoute } from "@tanstack/react-router";

import { AcademyLibraryPage } from "@/components/portal/academy/academy-library-page";
import { useCompanyPortalStore } from "@/stores/useCompanyPortalStore";

export const Route = createFileRoute("/portal/$slug/academy")({
  component: PortalAcademyPage,
});

function PortalAcademyPage() {
  const { slug } = Route.useParams();
  const access = useCompanyPortalStore((s) => s.getBySlug(slug));
  if (!access) return null;
  return <AcademyLibraryPage slug={slug} />;
}
