import { createStore, touch } from "./persist";
import { newId, nowIso } from "@/types/common";
import type { CompanyType } from "@/types/company";
import type {
  CrmCommActionKey,
  CrmCommChannel,
  CrmGoLiveChecklistItem,
  CrmImplementationStage,
  CrmMasterChecklistItem,
  CrmMigrationChecklistItem,
  CrmOnboardingRecord,
  CrmProductModuleKey,
  CrmProductModuleKey,
  CrmReportChecklistItem,
  CrmTrackerMeta,
  CrmTrackerPriority,
  CrmTrainingSession,
} from "@/types/crm-onboarding";
import type { ChecklistPhase } from "@/types/onboarding";
import {
  createCrmOnboardingRecord,
  CRM_GO_LIVE_CHECKLIST_LABELS,
  CRM_REPORT_CHECKLIST_LABELS,
  defaultModuleWorkflow,
  defaultTrainingSessions,
  ensureMasterDataFields,
  isDeveloperCompanyType,
  mergeCrmGoLiveChecklist,
  mergeCrmMigrationChecklist,
  mergeCrmProductModules,
  mergeCrmReportChecklist,
  mergeCrmTrainingSessions,
  needsProductModulesUpgrade,
  normalizeCrmMasterChecklist,
} from "@/data/crm-onboarding-defaults";
import { resolveCrmMigrationCatalog } from "@/lib/crm-migration-catalog";
import { resolveCrmTrainingCatalogForCompany } from "@/lib/crm-training-catalog";
import type {
  CrmAccountProject,
  CrmMasterDictItem,
  CrmMasterTeam,
} from "@/types/crm-master";
import {
  notifyCrmStageChange,
  notifyCrmTrainingLogged,
} from "@/lib/crm-notify";
import {
  deleteCrmOnboardingRecord as apiDeleteCrmOnboardingRecord,
  upsertCrmOnboardingRecord as apiUpsertCrmOnboardingRecord,
} from "@/lib/api";
import { serverSync, serverSyncDebounced } from "@/lib/sync";
import { useCrmAccountStore } from "./useCrmAccountStore";
import { getCrmMasterProductModuleCatalog } from "./useCrmMasterStore";
import {
  applyChecklistPhaseDate,
  applyChecklistForceCompleteAll,
  applyChecklistPhaseToggle,
} from "@/lib/checklist";

