import { beforeEach, describe, expect, it, vi } from 'vitest';

const listAllMock = vi.fn();

vi.mock('@ncb/database', () => ({
  rolePermissionsRepository: { listAll: (...args: unknown[]) => listAllMock(...args) }
}));

const { getEffectivePermissions, invalidateRolePermissionsCache } = await import('../../effective-permissions');
const { PERMISSIONS, ROLES } = await import('../../permissions');

describe('getEffectivePermissions', () => {
  beforeEach(() => {
    listAllMock.mockReset();
    invalidateRolePermissionsCache();
  });

  it('admin always holds every permission, never touching the database', async () => {
    const permissions = await getEffectivePermissions({ role: ROLES.ADMIN });

    expect(permissions).toEqual(expect.arrayContaining(Object.values(PERMISSIONS)));
    expect(listAllMock).not.toHaveBeenCalled();
  });

  it('a non-admin role gets exactly its DB-stored permission rows', async () => {
    listAllMock.mockResolvedValue([
      { role: 'reviewer', permission: PERMISSIONS.MEDICAL_CASES_LIST },
      { role: 'reviewer', permission: PERMISSIONS.MEDICAL_CASES_UPDATE },
      { role: 'auditor', permission: PERMISSIONS.MEDICAL_CASES_LIST }
    ]);

    const reviewer = await getEffectivePermissions({ role: ROLES.REVIEWER });
    expect(new Set(reviewer)).toEqual(new Set([PERMISSIONS.MEDICAL_CASES_LIST, PERMISSIONS.MEDICAL_CASES_UPDATE]));
  });

  it('caches the role_permissions table across calls — only one DB query for many lookups', async () => {
    listAllMock.mockResolvedValue([{ role: 'reviewer', permission: PERMISSIONS.MEDICAL_CASES_LIST }]);

    await getEffectivePermissions({ role: ROLES.REVIEWER });
    await getEffectivePermissions({ role: ROLES.REVIEWER });
    await getEffectivePermissions({ role: ROLES.AUDITOR });

    expect(listAllMock).toHaveBeenCalledTimes(1);
  });

  it('a per-user grant override adds a permission the role alone does not have', async () => {
    listAllMock.mockResolvedValue([{ role: 'reviewer', permission: PERMISSIONS.MEDICAL_CASES_LIST }]);

    const permissions = await getEffectivePermissions({
      role: ROLES.REVIEWER,
      permissionOverrides: { grant: [PERMISSIONS.SETTINGS_MANAGE] }
    });

    expect(permissions).toContain(PERMISSIONS.SETTINGS_MANAGE);
    expect(permissions).toContain(PERMISSIONS.MEDICAL_CASES_LIST);
  });

  it('revoke wins over both the role grant and a grant override for the same permission', async () => {
    listAllMock.mockResolvedValue([{ role: 'reviewer', permission: PERMISSIONS.MEDICAL_CASES_LIST }]);

    const permissions = await getEffectivePermissions({
      role: ROLES.REVIEWER,
      permissionOverrides: { grant: [PERMISSIONS.MEDICAL_CASES_LIST], revoke: [PERMISSIONS.MEDICAL_CASES_LIST] }
    });

    expect(permissions).not.toContain(PERMISSIONS.MEDICAL_CASES_LIST);
  });

  it('invalidateRolePermissionsCache forces the next call to re-query the database', async () => {
    listAllMock.mockResolvedValue([{ role: 'reviewer', permission: PERMISSIONS.MEDICAL_CASES_LIST }]);
    await getEffectivePermissions({ role: ROLES.REVIEWER });
    expect(listAllMock).toHaveBeenCalledTimes(1);

    invalidateRolePermissionsCache();
    listAllMock.mockResolvedValue([{ role: 'reviewer', permission: PERMISSIONS.SETTINGS_MANAGE }]);
    const permissions = await getEffectivePermissions({ role: ROLES.REVIEWER });

    expect(listAllMock).toHaveBeenCalledTimes(2);
    expect(permissions).toEqual([PERMISSIONS.SETTINGS_MANAGE]);
  });
});
