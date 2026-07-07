import type { Timestamps } from "./common";

export type Integration = Timestamps & {
  id: string;
  name: string;
  description: string;
  connected: boolean;
  tested: boolean;
  projectId?: string;
};

export type Trigger = Timestamps & {
  id: string;
  name: string;
  event: string;
  channel: string;
  active: boolean;
  projectId?: string;
};