type CrmOnboardingState = {
  records: CrmOnboardingRecord[];
  hydrateRecords: (records: CrmOnboardingRecord[]) => void;
  applyProductModulesCatalogToAllAccounts: () => number;
  ensureForCompany: (companyId: string, companyType?: CompanyType) => CrmOnboardingRecord;
  getByCompanyId: (companyId: string) => CrmOnboardingRecord | undefined;
  setProductModuleEnabled: (companyId: string, key: CrmProductModuleKey, enabled: boolean) => void;
  setModuleProvider: (companyId: string, key: CrmProductModuleKey, provider: string) => void;
  toggleModuleWorkflowStep: (
    companyId: string,
    key: CrmProductModuleKey,
    stepKey: string,
    done?: boolean,
  ) => void;
  setModuleWorkflowStepDate: (
    companyId: string,
    key: CrmProductModuleKey,
    stepKey: string,
    at: string,
  ) => void;
  toggleMasterPhase: (
    companyId: string,
    key: string,
    phase: ChecklistPhase,
    at?: string,
  ) => void;
  setMasterPhaseDate: (
    companyId: string,
    key: string,
    phase: ChecklistPhase,
    at: string,
  ) => void;
  forceCompleteMasterItem: (companyId: string, key: string, at: string) => void;
  setMasterNotApplicable: (companyId: string, key: string, notApplicable: boolean) => void;
  updateMasterRemarks: (companyId: string, key: string, remarks: string) => void;
  updateMasterAssignment: (
    companyId: string,
    key: string,
    patch: { assigneeUserId?: string; dueDate?: string },
  ) => void;
  toggleMigrationPhase: (
    companyId: string,
    key: string,
    phase: ChecklistPhase,
    at?: string,
  ) => void;
  setMigrationPhaseDate: (
    companyId: string,
    key: string,
    phase: ChecklistPhase,
    at: string,
  ) => void;
  forceCompleteMigrationItem: (companyId: string, key: string, at: string) => void;
  setMigrationNotApplicable: (companyId: string, key: string, notApplicable: boolean) => void;
  updateMigrationRemarks: (companyId: string, key: string, remarks: string) => void;
  updateMigrationAssignment: (
    companyId: string,
    key: string,
    patch: { assigneeUserId?: string; dueDate?: string },
  ) => void;
  updateMigrationMeta: (
    companyId: string,
    key: string,
    patch: Partial<Pick<CrmMigrationChecklistItem, "sourceFile" | "recordCount" | "remarks">>,
  ) => void;
  adjustMigrationUploadAttempts: (companyId: string, key: string, delta: number) => void;
  upsertTrainingSession: (companyId: string, session: CrmTrainingSession) => void;
  logTrainingSession: (
    companyId: string,
    sessionId: string,
    entry?: {
      trainingDate?: string;
      trainerName?: string;
      durationHours?: number;
      attendance?: string;
      note?: string;
      recordingUploaded?: boolean;
    },
  ) => void;
  adjustTrainingSessionCount: (companyId: string, sessionId: string, delta: number) => void;
  setTrainingNotApplicable: (companyId: string, sessionId: string, notApplicable: boolean) => void;
  removeTrainingSession: (companyId: string, sessionId: string) => void;
  setReportItem: (
    companyId: string,
    key: string,
    patch: Partial<CrmReportChecklistItem>,
  ) => void;
  logReportExplanation: (
    companyId: string,
    key: string,
    entry?: { explainedAt?: string; trainerName?: string; note?: string },
  ) => void;
  adjustReportExplanationCount: (companyId: string, key: string, delta: number) => void;
  setGoLiveItem: (
    companyId: string,
    key: string,
    status: CrmGoLiveChecklistItem["status"],
    completedAt?: string,
  ) => void;
  setGoLiveNotApplicable: (companyId: string, key: string, notApplicable: boolean) => void;
  updateGoLiveMeta: (
    companyId: string,
    key: string,
    patch: Partial<Pick<CrmGoLiveChecklistItem, "remarks" | "assigneeUserId" | "dueDate">>,
  ) => void;
  completeAllGoLiveItems: (companyId: string) => void;
  updateTracker: (companyId: string, patch: Partial<CrmTrackerMeta>, who?: string) => void;
  logComm: (
    companyId: string,
    action: CrmCommActionKey,
    channel: CrmCommChannel,
    summary: string,
    status?: "sent" | "logged" | "failed",
    loggedBy?: string,
  ) => void;
  resetTrainingForCompanyType: (companyId: string, companyType?: CompanyType) => void;
  removeRecord: (companyId: string) => void;

  upsertMasterProject: (
    companyId: string,
    project: Omit<CrmAccountProject, "id" | "createdAt" | "updatedAt"> & { id?: string },
  ) => void;
  deleteMasterProject: (companyId: string, projectId: string) => void;
  upsertMasterDictItem: (
    companyId: string,
    kind: "sources" | "statuses" | "followUps",
    item: Omit<CrmMasterDictItem, "id" | "createdAt" | "updatedAt"> & { id?: string },
  ) => void;
  deleteMasterDictItem: (
    companyId: string,
    kind: "sources" | "statuses" | "followUps",
    itemId: string,
  ) => void;
  upsertMasterTeam: (
    companyId: string,
    team: Omit<CrmMasterTeam, "id" | "createdAt" | "updatedAt"> & { id?: string },
  ) => void;
  deleteMasterTeam: (companyId: string, teamId: string) => void;
};

function updateRecord(
  records: CrmOnboardingRecord[],
  companyId: string,
  mutator: (r: CrmOnboardingRecord) => CrmOnboardingRecord,
): CrmOnboardingRecord[] {
  return records.map((r) => (r.companyId === companyId ? touch(mutator(r)) : r));
}

function mapMaster(
  records: CrmOnboardingRecord[],
  companyId: string,
  key: string,
  mutator: (item: CrmMasterChecklistItem) => CrmMasterChecklistItem,
) {
  return updateRecord(records, companyId, (r) => ({
    ...r,
    masterChecklist: r.masterChecklist.map((m) => (m.key === key ? mutator(m) : m)),
  }));
}

function mapMigration(
  records: CrmOnboardingRecord[],
  companyId: string,
  key: string,
  mutator: (item: CrmMigrationChecklistItem) => CrmMigrationChecklistItem,
) {
  return updateRecord(records, companyId, (r) => ({
    ...r,
    migrationChecklist: r.migrationChecklist.map((m) => (m.key === key ? mutator(m) : m)),
  }));
}

function needsMasterMigration(items: CrmMasterChecklistItem[]) {
  return items.some(
    (m) =>
      typeof (m as { status?: string }).status === "string" ||
      typeof m.collected !== "boolean" ||
      typeof m.notApplicable !== "boolean" ||
      typeof m.remarks !== "string",
  );
}

function needsDataMigrationChecklistUpgrade(items: CrmMigrationChecklistItem[]) {
  const catalog = resolveCrmMigrationCatalog();
  if (items.some((i) => typeof i.collected !== "boolean" || typeof i.uploadAttempts !== "number")) {
    return true;
  }
  if (items.length !== catalog.length) return true;
  const catalogKeys = new Set(catalog.map((d) => d.key));
  if (items.some((i) => !catalogKeys.has(i.key))) return true;
  const byKey = new Map(items.map((i) => [i.key, i]));
  for (const def of catalog) {
    const prev = byKey.get(def.key);
    if (!prev) return true;
    if (prev.label !== def.label || prev.category !== def.category) return true;
  }
  return false;
}

