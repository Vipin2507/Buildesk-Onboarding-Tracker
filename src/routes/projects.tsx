import { createFileRoute, Outlet, redirect, useChildMatches } from "@tanstack/react-router";

/**
 * Standalone Projects list is retired — projects live under Company → Project.
 * Keep `/projects/$projectId` for project detail; list hits redirect to Companies.
 */
export const Route = createFileRoute("/projects")({
  beforeLoad: ({ location }) => {
    // Only redirect the list index; child project detail routes still mount here.
    const path = location.pathname.replace(/\/$/, "") || "/";
    if (path === "/projects") {
      throw redirect({ to: "/companies" });
    }
  },
  component: ProjectsLayout,
});

function ProjectsLayout() {
  const childMatches = useChildMatches();
  if (childMatches.length > 0) return <Outlet />;
  return null;
}
