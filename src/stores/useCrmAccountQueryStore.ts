import {
  addCrmAccountQueryMessage,
  createCrmAccountQuery,
  listCrmAccountQueries,
  updateCrmAccountQueryStatus,
} from "@/lib/api";
import type {
  CrmAccountQuery,
  CrmAccountQueryAttachment,
  CrmAccountQueryCategory,
  CrmAccountQueryMessageType,
  CrmAccountQueryStatus,
} from "@/types/crm-account-query";
import { createStore } from "./persist";

type CrmAccountQueryState = {
  queriesByCompany: Record<string, CrmAccountQuery[]>;
  loadingCompanyIds: Record<string, boolean>;
  hydrateCompanyQueries: (companyId: string, queries: CrmAccountQuery[]) => void;
  mergeQuery: (query: CrmAccountQuery) => void;
  refreshCompanyQueries: (companyId: string) => Promise<CrmAccountQuery[]>;
  createQuery: (input: {
    companyId: string;
    title: string;
    category?: CrmAccountQueryCategory;
    initialMessage?: string;
    attachments?: CrmAccountQueryAttachment[];
  }) => Promise<CrmAccountQuery>;
  addMessage: (input: {
    queryId: string;
    body: string;
    messageType?: CrmAccountQueryMessageType;
    attachments?: CrmAccountQueryAttachment[];
  }) => Promise<CrmAccountQuery>;
  updateStatus: (queryId: string, status: CrmAccountQueryStatus) => Promise<CrmAccountQuery>;
  getByCompanyId: (companyId: string) => CrmAccountQuery[];
  getById: (queryId: string) => CrmAccountQuery | undefined;
  openCountForCompany: (companyId: string) => number;
};

export const useCrmAccountQueryStore = createStore<CrmAccountQueryState>(
  (set, get) => ({
    queriesByCompany: {},
    loadingCompanyIds: {},

    hydrateCompanyQueries: (companyId, queries) => {
      set((s) => ({
        queriesByCompany: { ...s.queriesByCompany, [companyId]: queries },
      }));
    },

    mergeQuery: (query) => {
      set((s) => {
        const list = s.queriesByCompany[query.companyId] ?? [];
        const idx = list.findIndex((q) => q.id === query.id);
        const next =
          idx >= 0
            ? list.map((q) => (q.id === query.id ? query : q))
            : [query, ...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return {
          queriesByCompany: { ...s.queriesByCompany, [query.companyId]: next },
        };
      });
    },

    refreshCompanyQueries: async (companyId) => {
      set((s) => ({
        loadingCompanyIds: { ...s.loadingCompanyIds, [companyId]: true },
      }));
      try {
        const queries = await listCrmAccountQueries({ data: { companyId } });
        get().hydrateCompanyQueries(companyId, queries);
        return queries;
      } finally {
        set((s) => ({
          loadingCompanyIds: { ...s.loadingCompanyIds, [companyId]: false },
        }));
      }
    },

    createQuery: async (input) => {
      const query = await createCrmAccountQuery({ data: input });
      get().mergeQuery(query);
      return query;
    },

    addMessage: async (input) => {
      const query = await addCrmAccountQueryMessage({ data: input });
      get().mergeQuery(query);
      return query;
    },

    updateStatus: async (queryId, status) => {
      const query = await updateCrmAccountQueryStatus({ data: { queryId, status } });
      get().mergeQuery(query);
      return query;
    },

    getByCompanyId: (companyId) => get().queriesByCompany[companyId] ?? [],

    getById: (queryId) => {
      for (const list of Object.values(get().queriesByCompany)) {
        const found = list.find((q) => q.id === queryId);
        if (found) return found;
      }
      return undefined;
    },

    openCountForCompany: (companyId) =>
      (get().queriesByCompany[companyId] ?? []).filter((q) => q.status === "open").length,
  }),
);