function needsTrainingUpgrade(items: CrmTrainingSession[], companyType?: CompanyType) {
  const catalog = resolveCrmTrainingCatalogForCompany(companyType);
  if (items.some((i) => typeof i.sessionCount !== "number")) return true;
  const byKey = new Map(items.map((i) => [i.templateKey, i]));
  for (const def of catalog) {
    const prev = byKey.get(def.key);
    if (!prev) return true;
    if (prev.label !== def.label || (prev.category ?? "") !== def.category) return true;
  }
  return false;
}

function needsReportMigration(items: CrmReportChecklistItem[]) {
  if (items.some((i) => typeof i.explanationCount !== "number")) return true;
  const existingKeys = new Set(items.map((i) => i.key));
  return CRM_REPORT_CHECKLIST_LABELS.some((d) => !existingKeys.has(d.key));
}

function needsGoLiveUpgrade(items: CrmGoLiveChecklistItem[]) {
  const existingKeys = new Set(items.map((i) => i.key));
  if (CRM_GO_LIVE_CHECKLIST_LABELS.some((d) => !existingKeys.has(d.key))) return true;
  return items.some((i) => i.category === undefined);
}

let hydratingCrmOnboarding = false;

export const useCrmOnboardingStore = createStore<CrmOnboardingState>((rawSet, get) => {
  const set: typeof rawSet = (partial, ...rest) => {
    const prev = get().records;
    const prevUpdated = new Map(prev.map((r) => [r.companyId, r.updatedAt]));
    const prevIds = new Set(prev.map((r) => r.companyId));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rawSet as any)(partial, ...rest);
    if (hydratingCrmOnboarding) return;

    const next = get().records;
    const nextIds = new Set(next.map((r) => r.companyId));

    for (const record of next) {
      if (prevUpdated.get(record.companyId) !== record.updatedAt) {
        const companyId = record.companyId;
        serverSyncDebounced(`crm-onboarding:${companyId}`, 400, async () => {
          const latest = get().getByCompanyId(companyId);
          if (!latest) return;
          await apiUpsertCrmOnboardingRecord({ data: latest });
        });
      }
    }

    for (const companyId of prevIds) {
      if (!nextIds.has(companyId)) {
        serverSync("crm onboarding delete", () =>
          apiDeleteCrmOnboardingRecord({ data: { companyId } }),
        );
      }
    }
  };

  return {
  records: [],

  hydrateRecords: (records) => {
    hydratingCrmOnboarding = true;
    try {
      rawSet({
        records: records.map((r) => ({
          ...r,
          masterProjects: r.masterProjects ?? [],
          masterSources: r.masterSources ?? [],
          masterStatuses: r.masterStatuses ?? [],
          masterFollowUps: r.masterFollowUps ?? [],
          masterTeams: r.masterTeams ?? [],
        })),
      });
    } finally {
      hydratingCrmOnboarding = false;
    }
  },

  getByCompanyId: (companyId) => get().records.find((r) => r.companyId === companyId),

  applyProductModulesCatalogToAllAccounts: () => {
    const catalog = getCrmMasterProductModuleCatalog();
    let updated = 0;
    set((s) => ({
      records: s.records.map((r) => {
        const next = mergeCrmProductModules(r.productModules, catalog as { key: CrmProductModuleKey; label: string }[]);
        const same =
          next.length === r.productModules.length &&
          next.every(
            (m, i) =>
              m.key === r.productModules[i]?.key &&
              m.label === r.productModules[i]?.label &&
              m.enabled === r.productModules[i]?.enabled,
          );
        if (same) return r;
        updated += 1;
        return touch({ ...r, productModules: next });
      }),
    }));
    return updated;
  },

  ensureForCompany: (companyId, companyType) => {
    const moduleCatalog = getCrmMasterProductModuleCatalog();
    const existing = get().getByCompanyId(companyId);
    if (existing) {
      let changed = false;
      if (needsMasterMigration(existing.masterChecklist)) {
        set((s) => ({
          records: updateRecord(s.records, companyId, (r) => ({
            ...r,
            masterChecklist: normalizeCrmMasterChecklist(
              r.masterChecklist as Array<CrmMasterChecklistItem & { status?: string; completedAt?: string }>,
            ),
          })),
        }));
        changed = true;
      }
      const current = get().getByCompanyId(companyId)!;
      if (needsDataMigrationChecklistUpgrade(current.migrationChecklist)) {
        const catalog = resolveCrmMigrationCatalog();
        set((s) => ({
          records: updateRecord(s.records, companyId, (r) => ({
            ...r,
            migrationChecklist: mergeCrmMigrationChecklist(r.migrationChecklist, catalog),
          })),
        }));
        changed = true;
      }
      const afterMig = get().getByCompanyId(companyId)!;
      if (needsTrainingUpgrade(afterMig.trainingSessions, companyType ?? afterMig.companyTypeHint)) {
        const typeHint = companyType ?? afterMig.companyTypeHint;
        const catalog = resolveCrmTrainingCatalogForCompany(typeHint);
        set((s) => ({
          records: updateRecord(s.records, companyId, (r) => ({
            ...r,
            trainingSessions: mergeCrmTrainingSessions(
              r.trainingSessions,
              companyType ?? r.companyTypeHint,
              catalog,
            ),
          })),
        }));
        changed = true;
      }
      const afterTrain = get().getByCompanyId(companyId)!;
      if (needsReportMigration(afterTrain.reportChecklist)) {
        set((s) => ({
          records: updateRecord(s.records, companyId, (r) => ({
            ...r,
            reportChecklist: mergeCrmReportChecklist(r.reportChecklist),
          })),
        }));
        changed = true;
      }
      const afterReports = get().getByCompanyId(companyId)!;
      if (needsGoLiveUpgrade(afterReports.goLiveChecklist)) {
        set((s) => ({
          records: updateRecord(s.records, companyId, (r) => ({
            ...r,
            goLiveChecklist: mergeCrmGoLiveChecklist(r.goLiveChecklist),
          })),
        }));
        changed = true;
      }
      const afterGoLive = get().getByCompanyId(companyId)!;
      if (needsProductModulesUpgrade(afterGoLive.productModules, moduleCatalog as { key: CrmProductModuleKey; label: string }[])) {
        set((s) => ({
          records: updateRecord(s.records, companyId, (r) => ({
            ...r,
            productModules: mergeCrmProductModules(
              r.productModules,
              moduleCatalog as { key: CrmProductModuleKey; label: string }[],
            ),
          })),
        }));
        changed = true;
      }
      const afterModules = get().getByCompanyId(companyId)!;
      if (
        !afterModules.masterProjects ||
        !afterModules.masterSources ||
        !afterModules.masterStatuses ||
        !afterModules.masterFollowUps ||
        !afterModules.masterTeams
      ) {
        set((s) => ({
          records: updateRecord(s.records, companyId, (r) => ({
            ...r,
            ...ensureMasterDataFields(r),
          })),
        }));
        changed = true;
      }
      void changed;
      const refreshed = get().getByCompanyId(companyId)!;
      const shouldResetTraining =
        companyType &&
        refreshed.companyTypeHint !== companyType &&
        isDeveloperCompanyType(refreshed.companyTypeHint) !== isDeveloperCompanyType(companyType);
      if (shouldResetTraining) {
        get().resetTrainingForCompanyType(companyId, companyType);
        return get().getByCompanyId(companyId)!;
      }
      return get().getByCompanyId(companyId)!;
    }
    const created = createCrmOnboardingRecord(
      companyId,
      companyType,
      resolveCrmMigrationCatalog(),
      resolveCrmTrainingCatalogForCompany(companyType),
      moduleCatalog as { key: CrmProductModuleKey; label: string }[],
    );
    set((s) => ({ records: [created, ...s.records] }));
    return created;
  },

  setProductModuleEnabled: (companyId, key, enabled) => {
    get().ensureForCompany(companyId);
    set((s) => ({
      records: updateRecord(s.records, companyId, (r) => ({
        ...r,
        productModules: r.productModules.map((m) => {
          if (m.key !== key) return m;
          const workflow =
            enabled && (!m.workflow || m.workflow.length === 0)
              ? defaultModuleWorkflow(key)
              : m.workflow;
          return { ...m, enabled, workflow };
        }),
      })),
    }));
  },

  setModuleProvider: (companyId, key, provider) => {
    get().ensureForCompany(companyId);
    set((s) => ({
      records: updateRecord(s.records, companyId, (r) => ({
        ...r,
        productModules: r.productModules.map((m) => {
          if (m.key !== key) return m;
          const today = nowIso().slice(0, 10);
          const workflow = (m.workflow ?? defaultModuleWorkflow(key)).map((step) =>
            step.key === "provider_selected"
              ? {
                  ...step,
                  done: Boolean(provider),
                  completedAt: provider ? step.completedAt ?? today : undefined,
                }
              : step,
          );
          return { ...m, provider: provider || undefined, workflow };
        }),
      })),
    }));
  },

  toggleModuleWorkflowStep: (companyId, key, stepKey, done) => {
    get().ensureForCompany(companyId);
    const today = nowIso().slice(0, 10);
    set((s) => ({
      records: updateRecord(s.records, companyId, (r) => ({
        ...r,
        productModules: r.productModules.map((m) => {
          if (m.key !== key) return m;
          const workflow = (m.workflow ?? defaultModuleWorkflow(key)).map((step) => {
            if (step.key !== stepKey) return step;
            const next = done ?? !step.done;
            return {
              ...step,
              done: next,
              completedAt: next ? step.completedAt ?? today : undefined,
            };
          });
          return { ...m, workflow };
        }),
      })),
    }));
  },

  setModuleWorkflowStepDate: (companyId, key, stepKey, at) => {
    get().ensureForCompany(companyId);
    set((s) => ({
      records: updateRecord(s.records, companyId, (r) => ({
        ...r,
        productModules: r.productModules.map((m) => {
          if (m.key !== key) return m;
          const workflow = (m.workflow ?? defaultModuleWorkflow(key)).map((step) =>
            step.key === stepKey ? { ...step, done: true, completedAt: at } : step,
          );
          return { ...m, workflow };
        }),
      })),
    }));
  },

  toggleMasterPhase: (companyId, key, phase, at) => {
    get().ensureForCompany(companyId);
    set((s) => ({
      records: mapMaster(s.records, companyId, key, (m) => {
        const next = applyChecklistPhaseToggle(m, phase, at);
        return next ?? m;
      }),
    }));
  },

  setMasterPhaseDate: (companyId, key, phase, at) => {
    get().ensureForCompany(companyId);
    set((s) => ({
      records: mapMaster(s.records, companyId, key, (m) => {
        const next = applyChecklistPhaseDate(m, phase, at);
        return next ?? m;
      }),
    }));
  },

  forceCompleteMasterItem: (companyId, key, at) => {
    get().ensureForCompany(companyId);
    set((s) => ({
      records: mapMaster(s.records, companyId, key, (m) => {
        const next = applyChecklistForceCompleteAll(m, at);
        return next ?? m;
      }),
    }));
  },

  setMasterNotApplicable: (companyId, key, notApplicable) => {
    get().ensureForCompany(companyId);
    set((s) => ({
      records: mapMaster(s.records, companyId, key, (m) =>
        notApplicable
          ? {
              ...m,
              notApplicable: true,
              collected: false,
              uploaded: false,
              live: false,
              collectedAt: undefined,
              uploadedAt: undefined,
              liveAt: undefined,
            }
          : { ...m, notApplicable: false },
      ),
    }));
  },

  updateMasterRemarks: (companyId, key, remarks) => {
    get().ensureForCompany(companyId);
    set((s) => ({
      records: mapMaster(s.records, companyId, key, (m) => ({ ...m, remarks })),
    }));
  },

  updateMasterAssignment: (companyId, key, patch) => {
    get().ensureForCompany(companyId);
    set((s) => ({
      records: mapMaster(s.records, companyId, key, (m) => ({
        ...m,
        assigneeUserId: patch.assigneeUserId,
        dueDate: patch.dueDate,
      })),
    }));
  },

  toggleMigrationPhase: (companyId, key, phase, at) => {
    get().ensureForCompany(companyId);
    set((s) => ({
      records: mapMigration(s.records, companyId, key, (m) => {
        const next = applyChecklistPhaseToggle(m, phase, at);
        if (!next) return m;
        // Counting an upload attempt when Uploaded is newly marked
        if (phase === "uploaded" && !m.uploaded && next.uploaded) {
          return { ...next, uploadAttempts: (m.uploadAttempts ?? 0) + 1 };
        }
        return next;
      }),
    }));
  },

  setMigrationPhaseDate: (companyId, key, phase, at) => {
    get().ensureForCompany(companyId);
    set((s) => ({
      records: mapMigration(s.records, companyId, key, (m) => {
        const next = applyChecklistPhaseDate(m, phase, at);
        return next ?? m;
      }),
    }));
  },

  forceCompleteMigrationItem: (companyId, key, at) => {
    get().ensureForCompany(companyId);
    set((s) => ({
      records: mapMigration(s.records, companyId, key, (m) => {
        const next = applyChecklistForceCompleteAll(m, at);
        if (!next) return m;
        if (!m.uploaded && next.uploaded) {
          return { ...next, uploadAttempts: (m.uploadAttempts ?? 0) + 1 };
        }
        return next;
      }),
    }));
  },

  setMigrationNotApplicable: (companyId, key, notApplicable) => {
    get().ensureForCompany(companyId);
    set((s) => ({
      records: mapMigration(s.records, companyId, key, (m) =>
        notApplicable
          ? {
              ...m,
              notApplicable: true,
              collected: false,
              uploaded: false,
              live: false,
              collectedAt: undefined,
              uploadedAt: undefined,
              liveAt: undefined,
            }
          : { ...m, notApplicable: false },
      ),
    }));
  },

  updateMigrationRemarks: (companyId, key, remarks) => {
    get().ensureForCompany(companyId);
    set((s) => ({
      records: mapMigration(s.records, companyId, key, (m) => ({ ...m, remarks })),
    }));
  },

  updateMigrationAssignment: (companyId, key, patch) => {
    get().ensureForCompany(companyId);
    set((s) => ({
      records: mapMigration(s.records, companyId, key, (m) => ({
        ...m,
        assigneeUserId: patch.assigneeUserId,
        dueDate: patch.dueDate,
      })),
    }));
  },

  updateMigrationMeta: (companyId, key, patch) => {
    get().ensureForCompany(companyId);
    set((s) => ({
      records: mapMigration(s.records, companyId, key, (m) => ({ ...m, ...patch })),
    }));
  },

  adjustMigrationUploadAttempts: (companyId, key, delta) => {
    get().ensureForCompany(companyId);
    set((s) => ({
      records: mapMigration(s.records, companyId, key, (m) => ({
        ...m,
        uploadAttempts: Math.max(0, (m.uploadAttempts ?? 0) + delta),
      })),
    }));
  },

  upsertTrainingSession: (companyId, session) => {
    get().ensureForCompany(companyId);
    set((s) => ({
      records: updateRecord(s.records, companyId, (r) => {
        const idx = r.trainingSessions.findIndex((t) => t.id === session.id);
        const normalized: CrmTrainingSession = {
          ...session,
          sessionCount: session.sessionCount ?? 0,
          sessionLog: session.sessionLog ?? [],
          completed: session.completed || (session.sessionCount ?? 0) > 0,
        };
        const trainingSessions =
          idx >= 0
            ? r.trainingSessions.map((t, i) => (i === idx ? touch(normalized) : t))
            : [...r.trainingSessions, touch(normalized)];
        return { ...r, trainingSessions };
      }),
    }));
  },

  logTrainingSession: (companyId, sessionId, entry) => {
    get().ensureForCompany(companyId);
    const trainingDate = entry?.trainingDate || nowIso().slice(0, 10);
    const before = get().getByCompanyId(companyId);
    const sessionLabel =
      before?.trainingSessions.find((s) => s.id === sessionId)?.label ?? "Training session";
    set((s) => ({
      records: updateRecord(s.records, companyId, (r) => ({
        ...r,
        trainingSessions: r.trainingSessions.map((item) => {
          if (item.id !== sessionId) return item;
          const count = (item.sessionCount ?? 0) + 1;
          return touch({
            ...item,
            sessionCount: count,
            completed: true,
            trainingDate,
            trainerName: entry?.trainerName?.trim() || item.trainerName,
            durationHours: entry?.durationHours ?? item.durationHours,
            attendance: entry?.attendance?.trim() || item.attendance,
            recordingUploaded: entry?.recordingUploaded ?? item.recordingUploaded,
            notes: entry?.note?.trim() || item.notes,
            sessionLog: [
              {
                id: newId(),
                trainingDate,
                trainerName: entry?.trainerName?.trim() || undefined,
                durationHours: entry?.durationHours,
                attendance: entry?.attendance?.trim() || undefined,
                note: entry?.note?.trim() || undefined,
                recordingUploaded: entry?.recordingUploaded,
              },
              ...(item.sessionLog ?? []),
            ],
          });
        }),
      })),
    }));
    const accountName = useCrmAccountStore.getState().getById(companyId)?.name ?? "CRM account";
    notifyCrmTrainingLogged(companyId, accountName, sessionLabel);
  },

  adjustTrainingSessionCount: (companyId, sessionId, delta) => {
    get().ensureForCompany(companyId);
    set((s) => ({
      records: updateRecord(s.records, companyId, (r) => ({
        ...r,
        trainingSessions: r.trainingSessions.map((item) => {
          if (item.id !== sessionId) return item;
          const count = Math.max(0, (item.sessionCount ?? 0) + delta);
          let sessionLog = [...(item.sessionLog ?? [])];
          if (delta < 0 && sessionLog.length > 0) {
            sessionLog = sessionLog.slice(0, Math.max(0, sessionLog.length + delta));
          }
          if (delta > 0) {
            const trainingDate = nowIso().slice(0, 10);
            for (let i = 0; i < delta; i++) {
              sessionLog = [
                {
                  id: newId(),
                  trainingDate,
                  trainerName: item.trainerName || undefined,
                  durationHours: item.durationHours || undefined,
                  attendance: item.attendance || undefined,
                },
                ...sessionLog,
              ];
            }
          }
          return touch({
            ...item,
            sessionCount: count,
            completed: count > 0,
            trainingDate: count > 0 ? (sessionLog[0]?.trainingDate ?? item.trainingDate) : item.trainingDate,
            sessionLog,
          });
        }),
      })),
    }));
  },

  setTrainingNotApplicable: (companyId, sessionId, notApplicable) => {
    get().ensureForCompany(companyId);
    set((s) => ({
      records: updateRecord(s.records, companyId, (r) => ({
        ...r,
        trainingSessions: r.trainingSessions.map((item) =>
          item.id === sessionId ? touch({ ...item, notApplicable }) : item,
        ),
      })),
    }));
  },

  removeTrainingSession: (companyId, sessionId) => {
    get().ensureForCompany(companyId);
    set((s) => ({
      records: updateRecord(s.records, companyId, (r) => ({
        ...r,
        trainingSessions: r.trainingSessions.filter((item) => item.id !== sessionId),
      })),
    }));
  },

  setReportItem: (companyId, key, patch) => {
    get().ensureForCompany(companyId);
    set((s) => ({
      records: updateRecord(s.records, companyId, (r) => ({
        ...r,
        reportChecklist: r.reportChecklist.map((item) => {
          if (item.key !== key) return item;
          const next = { ...item, ...patch };
          const count =
            typeof next.explanationCount === "number"
              ? Math.max(0, next.explanationCount)
              : item.explanationCount ?? 0;
          return {
            ...next,
            explanationCount: count,
            status: count > 0 ? ("explained" as const) : ("pending" as const),
          };
        }),
      })),
    }));
  },

  logReportExplanation: (companyId, key, entry) => {
    get().ensureForCompany(companyId);
    const explainedAt = entry?.explainedAt || nowIso().slice(0, 10);
    const trainerName = entry?.trainerName?.trim() || undefined;
    const note = entry?.note?.trim() || undefined;
    set((s) => ({
      records: updateRecord(s.records, companyId, (r) => ({
        ...r,
        reportChecklist: r.reportChecklist.map((item) => {
          if (item.key !== key) return item;
          const count = (item.explanationCount ?? 0) + 1;
          return {
            ...item,
            explanationCount: count,
            status: "explained" as const,
            explainedAt,
            trainerName: trainerName ?? item.trainerName,
            notes: note ?? item.notes,
            explanationLog: [
              {
                id: newId(),
                explainedAt,
                trainerName,
                note,
              },
              ...(item.explanationLog ?? []),
            ],
          };
        }),
      })),
    }));
  },

  adjustReportExplanationCount: (companyId, key, delta) => {
    get().ensureForCompany(companyId);
    set((s) => ({
      records: updateRecord(s.records, companyId, (r) => ({
        ...r,
        reportChecklist: r.reportChecklist.map((item) => {
          if (item.key !== key) return item;
          const count = Math.max(0, (item.explanationCount ?? 0) + delta);
          let explanationLog = [...(item.explanationLog ?? [])];
          if (delta < 0 && explanationLog.length > 0) {
            explanationLog = explanationLog.slice(0, Math.max(0, explanationLog.length + delta));
          }
          if (delta > 0) {
            const explainedAt = nowIso().slice(0, 10);
            for (let i = 0; i < delta; i++) {
              explanationLog = [
                {
                  id: newId(),
                  explainedAt,
                  trainerName: item.trainerName,
                },
                ...explanationLog,
              ];
            }
          }
          return {
            ...item,
            explanationCount: count,
            status: count > 0 ? ("explained" as const) : ("pending" as const),
            explainedAt: count > 0 ? (explanationLog[0]?.explainedAt ?? item.explainedAt) : undefined,
            explanationLog,
          };
        }),
      })),
    }));
  },

  setGoLiveItem: (companyId, key, status, completedAt) => {
    get().ensureForCompany(companyId);
    const nextCompletedAt =
      status === "completed" ? (completedAt?.slice(0, 10) || undefined) : undefined;
    set((s) => ({
      records: updateRecord(s.records, companyId, (r) => ({
        ...r,
        goLiveChecklist: r.goLiveChecklist.map((g) =>
          g.key === key
            ? {
                ...g,
                status,
                completedAt: nextCompletedAt,
                notApplicable: false,
              }
            : g,
        ),
      })),
    }));
  },

  setGoLiveNotApplicable: (companyId, key, notApplicable) => {
    get().ensureForCompany(companyId);
    set((s) => ({
      records: updateRecord(s.records, companyId, (r) => ({
        ...r,
        goLiveChecklist: r.goLiveChecklist.map((g) =>
          g.key === key
            ? {
                ...g,
                notApplicable,
                status: notApplicable ? ("pending" as const) : g.status,
                completedAt: notApplicable ? undefined : g.completedAt,
              }
            : g,
        ),
      })),
    }));
  },

  updateGoLiveMeta: (companyId, key, patch) => {
    get().ensureForCompany(companyId);
    set((s) => ({
      records: updateRecord(s.records, companyId, (r) => ({
        ...r,
        goLiveChecklist: r.goLiveChecklist.map((g) =>
          g.key === key ? { ...g, ...patch } : g,
        ),
      })),
    }));
  },

  completeAllGoLiveItems: (companyId) => {
    get().ensureForCompany(companyId);
    const completedAt = nowIso().slice(0, 10);
    set((s) => ({
      records: updateRecord(s.records, companyId, (r) => ({
        ...r,
        goLiveChecklist: r.goLiveChecklist.map((g) =>
          g.notApplicable
            ? g
            : { ...g, status: "completed" as const, completedAt },
        ),
      })),
    }));
  },

  updateTracker: (companyId, patch, who) => {
    get().ensureForCompany(companyId);
    const prev = get().getByCompanyId(companyId)?.tracker;
    const stageChanged =
      patch.stage != null && prev != null && patch.stage !== prev.stage;
    set((s) => ({
      records: updateRecord(s.records, companyId, (r) => ({
        ...r,
        tracker: {
          ...r.tracker,
          ...patch,
          lastUpdatedBy: who ?? r.tracker.lastUpdatedBy,
        },
      })),
    }));
    if (stageChanged && patch.stage) {
      const accountName = useCrmAccountStore.getState().getById(companyId)?.name ?? "CRM account";
      notifyCrmStageChange(companyId, accountName, patch.stage, who);
    }
  },

  logComm: (companyId, action, channel, summary, status = "logged", loggedBy) => {
    get().ensureForCompany(companyId);
    const now = nowIso();
    set((s) => ({
      records: updateRecord(s.records, companyId, (r) => ({
        ...r,
        commLog: [
          {
            id: newId(),
            action,
            channel,
            summary,
            status,
            loggedBy: loggedBy?.trim() || undefined,
            createdAt: now,
            updatedAt: now,
          },
          ...r.commLog,
        ],
      })),
    }));
  },

  resetTrainingForCompanyType: (companyId, companyType) => {
    get().ensureForCompany(companyId);
    set((s) => ({
      records: updateRecord(s.records, companyId, (r) => ({
        ...r,
        companyTypeHint: companyType,
        trainingSessions: defaultTrainingSessions(
          companyType,
          resolveCrmTrainingCatalogForCompany(companyType),
        ),
      })),
    }));
  },

  removeRecord: (companyId) => {
    set((s) => ({
      records: s.records.filter((r) => r.companyId !== companyId),
    }));
  },

  upsertMasterProject: (companyId, project) => {
    get().ensureForCompany(companyId);
    const now = nowIso();
    set((s) => ({
      records: updateRecord(s.records, companyId, (r) => {
        const list = r.masterProjects ?? [];
        if (project.id && list.some((p) => p.id === project.id)) {
          return {
            ...r,
            masterProjects: list.map((p) =>
              p.id === project.id ? touch({ ...p, ...project, id: project.id }) : p,
            ),
          };
        }
        const created: CrmAccountProject = {
          name: project.name,
          type: project.type,
          city: project.city,
          units: project.units,
          totalTowers: project.totalTowers,
          totalFloors: project.totalFloors,
          status: project.status,
          id: project.id ?? newId(),
          createdAt: now,
          updatedAt: now,
        };
        return { ...r, masterProjects: [created, ...list] };
      }),
    }));
  },

  deleteMasterProject: (companyId, projectId) => {
    get().ensureForCompany(companyId);
    set((s) => ({
      records: updateRecord(s.records, companyId, (r) => ({
        ...r,
        masterProjects: (r.masterProjects ?? []).filter((p) => p.id !== projectId),
      })),
    }));
  },

  upsertMasterDictItem: (companyId, kind, item) => {
    get().ensureForCompany(companyId);
    const key =
      kind === "sources"
        ? "masterSources"
        : kind === "statuses"
          ? "masterStatuses"
          : "masterFollowUps";
    const now = nowIso();
    set((s) => ({
      records: updateRecord(s.records, companyId, (r) => {
        const list = r[key] ?? [];
        if (item.id && list.some((d) => d.id === item.id)) {
          return {
            ...r,
            [key]: list.map((d) =>
              d.id === item.id ? touch({ ...d, ...item, id: item.id }) : d,
            ),
          };
        }
        const created: CrmMasterDictItem = {
          value: item.value,
          active: item.active,
          sortOrder: item.sortOrder ?? list.length + 1,
          id: item.id ?? newId(),
          createdAt: now,
          updatedAt: now,
        };
        return { ...r, [key]: [...list, created] };
      }),
    }));
  },

  deleteMasterDictItem: (companyId, kind, itemId) => {
    get().ensureForCompany(companyId);
    const key =
      kind === "sources"
        ? "masterSources"
        : kind === "statuses"
          ? "masterStatuses"
          : "masterFollowUps";
    set((s) => ({
      records: updateRecord(s.records, companyId, (r) => ({
        ...r,
        [key]: (r[key] ?? []).filter((d) => d.id !== itemId),
      })),
    }));
  },

  upsertMasterTeam: (companyId, team) => {
    get().ensureForCompany(companyId);
    const now = nowIso();
    set((s) => ({
      records: updateRecord(s.records, companyId, (r) => {
        const list = r.masterTeams ?? [];
        if (team.id && list.some((t) => t.id === team.id)) {
          return {
            ...r,
            masterTeams: list.map((t) =>
              t.id === team.id ? touch({ ...t, ...team, id: team.id }) : t,
            ),
          };
        }
        const created: CrmMasterTeam = {
          name: team.name,
          role: team.role,
          memberCount: team.memberCount,
          id: team.id ?? newId(),
          createdAt: now,
          updatedAt: now,
        };
        return { ...r, masterTeams: [created, ...list] };
      }),
    }));
  },

  deleteMasterTeam: (companyId, teamId) => {
    get().ensureForCompany(companyId);
    set((s) => ({
      records: updateRecord(s.records, companyId, (r) => ({
        ...r,
        masterTeams: (r.masterTeams ?? []).filter((t) => t.id !== teamId),
      })),
    }));
  },
  };
});

export type { CrmImplementationStage, CrmTrackerPriority };
