export {
  authMe,
  authLogin,
  authRegister,
  authLogout,
  authChangePassword,
  authUpdateProfile,
} from "@/server/api/auth";

export {
  listCompanies,
  getCompany,
  createCompany,
  updateCompany,
  deleteCompany,
  renewCompany,
} from "@/server/api/companies";

export {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  goLiveProject,
  getProjectProgress,
  upsertProjectProgress,
  listAllProgress,
} from "@/server/api/projects";

export {
  listChecklist,
  setChecklistState,
  toggleChecklist,
  completeProjectChecklist,
  setChecklistNotApplicable,
  updateChecklistRemarks,
  updateChecklistAssignment,
  setDocumentRequired,
  listOtherCharges,
  addOtherCharge,
  updateOtherCharge,
  deleteOtherCharge,
  listUploads,
  simulateUpload,
  listAllChecklist,
  listAllOtherCharges,
  listAllUploads,
  listAllCustomerAppConfigs,
  upsertCustomerAppConfig,
} from "@/server/api/onboarding";

export {
  listPostSalesProjects,
  getPostSalesProject,
  createPostSalesProject,
  updatePostSalesStep,
  deletePostSalesProject,
} from "@/server/api/post-sales";

export {
  listActivity,
  listNotes,
  addNote,
  updateNote,
  deleteNote,
  listAttachments,
  deleteAttachment,
  listAllNotes,
  listAllAttachments,
} from "@/server/api/notes";

export {
  listUsers,
  createUser,
  updateUser,
  setUserPassword,
  deleteUser,
  listEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "@/server/api/users";

export {
  listTickets,
  getTicket,
  listTicketActivities,
  createTicket,
  updateTicket,
  deleteTicket,
  listTraining,
  createTraining,
  updateTraining,
  deleteTraining,
  getVendorBundle,
  mutateVendorEntity,
  getLaborBundle,
  mutateLabor,
  listDocuments,
  mutateDocument,
  getIntegrationsBundle,
  mutateIntegration,
  getAppConfig,
  setAppConfig,
  getDashboardKpis,
} from "@/server/api/ops";

export {
  listNotifications,
  createNotification,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/server/api/notifications";

export {
  listModuleSubscriptions,
  listModuleSubscriptionEvents,
  upsertModuleSubscription,
  listFollowUpTasks,
  syncFollowUpTaskStatuses,
  getFollowUpTask,
  createFollowUpTask,
  updateFollowUpTask,
  cancelFollowUpTask,
  completeFollowUpTask,
  deleteFollowUpTask,
  checkTaskScheduleConflicts,
  listClientVisits,
  getClientVisit,
  createClientVisit,
  updateClientVisit,
  listCrmEvents,
  getCrmDashboardSummary,
} from "@/server/api/crm";

export {
  listErpFollowUpTasks,
  syncErpFollowUpTaskStatuses,
  createErpFollowUpTask,
  updateErpFollowUpTask,
  cancelErpFollowUpTask,
  completeErpFollowUpTask,
  deleteErpFollowUpTask,
  checkErpTaskScheduleConflicts,
} from "@/server/api/erp-tasks";

export {
  listCrmAccounts,
  upsertCrmAccount,
  upsertCrmAccountsBatch,
  deleteCrmAccount,
} from "@/server/api/crm-accounts";

export {
  listCrmOnboardingRecords,
  upsertCrmOnboardingRecord,
  deleteCrmOnboardingRecord,
} from "@/server/api/crm-onboarding";

export {
  getPortalBySlug,
  listCompanyPortalAccess,
  ensureCompanyPortals,
  upsertCompanyPortalAccess,
  regenerateCompanyPortalSlug,
  setCompanyPortalActive,
  updateCompanyPortalContact,
} from "@/server/api/portal";

export {
  listDesignTickets,
  getDesignTicket,
  createDesignTicket,
  addDesignTicketMessage,
  updateDesignTicketStatus,
  updateDesignTicketPriority,
  assignDesignTicket,
  deleteDesignTicket,
  listPortalDesignTickets,
  getPortalDesignTicket,
  createPortalDesignTicket,
  addPortalDesignTicketMessage,
} from "@/server/api/design-tickets";

export {
  listChatSessions,
  syncChatSession,
  listPortalChatSessions,
  getPortalChatSession,
  createPortalChatSession,
  syncPortalChatSession,
} from "@/server/api/chat";

export {
  listPortalBookingEventTypes,
  listPortalBookingSlots,
  listPortalBookings,
  createPortalBooking,
  createCrmBooking,
  ensureBookingDefaults,
  ensureBookingDefaultsBatch,
  listBookingEventTypes,
  listBookingAppointments,
  listBookingAvailability,
  listBookingBlocks,
  listStaffBookingSlots,
  upsertBookingAvailability,
  replaceBookingAvailability,
  deleteBookingAvailability,
  createBookingBlock,
  deleteBookingBlock,
  updateBookingAppointmentStatus,
  rescheduleBookingAppointment,
  retryBookingGoogleCalendarSync,
  getBookingSummaryForCompany,
} from "@/server/api/bookings";

export {
  getWebPushConfig,
  getWebPushSubscriptionStatus,
  getWebPushDiagnostics,
  sendTestWebPush,
  runWebPushRemindersNow,
  subscribeWebPush,
  unsubscribeWebPush,
} from "@/server/api/push";

export {
  getGoogleCalendarConnectionStatus,
  getGoogleCalendarAuthUrl,
  disconnectGoogleCalendarConnection,
  setGoogleCalendarBusySync,
} from "@/server/api/google-calendar";
