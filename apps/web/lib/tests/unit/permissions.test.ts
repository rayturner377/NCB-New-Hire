import { describe, expect, it } from 'vitest';
import {
  ASSIGNABLE_PERMISSIONS,
  ForbiddenError,
  PERMISSIONS,
  ROLES,
  canManageUserAccount,
  canViewMessageCentre,
  hasPermission,
  permissionCatalog,
  permissionsForRole,
  requireCanManageUserAccount,
  requirePermission
} from '../../permissions';

describe('permissions', () => {
  it('admin has every permission', () => {
    const adminPermissions = permissionsForRole(ROLES.ADMIN);
    expect(adminPermissions).toEqual(expect.arrayContaining(Object.values(PERMISSIONS)));
  });

  it('hasPermission prefers a resolved permissions array over the static role fallback', () => {
    // A doctor by static role, but the embedded array (as session.user would actually carry —
    // see lib/session.ts) says otherwise: the embedded list wins either way.
    expect(hasPermission({ role: ROLES.DOCTOR, permissions: [PERMISSIONS.SETTINGS_MANAGE] }, PERMISSIONS.SETTINGS_MANAGE)).toBe(true);
    expect(hasPermission({ role: ROLES.ADMIN, permissions: [] }, PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
  });

  it('ROLES_MANAGE is admin-only, like the other *_MANAGE permissions', () => {
    expect(hasPermission({ role: ROLES.ADMIN }, PERMISSIONS.ROLES_MANAGE)).toBe(true);
    expect(hasPermission({ role: ROLES.REVIEWER }, PERMISSIONS.ROLES_MANAGE)).toBe(false);
  });

  it('ASSIGNABLE_PERMISSIONS excludes the permissions that would bypass the admin/reviewer boundary if granted to a non-admin role', () => {
    expect(ASSIGNABLE_PERMISSIONS).not.toContain(PERMISSIONS.USERS_MANAGE);
    expect(ASSIGNABLE_PERMISSIONS).not.toContain(PERMISSIONS.SETTINGS_MANAGE);
    expect(ASSIGNABLE_PERMISSIONS).not.toContain(PERMISSIONS.ROLES_MANAGE);
    // Still a legitimate, safely-scoped grant — canManageUserAccount already prevents any holder from touching admin accounts.
    expect(ASSIGNABLE_PERMISSIONS).toContain(PERMISSIONS.STAFF_ACCOUNTS_MANAGE);
  });

  it('permissionCatalog additionally excludes AUTH_READ/SESSION_LOGOUT — not meaningful to toggle off', () => {
    const keys = permissionCatalog().map((option) => option.key);
    expect(keys).not.toContain(PERMISSIONS.AUTH_READ);
    expect(keys).not.toContain(PERMISSIONS.SESSION_LOGOUT);
    expect(keys).not.toContain(PERMISSIONS.USERS_MANAGE);
  });

  it('doctors cannot manage users or settings', () => {
    expect(hasPermission({ role: ROLES.DOCTOR }, PERMISSIONS.USERS_MANAGE)).toBe(false);
    expect(hasPermission({ role: ROLES.DOCTOR }, PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
  });

  it('doctors can create and view their own submissions', () => {
    expect(hasPermission({ role: ROLES.DOCTOR }, PERMISSIONS.SUBMISSIONS_CREATE)).toBe(true);
    expect(hasPermission({ role: ROLES.DOCTOR }, PERMISSIONS.SUBMISSIONS_VIEW)).toBe(true);
  });

  it('doctors cannot browse or edit the candidate roster — only through a case actually assigned to them', () => {
    expect(hasPermission({ role: ROLES.DOCTOR }, PERMISSIONS.PATIENT_PROFILES_LIST)).toBe(false);
    expect(hasPermission({ role: ROLES.DOCTOR }, PERMISSIONS.PATIENT_PROFILES_UPDATE)).toBe(false);
  });

  it('reviewers (not doctors) can hide a case from the doctor/patient queues', () => {
    expect(hasPermission({ role: ROLES.REVIEWER }, PERMISSIONS.MEDICAL_CASES_HIDE)).toBe(true);
    expect(hasPermission({ role: ROLES.DOCTOR }, PERMISSIONS.MEDICAL_CASES_HIDE)).toBe(false);
  });

  it('an unrecognized or missing role has no permissions', () => {
    expect(permissionsForRole('not-a-real-role')).toEqual([]);
    expect(permissionsForRole(undefined)).toEqual([]);
    expect(permissionsForRole(null)).toEqual([]);
  });

  it('requirePermission throws ForbiddenError when the role lacks the permission', () => {
    expect(() => requirePermission({ role: ROLES.DOCTOR }, PERMISSIONS.USERS_MANAGE)).toThrow(
      ForbiddenError
    );
  });

  it('requirePermission does not throw when the role has the permission', () => {
    expect(() => requirePermission({ role: ROLES.ADMIN }, PERMISSIONS.USERS_MANAGE)).not.toThrow();
  });
});

describe('canManageUserAccount', () => {
  it('admin (USERS_MANAGE) can manage an account of any role, admins included', () => {
    for (const targetRole of [ROLES.ADMIN, ROLES.REVIEWER, ROLES.AUDITOR, ROLES.DOCTOR]) {
      expect(canManageUserAccount({ role: ROLES.ADMIN }, targetRole)).toBe(true);
    }
  });

  it('reviewer (STAFF_ACCOUNTS_MANAGE) can manage doctor/reviewer/auditor accounts', () => {
    for (const targetRole of [ROLES.REVIEWER, ROLES.AUDITOR, ROLES.DOCTOR]) {
      expect(canManageUserAccount({ role: ROLES.REVIEWER }, targetRole)).toBe(true);
    }
  });

  it('reviewer cannot manage — or promote someone to — an admin account', () => {
    expect(canManageUserAccount({ role: ROLES.REVIEWER }, ROLES.ADMIN)).toBe(false);
  });

  it('a role with neither permission cannot manage any account', () => {
    for (const targetRole of [ROLES.ADMIN, ROLES.REVIEWER, ROLES.AUDITOR, ROLES.DOCTOR]) {
      expect(canManageUserAccount({ role: ROLES.DOCTOR }, targetRole)).toBe(false);
      expect(canManageUserAccount({ role: ROLES.AUDITOR }, targetRole)).toBe(false);
    }
  });

  it('requireCanManageUserAccount throws ForbiddenError exactly where canManageUserAccount is false', () => {
    expect(() => requireCanManageUserAccount({ role: ROLES.REVIEWER }, ROLES.ADMIN)).toThrow(ForbiddenError);
    expect(() => requireCanManageUserAccount({ role: ROLES.REVIEWER }, ROLES.DOCTOR)).not.toThrow();
  });
});

describe('canViewMessageCentre', () => {
  it('admin/reviewer (NOTIFICATIONS_MANAGE) can view it', () => {
    expect(canViewMessageCentre({ role: ROLES.ADMIN })).toBe(true);
    expect(canViewMessageCentre({ role: ROLES.REVIEWER })).toBe(true);
  });

  it('auditor (NOTIFICATIONS_VIEW) can view it too, despite not holding NOTIFICATIONS_MANAGE', () => {
    expect(hasPermission({ role: ROLES.AUDITOR }, PERMISSIONS.NOTIFICATIONS_MANAGE)).toBe(false);
    expect(canViewMessageCentre({ role: ROLES.AUDITOR })).toBe(true);
  });

  it('a role with neither permission cannot view it', () => {
    expect(canViewMessageCentre({ role: ROLES.DOCTOR })).toBe(false);
  });
});

describe('the auditor role', () => {
  it('mirrors every list/view permission a reviewer holds, minus every write permission', () => {
    const WRITE_PERMISSIONS = new Set([
      PERMISSIONS.SUBMISSIONS_REVIEW,
      PERMISSIONS.MEDICAL_CASES_CREATE,
      PERMISSIONS.MEDICAL_CASES_UPDATE,
      PERMISSIONS.MEDICAL_CASES_BILLING_UPDATE,
      PERMISSIONS.MEDICAL_CASES_PAYMENT_CONFIRM,
      PERMISSIONS.MEDICAL_CASES_TRANSITION,
      PERMISSIONS.MEDICAL_CASES_REASSIGN,
      PERMISSIONS.MEDICAL_CASES_HIDE,
      PERMISSIONS.MEDICAL_CASES_ATTACH,
      PERMISSIONS.MEDICAL_CASES_PATIENT_UPDATE,
      PERMISSIONS.PATIENT_PROFILES_CREATE,
      PERMISSIONS.PATIENT_PROFILES_UPDATE,
      PERMISSIONS.PATIENT_PROFILES_RESET_PASSWORD,
      PERMISSIONS.MEDICAL_OFFICES_CREATE,
      PERMISSIONS.STAFF_ACCOUNTS_MANAGE,
      // The reviewer-held bundle that also grants resending — auditor gets the read-only
      // NOTIFICATIONS_VIEW equivalent instead (see canViewMessageCentre).
      PERMISSIONS.NOTIFICATIONS_MANAGE
    ]);

    const reviewerViewPermissions = permissionsForRole(ROLES.REVIEWER).filter((permission) => !WRITE_PERMISSIONS.has(permission));
    const auditorPermissions = permissionsForRole(ROLES.AUDITOR);

    for (const permission of reviewerViewPermissions) {
      expect(auditorPermissions).toContain(permission);
    }
    // And the auditor holds nothing beyond that read-only mirror plus its own NOTIFICATIONS_VIEW.
    expect(new Set(auditorPermissions)).toEqual(new Set([...reviewerViewPermissions, PERMISSIONS.NOTIFICATIONS_VIEW]));
  });

  it('cannot manage any account, resend a message, or touch a case beyond listing it', () => {
    expect(canManageUserAccount({ role: ROLES.AUDITOR }, ROLES.DOCTOR)).toBe(false);
    expect(hasPermission({ role: ROLES.AUDITOR }, PERMISSIONS.NOTIFICATIONS_MANAGE)).toBe(false);
    expect(hasPermission({ role: ROLES.AUDITOR }, PERMISSIONS.MEDICAL_CASES_UPDATE)).toBe(false);
  });
});
