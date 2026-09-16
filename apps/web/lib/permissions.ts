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
  /** Read-only HR/reviewer tier for auditors — new in this rebuild, no equivalent in the old app: same visibility as a reviewer, none of the write permissions (no review/transition/create). */
  AUDITOR: 'auditor',
  DOCTOR: 'clinician',
  /** An assistant acting on behalf of exactly one doctor (AppUser.delegateForClinicianId) — same permission set as DOCTOR, scoped down to that one doctor's own cases by ownsCase() and the dashboard query, never the doctor's determination/attestation/signature or final submission. */
  DELEGATE: 'delegate',
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
  MEDICAL_CASES_LIST: 'medical_cases:list',
  MEDICAL_CASES_CREATE: 'medical_cases:create',
  MEDICAL_CASES_UPDATE: 'medical_cases:update',
  /** Deliberately separate from MEDICAL_CASES_UPDATE (which doctors also hold) — adjusting the billed amount on a case is admin/reviewer-only, not something a doctor can do. */
  MEDICAL_CASES_BILLING_UPDATE: 'medical_cases:billing_update',
  /** Marking a case as paid (the review queue's own exit condition) — deliberately separate from MEDICAL_CASES_BILLING_UPDATE: confirming payment is routine HR-reviewer work, not the same as adjusting the billed amount itself (though both are now held by the same roles). */
  MEDICAL_CASES_PAYMENT_CONFIRM: 'medical_cases:payment_confirm',
  /** Seeing the payable amount on a case at all (case-detail-container.tsx's read-only display) — previously unconditional for anyone who could view the case; introduced specifically so a delegate's visibility into their doctor's billing can be toggled per-account via permissionOverrides, without changing what admin/reviewer/auditor/doctor could already see. */
  MEDICAL_CASES_BILLING_VIEW: 'medical_cases:billing_view',
  /** Send a case forward/back a stage through the guided "Case actions" menu — see features/cases/case-transitions.ts. Not yet granted to DOCTOR (see that role's comment below) even though the state machine already supports a doctor-role caller correctly restricted to just "send back to patient". */
  MEDICAL_CASES_TRANSITION: 'medical_cases:transition',
  /** Change which doctor a case is assigned to without moving its stage — only meaningful while status === 'sent_to_doctor'. */
  MEDICAL_CASES_REASSIGN: 'medical_cases:reassign',
  /** Toggle a case out of the doctor/patient queues without canceling it — a visibility flag, not a stage transition (see case-transitions.ts's separate 'cancel' action for actually ending a case). */
  MEDICAL_CASES_HIDE: 'medical_cases:hide',
  MEDICAL_CASES_PATIENT_UPDATE: 'medical_cases:patient_update',
  MEDICAL_CASES_ATTACH: 'medical_cases:attach',
  PATIENT_PROFILES_LIST: 'patient_profiles:list',
  PATIENT_PROFILES_CREATE: 'patient_profiles:create',
  PATIENT_PROFILES_UPDATE: 'patient_profiles:update',
  /** Staff-only: trigger a password-reset code for a candidate's portal account. Deliberately separate from PATIENT_PROFILES_UPDATE (which PATIENT also holds, for editing their own record) — a patient must never be able to reach this action, even against their own account (self-service goes through the normal change-password flow instead). */
  PATIENT_PROFILES_RESET_PASSWORD: 'patient_profiles:reset_password',
  DOCTORS_LIST: 'doctors:list',
  DELEGATES_LIST: 'delegates:list',
  MEDICAL_OFFICES_LIST: 'medical_offices:list',
  MEDICAL_OFFICES_CREATE: 'medical_offices:create',
  REVIEWERS_LIST: 'reviewers:list',
  AUDITORS_LIST: 'auditors:list',
  REPORTS_VIEW: 'reports:view',
  /** Resending a failed message, on top of everything NOTIFICATIONS_VIEW already grants — see canViewMessageCentre below for why viewing the Message Centre isn't gated on this alone. */
  NOTIFICATIONS_MANAGE: 'notifications:manage',
  /** Read-only Message Centre access — viewing the message list and an individual message's rendered content, but not resending one. Held by AUDITOR; REVIEWER/ADMIN get the same visibility as a side effect of NOTIFICATIONS_MANAGE (see canViewMessageCentre). */
  NOTIFICATIONS_VIEW: 'notifications:view',
  SETTINGS_MANAGE: 'settings:manage',
  /** Full account-management authority: create/edit/deactivate/delete an account of *any* role, admin included. Held only by ADMIN — see canManageUserAccount below for the narrower, reviewer-held equivalent that excludes admin accounts. */
  USERS_MANAGE: 'users:manage',
  /**
   * The same account-management actions as USERS_MANAGE, but never against an admin account —
   * held by REVIEWER (see ROLE_PERMISSIONS) so reviewers can fully manage doctor/reviewer/auditor
   * accounts without being able to touch admins. Replaces the old per-role DOCTORS_CREATE/
   * REVIEWERS_CREATE/AUDITORS_CREATE permissions, which were defined but never actually checked
   * anywhere — every create/update/delete/set-active action gated on USERS_MANAGE alone. Every
   * caller should go through canManageUserAccount()/requireCanManageUserAccount() below rather
   * than checking this (or USERS_MANAGE) directly, so the "except admins" carve-out lives in one
   * place instead of being re-implemented at each call site.
   */
  STAFF_ACCOUNTS_MANAGE: 'staff_accounts:manage',
  AUDIT_LOG_VIEW: 'audit_log:view',
  /** Editing role->permission grants and per-user overrides (Settings -> Permissions) — admin only, and deliberately not itself grantable via the system it controls (see getEffectivePermissions: 'admin' never reads from the DB at all). */
  ROLES_MANAGE: 'roles:manage'
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
    PERMISSIONS.MEDICAL_CASES_LIST,
    PERMISSIONS.MEDICAL_CASES_CREATE,
    PERMISSIONS.MEDICAL_CASES_UPDATE,
    PERMISSIONS.MEDICAL_CASES_TRANSITION,
    PERMISSIONS.MEDICAL_CASES_REASSIGN,
    PERMISSIONS.MEDICAL_CASES_HIDE,
    PERMISSIONS.MEDICAL_CASES_ATTACH,
    PERMISSIONS.MEDICAL_CASES_PAYMENT_CONFIRM,
    PERMISSIONS.MEDICAL_CASES_BILLING_UPDATE,
    PERMISSIONS.MEDICAL_CASES_BILLING_VIEW,
    PERMISSIONS.MEDICAL_CASES_PATIENT_UPDATE,
    PERMISSIONS.PATIENT_PROFILES_LIST,
    PERMISSIONS.PATIENT_PROFILES_CREATE,
    PERMISSIONS.PATIENT_PROFILES_UPDATE,
    PERMISSIONS.PATIENT_PROFILES_RESET_PASSWORD,
    PERMISSIONS.DOCTORS_LIST,
    PERMISSIONS.DELEGATES_LIST,
    PERMISSIONS.MEDICAL_OFFICES_LIST,
    PERMISSIONS.MEDICAL_OFFICES_CREATE,
    PERMISSIONS.REVIEWERS_LIST,
    PERMISSIONS.AUDITORS_LIST,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.NOTIFICATIONS_MANAGE,
    PERMISSIONS.STAFF_ACCOUNTS_MANAGE,
    PERMISSIONS.AUDIT_LOG_VIEW
  ]),
  /**
   * Read-only mirror of REVIEWER's own visibility — every permission here is a "list"/"view" one
   * (see canManageUserAccount and canViewMessageCentre, neither of which this role ever satisfies)
   * so an auditor can see everything a reviewer can see without being able to create, edit,
   * transition, or delete anything.
   */
  [ROLES.AUDITOR]: Object.freeze([
    PERMISSIONS.AUTH_READ,
    PERMISSIONS.SESSION_LOGOUT,
    PERMISSIONS.SUBMISSIONS_LIST,
    PERMISSIONS.SUBMISSIONS_VIEW,
    PERMISSIONS.MEDICAL_CASES_LIST,
    PERMISSIONS.PATIENT_PROFILES_LIST,
    PERMISSIONS.DOCTORS_LIST,
    PERMISSIONS.DELEGATES_LIST,
    PERMISSIONS.MEDICAL_OFFICES_LIST,
    PERMISSIONS.REVIEWERS_LIST,
    PERMISSIONS.AUDITORS_LIST,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.NOTIFICATIONS_VIEW,
    PERMISSIONS.AUDIT_LOG_VIEW,
    PERMISSIONS.MEDICAL_CASES_BILLING_VIEW
  ]),
  /**
   * Shared by DOCTOR and DELEGATE below — a delegate is scoped down to exactly one doctor's own
   * cases (see ownsCase() and the delegate dashboard query), never given a wider set of actions
   * than the doctor themselves. MEDICAL_CASES_BILLING_VIEW is deliberately NOT in this shared
   * list — it's the one thing that differs between the two roles, added to DOCTOR's own array
   * below and left as an opt-in per-delegate override instead (see permissionOverrides).
   */
  [ROLES.DOCTOR]: Object.freeze([
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
    // Deliberately no PATIENT_PROFILES_LIST/UPDATE — a doctor sees a patient's
    // details only through a case actually assigned to them (case-detail-
    // container.tsx), never the full candidate roster or another patient's
    // profile. Holding PATIENT_PROFILES_LIST used to let a clinician load
    // every candidate in the system via /candidates and /candidates/[id],
    // including ones with no case assigned to that doctor at all.
    //
    // Also deliberately no MEDICAL_CASES_TRANSITION yet — the feature is
    // built to let a doctor send a case back to the patient (nothing else;
    // features/cases/case-transitions.ts restricts a 'clinician' caller to
    // just that one edge regardless of what's granted here), but it's kept
    // off for doctors for now. Turning it on later is just adding the
    // permission to this array — no other code changes needed.
  ]),
  /**
   * An assistant acting on behalf of exactly one doctor — same action set as DOCTOR (data entry,
   * attachments, follow-up), minus MEDICAL_CASES_BILLING_VIEW by default (grantable per-account via
   * permissionOverrides, see update-user-permission-overrides.ts). The determination/attestation
   * lock and the final-submit block are NOT permission-based — they're enforced by role checks in
   * the doctor case-entry form and create-submission.ts, since a delegate otherwise needs the exact
   * same MEDICAL_CASES_UPDATE/SUBMISSIONS_CREATE actions a doctor uses just to save a draft.
   */
  [ROLES.DELEGATE]: Object.freeze([
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

/** The hardcoded fallback used only when a caller hasn't gone through getEffectivePermissions (below) — e.g. a bare `{ role }` object in a unit test. Every real request's session.user carries a resolved `permissions` array instead (see lib/session.ts), which hasPermission prefers when present. */
export function permissionsForRole(role: string | undefined | null): readonly Permission[] {
  return ROLE_PERMISSIONS[role as Role] || [];
}

export function hasPermission(
  user: { role?: string; permissions?: readonly string[] } | null | undefined,
  permission: Permission
): boolean {
  if (user?.permissions) return user.permissions.includes(permission);
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

/**
 * The single policy decision behind every account-management action (create/update/delete/set-
 * active — see features/users/actions) — whether `actor` may act on an account whose role is (or
 * would become) `targetRole`. USERS_MANAGE (admin) can manage anyone, including other admins.
 * STAFF_ACCOUNTS_MANAGE (also held by reviewers) grants the exact same actions, just narrowed to
 * never apply when `targetRole` is admin — so a reviewer has full parity with an admin for
 * managing doctor/reviewer/auditor accounts, without a second, independently-maintained
 * permission list to keep in sync. Every call site should go through this (or
 * requireCanManageUserAccount) rather than checking USERS_MANAGE/STAFF_ACCOUNTS_MANAGE directly,
 * so the "except admins" carve-out is expressed exactly once.
 */
export function canManageUserAccount(actor: { role?: string } | null | undefined, targetRole: string): boolean {
  if (hasPermission(actor, PERMISSIONS.USERS_MANAGE)) return true;
  return targetRole !== ROLES.ADMIN && hasPermission(actor, PERMISSIONS.STAFF_ACCOUNTS_MANAGE);
}

export function requireCanManageUserAccount(actor: { role?: string } | null | undefined, targetRole: string): void {
  if (!canManageUserAccount(actor, targetRole)) {
    throw new ForbiddenError();
  }
}

/**
 * Never assignable through the role-permission matrix or a per-user override, at the schema
 * level, not just hidden in the UI — granting any of these to a non-admin role would bypass the
 * whole admin/reviewer boundary this app carefully builds elsewhere: USERS_MANAGE lets its holder
 * manage admin accounts (the entire reason canManageUserAccount/STAFF_ACCOUNTS_MANAGE exist),
 * SETTINGS_MANAGE opens every Settings tab including Mail/SMTP credentials, and ROLES_MANAGE would
 * let its holder edit the permission system itself. All three stay hardcoded to 'admin' only.
 */
const NON_ASSIGNABLE_PERMISSIONS = new Set<string>([PERMISSIONS.ROLES_MANAGE, PERMISSIONS.USERS_MANAGE, PERMISSIONS.SETTINGS_MANAGE]);

/** Every permission a non-admin role or per-user override could ever legitimately hold — see updateRolePermissionsAction/updateUserPermissionOverridesAction, which validate against exactly this set, not the full PERMISSIONS catalog. */
export const ASSIGNABLE_PERMISSIONS: readonly Permission[] = Object.values(PERMISSIONS).filter(
  (permission) => !NON_ASSIGNABLE_PERMISSIONS.has(permission)
);

export interface PermissionOption {
  key: string;
  label: string;
  /** The part before ':' in the permission key (e.g. "medical_cases") — purely for grouping a checkbox grid into readable sections. */
  group: string;
}

/** Every permission worth showing in the Settings -> Permissions matrix and a user's "Extra permissions" checklist — ASSIGNABLE_PERMISSIONS minus AUTH_READ/SESSION_LOGOUT (every role needs those just to function; toggling them off would just break sign-in for that role, not a meaningful customization). */
export function permissionCatalog(): PermissionOption[] {
  return ASSIGNABLE_PERMISSIONS.filter((key) => key !== PERMISSIONS.AUTH_READ && key !== PERMISSIONS.SESSION_LOGOUT)
    .map((key) => {
      const [group, action] = key.split(':');
      return { key, group: group ?? key, label: (action ?? key).replace(/_/g, ' ') };
    });
}

/**
 * Whether `actor` may view the Message Centre (the list and an individual message's detail) —
 * NOTIFICATIONS_MANAGE (admin/reviewer) implies this since it already grants strictly more
 * (resending too), and NOTIFICATIONS_VIEW (also held by auditor) grants just the read side. Same
 * "inherits with the write half carved out" shape as canManageUserAccount above: one function
 * instead of every call site independently OR-ing the two permissions together. Resending itself
 * stays gated on NOTIFICATIONS_MANAGE alone (see features/messages/actions/resend-message.ts) —
 * this function is only ever the right check for *viewing*.
 */
export function canViewMessageCentre(actor: { role?: string } | null | undefined): boolean {
  return hasPermission(actor, PERMISSIONS.NOTIFICATIONS_MANAGE) || hasPermission(actor, PERMISSIONS.NOTIFICATIONS_VIEW);
}

// getEffectivePermissions/invalidateRolePermissionsCache live in ./effective-permissions, not
// here — that module imports @ncb/database, which this one must never do (nav-config.ts pulls
// PERMISSIONS/ROLES into client components; a bundler would otherwise try to ship the
// Prisma-generated client, which needs Node's `fs`, into the browser).
