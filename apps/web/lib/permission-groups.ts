import { PERMISSIONS, type Permission } from './permissions';

/**
 * Reusable permission bundles, composed into a small DAG via `extends` — lets a role's default
 * set be expressed as "reviewer's view-only slice, plus X" instead of a hand-duplicated list (the
 * exact drift risk that made the auditor role tedious to keep in sync with reviewer). Resolving a
 * role's full permission set is graph reachability, not a fixed lookup — see resolveGroup below.
 */
interface PermissionGroup {
  id: string;
  permissions: Permission[];
  extends?: string[];
}

const GROUPS: Record<string, PermissionGroup> = {
  base: { id: 'base', permissions: [PERMISSIONS.AUTH_READ, PERMISSIONS.SESSION_LOGOUT] },
  submissions_view: { id: 'submissions_view', permissions: [PERMISSIONS.SUBMISSIONS_LIST, PERMISSIONS.SUBMISSIONS_VIEW] },
  cases_view: { id: 'cases_view', permissions: [PERMISSIONS.MEDICAL_CASES_LIST] },
  patients_view: { id: 'patients_view', permissions: [PERMISSIONS.PATIENT_PROFILES_LIST] },
  staff_directory_view: {
    id: 'staff_directory_view',
    permissions: [
      PERMISSIONS.DOCTORS_LIST,
      PERMISSIONS.DELEGATES_LIST,
      PERMISSIONS.MEDICAL_OFFICES_LIST,
      PERMISSIONS.REVIEWERS_LIST,
      PERMISSIONS.AUDITORS_LIST
    ]
  },
  reports_view: { id: 'reports_view', permissions: [PERMISSIONS.REPORTS_VIEW, PERMISSIONS.AUDIT_LOG_VIEW] },
  reviewer_view: {
    id: 'reviewer_view',
    extends: ['base', 'submissions_view', 'cases_view', 'patients_view', 'staff_directory_view', 'reports_view'],
    permissions: [PERMISSIONS.NOTIFICATIONS_VIEW, PERMISSIONS.MEDICAL_CASES_BILLING_VIEW]
  },
  reviewer_write: {
    id: 'reviewer_write',
    extends: ['reviewer_view'],
    permissions: [
      PERMISSIONS.SUBMISSIONS_REVIEW,
      PERMISSIONS.MEDICAL_CASES_CREATE,
      PERMISSIONS.MEDICAL_CASES_UPDATE,
      PERMISSIONS.MEDICAL_CASES_TRANSITION,
      PERMISSIONS.MEDICAL_CASES_REASSIGN,
      PERMISSIONS.MEDICAL_CASES_HIDE,
      PERMISSIONS.MEDICAL_CASES_ATTACH,
      PERMISSIONS.MEDICAL_CASES_PAYMENT_CONFIRM,
      PERMISSIONS.MEDICAL_CASES_BILLING_UPDATE,
      PERMISSIONS.MEDICAL_CASES_PATIENT_UPDATE,
      PERMISSIONS.PATIENT_PROFILES_CREATE,
      PERMISSIONS.PATIENT_PROFILES_UPDATE,
      PERMISSIONS.PATIENT_PROFILES_RESET_PASSWORD,
      PERMISSIONS.MEDICAL_OFFICES_CREATE,
      PERMISSIONS.NOTIFICATIONS_MANAGE,
      PERMISSIONS.STAFF_ACCOUNTS_MANAGE
    ]
  }
};

/** BFS over the `extends` graph, collecting every group's own permissions into one deduplicated set — the "effective closure" for a group. */
function resolveGroup(id: string): Set<Permission> {
  const result = new Set<Permission>();
  const queue = [id];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);

    const group = GROUPS[current];
    if (!group) continue;
    for (const permission of group.permissions) result.add(permission);
    for (const parent of group.extends ?? []) queue.push(parent);
  }

  return result;
}

/** Default permission sets for "Reset to defaults" (Settings -> Permissions) and this repo's seed migration — reviewer/auditor genuinely share a base (auditor = reviewer_view alone), so the relationship is expressed once here instead of two independently-maintained lists. */
export const DEFAULT_ROLE_PERMISSIONS: Readonly<Record<string, readonly Permission[]>> = Object.freeze({
  reviewer: Object.freeze([...resolveGroup('reviewer_write')]),
  auditor: Object.freeze([...resolveGroup('reviewer_view')]),
  clinician: Object.freeze([
    PERMISSIONS.AUTH_READ,
    PERMISSIONS.SESSION_LOGOUT,
    PERMISSIONS.SUBMISSIONS_LIST,
    PERMISSIONS.SUBMISSIONS_CREATE,
    PERMISSIONS.SUBMISSIONS_VIEW,
    PERMISSIONS.SUBMISSIONS_FOLLOW_UP,
    PERMISSIONS.MEDICAL_CASES_LIST,
    PERMISSIONS.MEDICAL_CASES_UPDATE,
    PERMISSIONS.MEDICAL_CASES_ATTACH,
    PERMISSIONS.MEDICAL_CASES_BILLING_VIEW
  ]),
  /** Deliberately the same as clinician minus MEDICAL_CASES_BILLING_VIEW — see permissions.ts's ROLES.DELEGATE doc comment. */
  delegate: Object.freeze([
    PERMISSIONS.AUTH_READ,
    PERMISSIONS.SESSION_LOGOUT,
    PERMISSIONS.SUBMISSIONS_LIST,
    PERMISSIONS.SUBMISSIONS_CREATE,
    PERMISSIONS.SUBMISSIONS_VIEW,
    PERMISSIONS.SUBMISSIONS_FOLLOW_UP,
    PERMISSIONS.MEDICAL_CASES_LIST,
    PERMISSIONS.MEDICAL_CASES_UPDATE,
    PERMISSIONS.MEDICAL_CASES_ATTACH
  ]),
  patient: Object.freeze([
    PERMISSIONS.AUTH_READ,
    PERMISSIONS.SESSION_LOGOUT,
    PERMISSIONS.MEDICAL_CASES_LIST,
    PERMISSIONS.MEDICAL_CASES_PATIENT_UPDATE,
    PERMISSIONS.PATIENT_PROFILES_LIST,
    PERMISSIONS.PATIENT_PROFILES_UPDATE,
    PERMISSIONS.DOCTORS_LIST
  ])
});
