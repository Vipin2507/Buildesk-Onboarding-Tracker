import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/crm/tickets/$ticketId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/crm/support/$ticketId",
      params: { ticketId: params.ticketId },
      replace: true,
    });
  },
  component: () => null,
});
