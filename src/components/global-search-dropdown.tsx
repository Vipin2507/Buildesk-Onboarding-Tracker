import type { ReactNode } from "react";
import {
  BriefcaseBusiness,
  Building2,
  Boxes,
  CheckSquare,
  MapPin,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

import { cn } from "@/lib/utils";
import type { Company, FollowUpTask, Project, ClientVisit } from "@/types";
import type { CrmAccount } from "@/types/crm-account";

export type GlobalSearchScope = "crm" | "erp";

export type GlobalSearchResults = {
  crm: {
    accounts: CrmAccount[];
    tasks: FollowUpTask[];
  };
  erp: {
    companies: Company[];
    projects: Project[];
    tasks: FollowUpTask[];
    visits: ClientVisit[];
  };
};

type Props = {
  results: GlobalSearchResults;
  scope: GlobalSearchScope;
  onScopeChange: (scope: GlobalSearchScope) => void;
  canSearchCrm: boolean;
  canSearchErp: boolean;
  onClose: () => void;
};

function ScopeTabs({
  scope,
  onScopeChange,
  canSearchCrm,
  canSearchErp,
}: Pick<Props, "scope" | "onScopeChange" | "canSearchCrm" | "canSearchErp">) {
  const tabClass = (active: boolean, enabled: boolean) =>
    cn(
      "flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors",
      active
        ? "bg-primary text-primary-foreground"
        : enabled
          ? "text-muted-foreground hover:bg-muted"
          : "cursor-not-allowed text-muted-foreground/40",
    );

  return (
    <div className="flex gap-1 border-b bg-muted/30 p-2">
      <button
        type="button"
        className={tabClass(scope === "crm", canSearchCrm)}
        disabled={!canSearchCrm}
        onClick={() => canSearchCrm && onScopeChange("crm")}
      >
        CRM
      </button>
      <button
        type="button"
        className={tabClass(scope === "erp", canSearchErp)}
        disabled={!canSearchErp}
        onClick={() => canSearchErp && onScopeChange("erp")}
      >
        ERP
      </button>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  );
}

function ResultButton({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted"
      onClick={onClick}
    >
      {icon}
      <div className="min-w-0">
        <div className="truncate font-medium">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </button>
  );
}

export function GlobalSearchDropdown({
  results,
  scope,
  onScopeChange,
  canSearchCrm,
  canSearchErp,
  onClose,
}: Props) {
  const navigate = useNavigate();

  const crmCount = results.crm.accounts.length + results.crm.tasks.length;
  const erpCount =
    results.erp.companies.length +
    results.erp.projects.length +
    results.erp.tasks.length +
    results.erp.visits.length;

  const showCrmResults = scope === "crm" && canSearchCrm;
  const showErpResults = scope === "erp" && canSearchErp;

  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[70vh] overflow-auto rounded-lg border bg-popover shadow-lg">
      <ScopeTabs
        scope={scope}
        onScopeChange={onScopeChange}
        canSearchCrm={canSearchCrm}
        canSearchErp={canSearchErp}
      />

      {showCrmResults ? (
        crmCount === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">No CRM matches</div>
        ) : (
          <>
            {results.crm.accounts.length > 0 ? (
              <>
                <SectionLabel>Accounts</SectionLabel>
                {results.crm.accounts.map((a) => (
                  <ResultButton
                    key={a.id}
                    icon={<BriefcaseBusiness className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    title={a.name}
                    subtitle={[a.city, a.status].filter(Boolean).join(" · ")}
                    onClick={() => {
                      void navigate({ to: "/crm/accounts/$accountId", params: { accountId: a.id } });
                      onClose();
                    }}
                  />
                ))}
              </>
            ) : null}
            {results.crm.tasks.length > 0 ? (
              <>
                <SectionLabel>Tasks</SectionLabel>
                {results.crm.tasks.map((t) => (
                  <ResultButton
                    key={t.id}
                    icon={<CheckSquare className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    title={t.title}
                    subtitle={`Task · ${t.status}`}
                    onClick={() => {
                      void navigate({
                        to: "/crm/accounts/$accountId",
                        params: { accountId: t.companyId },
                        search: { tab: "tasks" },
                      });
                      onClose();
                    }}
                  />
                ))}
              </>
            ) : null}
          </>
        )
      ) : null}

      {showErpResults ? (
        erpCount === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">No ERP matches</div>
        ) : (
          <>
            {results.erp.companies.length > 0 ? (
              <>
                <SectionLabel>Companies</SectionLabel>
                {results.erp.companies.map((c) => (
                  <ResultButton
                    key={c.id}
                    icon={<Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    title={c.name}
                    subtitle={c.city}
                    onClick={() => {
                      void navigate({ to: "/companies/$companyId", params: { companyId: c.id } });
                      onClose();
                    }}
                  />
                ))}
              </>
            ) : null}
            {results.erp.projects.length > 0 ? (
              <>
                <SectionLabel>Projects</SectionLabel>
                {results.erp.projects.map((p) => (
                  <ResultButton
                    key={p.id}
                    icon={<Boxes className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    title={p.name}
                    subtitle={p.city}
                    onClick={() => {
                      void navigate({
                        to: "/projects/$projectId",
                        params: { projectId: p.id },
                        search: { tab: "onboarding" },
                      });
                      onClose();
                    }}
                  />
                ))}
              </>
            ) : null}
            {results.erp.tasks.length > 0 ? (
              <>
                <SectionLabel>Tasks</SectionLabel>
                {results.erp.tasks.map((t) => (
                  <ResultButton
                    key={t.id}
                    icon={<CheckSquare className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    title={t.title}
                    subtitle={`Task · ${t.status}`}
                    onClick={() => {
                      void navigate({
                        to: "/companies/$companyId",
                        params: { companyId: t.companyId },
                        search: { tab: "Tasks" },
                      });
                      onClose();
                    }}
                  />
                ))}
              </>
            ) : null}
            {results.erp.visits.length > 0 ? (
              <>
                <SectionLabel>Visits</SectionLabel>
                {results.erp.visits.map((v) => (
                  <ResultButton
                    key={v.id}
                    icon={<MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    title={v.purpose}
                    subtitle={`Visit · ${v.status}`}
                    onClick={() => {
                      void navigate({
                        to: "/companies/$companyId",
                        params: { companyId: v.companyId },
                        search: { tab: "Visits" },
                      });
                      onClose();
                    }}
                  />
                ))}
              </>
            ) : null}
          </>
        )
      ) : null}
    </div>
  );
}

export function globalSearchHasResults(results: GlobalSearchResults, scope: GlobalSearchScope) {
  if (scope === "crm") {
    return results.crm.accounts.length + results.crm.tasks.length > 0;
  }
  return (
    results.erp.companies.length +
      results.erp.projects.length +
      results.erp.tasks.length +
      results.erp.visits.length >
    0
  );
}
