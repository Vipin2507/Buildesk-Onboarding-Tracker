import {
  addCrmAccountQueryMessage,
  createCrmAccountQuery,
  listAllCrmAccountQueries,
  listCrmAccountQueries,
  setCrmAccountQueryTyping,
  updateCrmAccountQueryStatus,
  uploadCrmQueryAttachment,
} from "@/lib/api";
import type {
  CrmAccountQuery,
  CrmAccountQueryAttachment,
  CrmAccountQueryCategory,
  CrmAccountQueryMessageType,
  CrmAccountQueryStatus,
  CrmAccountQuerySummary,
} from "@/types/crm-account-query";
import { crmQueryAttachmentPreviewLabel } from "@/lib/crm-query-attachments";
import { createStore } from "./persist";

const EMPTY_COMPANY_QUERIES: CrmAccountQuery[] = [];

export { EMPTY_COMPANY_QUERIES };

type CrmAccountQueryState = {
  queriesByCompany: Record<string, CrmAccountQuery[]>;
  allQueries: CrmAccountQuerySummary[];
  loadingCompanyIds: Record<string, boolean>;
  allQueriesLoading: boolean;
  hydrateCompanyQueries: (companyId: string, queries: CrmAccountQuery[]) => void;
  hydrateAllQueries: (queries: CrmAccountQuerySummary[]) => void;
  mergeQuery: (query: CrmAccountQuery) => void;
  mergeQuerySummary: (summary: CrmAccountQuerySummary) => void;
  refreshCompanyQueries: (companyId: string) => Promise<CrmAccountQuery[]>;
  refreshAllQueries: (status?: "all" | CrmAccountQueryStatus) => Promise<CrmAccountQuerySummary[]>;
  uploadAttachment: (
    queryId: string,
    file: Blob,
    fileName: string,
    mimeType: string,
  ) => Promise<CrmAccountQueryAttachment>;
  setQueryTyping: (queryId: string, typing: boolean) => Promise<void>;
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
  openCountAll: () => number;
};

function summaryFromQuery(query: CrmAccountQuery, accountName?: string): CrmAccountQuerySummary {
  const last = query.messages[query.messages.length - 1];
  let lastMessagePreview: string | undefined;
  if (last) {
    if (last.messageType === "text") lastMessagePreview = last.body.slice(0, 120);
    else if (last.messageType === "system") lastMessagePreview = last.body;
    else lastMessagePreview = crmQueryAttachmentPreviewLabel(last.messageType, last.attachments?.[0]);
  }
  return {
    id: query.id,
    companyId: query.companyId,
    accountName,
    title: query.title,
    status: query.status,
    category: query.category,
    createdByUserId: query.createdByUserId,
    createdByName: query.createdByName,
    messageCount: query.messages.length,
    lastMessagePreview,
    resolvedAt: query.resolvedAt,
    createdAt: query.createdAt,
    updatedAt: query.updatedAt,
  };
}

export const useCrmAccountQueryStore = createStore<CrmAccountQueryState>(
  (set, get) => ({
    queriesByCompany: {},
    allQueries: [],
    loadingCompanyIds: {},
    allQueriesLoading: false,

    hydrateCompanyQueries: (companyId, queries) => {
      set((s) => ({
        queriesByCompany: { ...s.queriesByCompany, [companyId]: queries },
      }));
    },

    hydrateAllQueries: (queries) => {
      set({ allQueries: queries });
    },

    mergeQuery: (query) => {
      set((s) => {
        const list = s.queriesByCompany[query.companyId] ?? [];
        const idx = list.findIndex((q) => q.id === query.id);
        const next =
          idx >= 0
            ? list.map((q) => (q.id === query.id ? query : q))
            : [query, ...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

        const existingSummary = s.allQueries.find((q) => q.id === query.id);
        const summary = summaryFromQuery(query, existingSummary?.accountName);
        const allIdx = s.allQueries.findIndex((q) => q.id === query.id);
        const allQueries =
          allIdx >= 0
            ? s.allQueries
                .map((q) => (q.id === query.id ? summary : q))
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            : [summary, ...s.allQueries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

        return {
          queriesByCompany: { ...s.queriesByCompany, [query.companyId]: next },
          allQueries,
        };
      });
    },

    mergeQuerySummary: (summary) => {
      set((s) => {
        const idx = s.allQueries.findIndex((q) => q.id === summary.id);
        const allQueries =
          idx >= 0
            ? s.allQueries
                .map((q) => (q.id === summary.id ? summary : q))
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            : [summary, ...s.allQueries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return { allQueries };
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

    refreshAllQueries: async (status = "all") => {
      set({ allQueriesLoading: true });
      try {
        const queries = await listAllCrmAccountQueries({
          data: status === "all" ? {} : { status },
        });
        get().hydrateAllQueries(queries);
        return queries;
      } finally {
        set({ allQueriesLoading: false });
      }
    },

    uploadAttachment: async (queryId, file, fileName, mimeType) => {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]!);
      }
      const dataBase64 = btoa(binary);
      return uploadCrmQueryAttachment({
        data: { queryId, fileName, mimeType, dataBase64 },
      });
    },

    setQueryTyping: async (queryId, typing) => {
      try {
        await setCrmAccountQueryTyping({ data: { queryId, typing } });
      } catch {
        /* ignore typing heartbeat failures */
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

    getByCompanyId: (companyId) => get().queriesByCompany[companyId] ?? EMPTY_COMPANY_QUERIES,

    getById: (queryId) => {
      for (const list of Object.values(get().queriesByCompany)) {
        const found = list.find((q) => q.id === queryId);
        if (found) return found;
      }
      return undefined;
    },

    openCountForCompany: (companyId) =>
      (get().queriesByCompany[companyId] ?? EMPTY_COMPANY_QUERIES).filter((q) => q.status === "open")
        .length,

    openCountAll: () => get().allQueries.filter((q) => q.status === "open").length,
  }),
);
