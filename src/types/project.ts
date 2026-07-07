import type { StatusKey, Timestamps } from "./common";

export type Project = Timestamps & {
  id: string;
  name: string;
  companyId: string;
  type: string;
  units: number;
  city: string;
  rera: string;
  status: StatusKey;
  currentStep: number;
  goLiveAt?: string;
};

export type CustomerAppConfig = Timestamps & {
  projectId: string;
  mode: "buildesk" | "whitelabel";
  appName: string;
  primaryColor: string;
  logoUrl: string;
  supportEmail: string;
  supportPhone: string;
  publishStatus: "draft" | "review" | "published";
};
