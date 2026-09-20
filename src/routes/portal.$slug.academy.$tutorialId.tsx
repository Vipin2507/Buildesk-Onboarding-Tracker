import { createFileRoute } from "@tanstack/react-router";

import { AcademyTutorialViewerPage } from "@/components/portal/academy/academy-tutorial-viewer-page";
import { useCompanyPortalStore } from "@/stores/useCompanyPortalStore";

export const Route = createFileRoute("/portal/$slug/academy/$tutorialId")({
  component: PortalAcademyTutorialPage,
});

function PortalAcademyTutorialPage() {
  const { slug, tutorialId } = Route.useParams();
  const access = useCompanyPortalStore((s) => s.getBySlug(slug));
  if (!access) return null;
  return <AcademyTutorialViewerPage slug={slug} tutorialId={tutorialId} />;
}
