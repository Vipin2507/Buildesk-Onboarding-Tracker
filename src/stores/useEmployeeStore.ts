import type { Employee } from "@/types";
import { newId, nowIso } from "@/types";
import { seedEmployees } from "@/data/seed";
import { useCompanyStore } from "./useCompanyStore";
import { logActivity } from "./useActivityStore";
import { createPersistedStore, touch } from "./persist";

type EmployeeState = {
  employees: Employee[];
  addEmployee: (data: Omit<Employee, "id" | "createdAt" | "updatedAt">) => Employee;
  updateEmployee: (id: string, data: Partial<Employee>) => void;
  deleteEmployee: (id: string) => Employee | undefined;
  getById: (id: string) => Employee | undefined;
  getManagers: () => Employee[];
  transferManager: (fromId: string, toId: string, companyIds: string[]) => void;
};

export const useEmployeeStore = createPersistedStore<EmployeeState>("employees", (set, get) => ({
  employees: seedEmployees,

  addEmployee: (data) => {
    const now = nowIso();
    const employee: Employee = { ...data, id: newId(), createdAt: now, updatedAt: now };
    set((s) => ({ employees: [...s.employees, employee] }));
    logActivity({ who: "You", what: `Added employee ${employee.name}`, kind: "success" });
    return employee;
  },

  updateEmployee: (id, data) => {
    set((s) => ({ employees: s.employees.map((e) => (e.id === id ? touch({ ...e, ...data }) : e)) }));
    logActivity({ who: "You", what: "Updated employee", kind: "info" });
  },

  deleteEmployee: (id) => {
    const employee = get().getById(id);
    set((s) => ({ employees: s.employees.filter((e) => e.id !== id) }));
    return employee;
  },

  getById: (id) => get().employees.find((e) => e.id === id),

  getManagers: () => get().employees.filter((e) => e.role === "Onboarding Manager" || e.role === "Implementation Lead"),

  transferManager: (fromId, toId, companyIds) => {
    const from = get().getById(fromId);
    const to = get().getById(toId);
    if (!from || !to) return;
    const companyStore = useCompanyStore.getState();
    for (const companyId of companyIds) {
      companyStore.transferManager(companyId, toId, "You");
    }
    logActivity({
      who: "You",
      what: `Transferred ${companyIds.length} companies from ${from.name} to ${to.name}`,
      kind: "info",
    });
  },
}));
