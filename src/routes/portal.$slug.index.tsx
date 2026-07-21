import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/portal/$slug/")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/portal/$slug/dashboard", params: { slug: params.slug } });
  },
});
