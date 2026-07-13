import type { ActivityKind, Timestamps } from "./common";

export type AppNotification = Timestamps & {
  id: string;
  userId?: string;
  title: string;
  body: string;
  kind: ActivityKind;
  href?: string;
  readAt?: string;
  companyId?: string;
  ticketId?: string;
};
