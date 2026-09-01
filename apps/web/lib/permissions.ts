/**
 * Ported verbatim from server.js (~L205-260, ~L4846-4859: ROLES, PERMISSIONS,
 * ROLE_PERMISSIONS, permissionsForRole/hasPermission/requirePermission).
 * Enforcement moves from the old per-route-string `permissionForApiRequest`
 * table to a per-Server-Action/Route-Handler `requirePermission(user, ...)`
 * call at the top of each one.
 */

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  REVIEWER: 'reviewer',
  DOCTOR: 'clinician',
  PATIENT: 'patient'
} as const);

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const PERMISSIONS = Object.freeze({
  AUTH_READ: 'auth:read',
  SESSION_LOGOUT: 'session:logout',
  SUBMISSIONS_LIST: 'submissions:list',
  SUBMISSIONS_CREATE: 'submissions:create',
  SUBMISSIONS_VIEW: 'submissions:view',
  SUBMISSIONS_FOLLOW_UP: 'submissions:follow_up',
  SUBMISSIONS_REVIEW: 'submissions:review',
  SUBMISSIONS_DOWNLOAD: 'submissions:download',
  MEDICAL_CASES_LIST: 'medical_cases:list',
  MEDICAL_CASES_CREATE: 'medical_cases:create',
  MEDICAL_CASES_UPDATE: 'medical_cases:update',
  MEDICAL_CASES_PATIENT_UPDATE: 'medical_cases:patient_update',
  MEDICAL_CASES_ATTACH: 'medical_cases:attach',
  PATIENT_PROFILES_LIST: 'patient_profiles:list',
  PATIENT_PROFILES_CREATE: 'patient_profiles:create',
  PATIENT_PROFILES_UPDATE: 'patient_profiles:update',
  DOCTORS_LIST: 'doctors:list',
  DOCTORS_CREATE: 'doctors:create',
  REVIEWERS_LIST: 'reviewers:list',
  REVIEWERS_CREATE: 'reviewers:create',
  REPORTS_VIEW: 'reports:view',
  NOTIFICATIONS_MANAGE: 'notifications:manage',
  SETTINGS_MANAGE: 'settings:manage',
  USERS_MANAGE: 'users:manage'
} as const);

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = Object.freeze({
  [ROLES.ADMIN]: Object.freeze(Object.values(PERMISSIONS)),
  [ROLES.REVIEWER]: Object.freeze([
    PERMISSIONS.AUTH_READ,
    PERMISSIONS.SESSION_LOGOUT,
    PERMISSIONS.SUBMISSIONS_LIST,
    PERMISSIONS.SUBMISSIONS_VIEW,
    PERMISSIONS.SUBMISSIONS_REVIEW,
    PERMISSIONS.SUBMISSIONS_DOWNLOAD,
    PERMISSIONS.MEDICAL_CASES_LIST,
    PERMISSIONS.MEDICAL_CASES_CREATE,
    PERMISSIONS.MEDICAL_CASES_UPDATE,
    PERMISSIONS.MEDICAL_CASES_ATTACH,
    PERMISSIONS.MEDICAL_CASES_PATIENT_UPDATE,
    PERMISSIONS.PATIENT_PROFILES_LIST,
    PERMISSIONS.PATIENT_PROFILES_CREATE,
    PERMISSIONS.PATIENT_PROFILES_UPDATE,
    PERMISSIONS.DOCTORS_LIST,
    PERMISSIONS.DOCTORS_CREATE,
    PERMISSIONS.REVIEWERS_LIST,
    PERMISSIONS.REVIEWERS_CREATE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.NOTIFICATIONS_MANAGE
  ]),
  [ROLES.DOCTOR]: Object.freeze([
    PERMISSIONS.AUTH_READ,
    PERMISSIONS.SESSION_LOGOUT,
    PERMISSIONS.SUBMISSIONS_LIST,
    PERMISSIONS.SUBMISSIONS_CREATE,
    PERMISSIONS.SUBMISSIONS_VIEW,
    PERMISSIONS.SUBMISSIONS_FOLLOW_UP,
    PERMISSIONS.SUBMISSIONS_DOWNLOAD,
    PERMISSIONS.MEDICAL_CASES_LIST,
    PERMISSIONS.MEDICAL_CASES_UPDATE,
    PERMISSIONS.MEDICAL_CASES_ATTACH,
    PERMISSIONS.PATIENT_PROFILES_LIST,
    PERMISSIONS.PATIENT_PROFILES_UPDATE
  ]),
  [ROLES.PATIENT]: Object.freeze([
    PERMISSIONS.AUTH_READ,
    PERMISSIONS.SESSION_LOGOUT,
    PERMISSIONS.MEDICAL_CASES_LIST,
    PERMISSIONS.MEDICAL_CASES_PATIENT_UPDATE,
    PERMISSIONS.PATIENT_PROFILES_LIST,
    PERMISSIONS.PATIENT_PROFILES_UPDATE,
    PERMISSIONS.DOCTORS_LIST
  ])
});

export function permissionsForRole(role: string | undefined | null): readonly Permission[] {
  return ROLE_PERMISSIONS[role as Role] || [];
}

export function hasPermission(user: { role?: string } | null | undefined, permission: Permission): boolean {
  return permissionsForRole(user?.role).includes(permission);
}

export class ForbiddenError extends Error {
  constructor(message = 'Your account does not have permission to perform this action.') {
    super(message);
  }
}

export function requirePermission(
  user: { role?: string } | null | undefined,
  permission: Permission
): void {
  if (!hasPermission(user, permission)) {
    throw new ForbiddenError();
  }
}
