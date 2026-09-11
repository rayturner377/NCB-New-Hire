/** Where each role's dedicated list page lives — see nav-config.ts. Shared by create-user.ts (post-creation redirect) and reviewer-dashboard-service.ts (Recent updates row links). */
export const LIST_PATH_BY_ROLE: Record<string, string> = {
  clinician: '/doctors',
  reviewer: '/reviewers',
  auditor: '/auditors',
  admin: '/admins'
};
