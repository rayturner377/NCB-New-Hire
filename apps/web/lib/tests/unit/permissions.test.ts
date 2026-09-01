import { describe, expect, it } from 'vitest';
import {
  ForbiddenError,
  PERMISSIONS,
  ROLES,
  hasPermission,
  permissionsForRole,
  requirePermission
} from '../../permissions';

describe('permissions', () => {
  it('admin has every permission', () => {
    const adminPermissions = permissionsForRole(ROLES.ADMIN);
    expect(adminPermissions).toEqual(expect.arrayContaining(Object.values(PERMISSIONS)));
  });

  it('doctors cannot manage users or settings', () => {
    expect(hasPermission({ role: ROLES.DOCTOR }, PERMISSIONS.USERS_MANAGE)).toBe(false);
    expect(hasPermission({ role: ROLES.DOCTOR }, PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
  });

  it('doctors can create and view their own submissions', () => {
    expect(hasPermission({ role: ROLES.DOCTOR }, PERMISSIONS.SUBMISSIONS_CREATE)).toBe(true);
    expect(hasPermission({ role: ROLES.DOCTOR }, PERMISSIONS.SUBMISSIONS_VIEW)).toBe(true);
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
