import type { Timestamps } from "./common";

export type EmployeeRole =
  | "Onboarding Manager"
  | "Implementation Lead"
  | "Implementation Engineer"
  | "CSM"
  | "Admin";

export type Employee = Timestamps & {
  id: string;
  name: string;
  role: EmployeeRole;
  region: string;
  email: string;
};
