import { resolveUserWorkEmail } from "@/lib/user-email";
import type { Company } from "@/types/company";
import type { Employee } from "@/types/employee";
import type { User } from "@/types/user";

export type CompanyManagerContact = {
  managerName: string;
  managerPhone: string;
  managerEmail: string;
  supportManager1Name: string;
  supportManager1Phone: string;
  supportManager1Email: string;
  supportManager2Name: string;
  supportManager2Phone: string;
  supportManager2Email: string;
};

function contactFromPerson(
  person: { name: string; email?: string; workEmail?: string; phone?: string } | undefined,
): { name: string; phone: string; email: string } {
  if (!person) return { name: "", phone: "", email: "" };
  return {
    name: person.name.trim(),
    phone: person.phone?.trim() || "",
    email: resolveUserWorkEmail(person) || person.email?.trim() || "",
  };
}

function findPerson(
  id: string | undefined,
  users: User[],
  employees: Employee[],
) {
  if (!id?.trim()) return undefined;
  const user = users.find((u) => u.id === id);
  if (user) return user;
  return employees.find((e) => e.id === id);
}

/**
 * Resolve Support 1 / Support 2 (and a primary "manager" = Support 1 → onboarding → CSM)
 * from company assignment IDs against users/employees.
 */
export function resolveCompanyManagerContact(
  company: Pick<
    Company,
    "supportManager1Id" | "supportManager2Id" | "onboardingManagerId" | "csmId" | "ownerName" | "ownerMobile" | "ownerEmail"
  >,
  users: User[],
  employees: Employee[] = [],
): CompanyManagerContact {
  const s1 = contactFromPerson(
    findPerson(company.supportManager1Id, users, employees),
  );
  const s2 = contactFromPerson(
    findPerson(company.supportManager2Id, users, employees),
  );
  const onboarding = contactFromPerson(
    findPerson(company.onboardingManagerId, users, employees),
  );
  const csm = contactFromPerson(findPerson(company.csmId, users, employees));

  const primary =
    s1.name
      ? s1
      : onboarding.name
        ? onboarding
        : csm.name
          ? csm
          : {
              name: company.ownerName?.trim() || "",
              phone: company.ownerMobile?.trim() || "",
              email: company.ownerEmail?.trim() || "",
            };

  return {
    managerName: primary.name,
    managerPhone: primary.phone,
    managerEmail: primary.email,
    supportManager1Name: s1.name,
    supportManager1Phone: s1.phone,
    supportManager1Email: s1.email,
    supportManager2Name: s2.name,
    supportManager2Phone: s2.phone,
    supportManager2Email: s2.email,
  };
}
