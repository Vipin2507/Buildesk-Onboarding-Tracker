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
  toggleChecklist,
  completeProjectChecklist,
  setChecklistNotApplicable,
  updateChecklistRemarks,
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
  deleteUser,
  listEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "@/server/api/users";

export {
  listTickets,
  getTicket,
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
