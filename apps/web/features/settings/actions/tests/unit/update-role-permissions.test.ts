import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const setForRoleMock = vi.fn();
const auditAppendMock = vi.fn();
const revalidatePathMock = vi.fn();
const invalidateCacheMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('@ncb/database', () => ({
  rolePermissionsRepository: { setForRole: (...args: unknown[]) => setForRoleMock(...args) },
  auditRepository: { append: (...args: unknown[]) => auditAppendMock(...args) }
}));
vi.mock('../../../../../lib/effective-permissions', () => ({
  invalidateRolePermissionsCache: (...args: unknown[]) => invalidateCacheMock(...args)
}));

const { updateRolePermissionsAction } = await import('../../update-role-permissions');
const { PERMISSIONS } = await import('../../../../../lib/permissions');

function formData(role: string, permissions: string[]): FormData {
  const data = new FormData();
  data.set('role', role);
  for (const permission of permissions) data.append('permissions', permission);
  return data;
}

describe('updateRolePermissionsAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    setForRoleMock.mockReset();
    auditAppendMock.mockReset();
    revalidatePathMock.mockClear();
    invalidateCacheMock.mockReset();
    getSessionMock.mockResolvedValue({ user: { id: 'usr_admin_demo', role: 'admin' } });
  });

  it('rejects a non-admin caller', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });

    const result = await updateRolePermissionsAction(null, formData('auditor', [PERMISSIONS.MEDICAL_CASES_LIST]));

    expect(result.ok).toBe(false);
    expect(setForRoleMock).not.toHaveBeenCalled();
  });

  it("refuses 'admin' as a target role, even for an admin caller", async () => {
    const result = await updateRolePermissionsAction(null, formData('admin', [PERMISSIONS.SETTINGS_MANAGE]));

    expect(result.ok).toBe(false);
    expect(setForRoleMock).not.toHaveBeenCalled();
  });

  it('rejects an unknown permission key', async () => {
    const result = await updateRolePermissionsAction(null, formData('reviewer', ['not:a-real-permission']));

    expect(result.ok).toBe(false);
    expect(setForRoleMock).not.toHaveBeenCalled();
  });

  it('refuses to grant USERS_MANAGE/SETTINGS_MANAGE to a non-admin role, even for an authorized admin caller', async () => {
    const usersManage = await updateRolePermissionsAction(null, formData('reviewer', [PERMISSIONS.USERS_MANAGE]));
    const settingsManage = await updateRolePermissionsAction(null, formData('reviewer', [PERMISSIONS.SETTINGS_MANAGE]));

    expect(usersManage.ok).toBe(false);
    expect(settingsManage.ok).toBe(false);
    expect(setForRoleMock).not.toHaveBeenCalled();
  });

  it('saves a valid role/permission set and invalidates the cache', async () => {
    const result = await updateRolePermissionsAction(null, formData('reviewer', [PERMISSIONS.MEDICAL_CASES_LIST, PERMISSIONS.REPORTS_VIEW]));

    expect(result.ok).toBe(true);
    expect(setForRoleMock).toHaveBeenCalledWith('reviewer', [PERMISSIONS.MEDICAL_CASES_LIST, PERMISSIONS.REPORTS_VIEW]);
    expect(invalidateCacheMock).toHaveBeenCalled();
    expect(auditAppendMock).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'role_permissions_updated', entityId: 'reviewer' }));
  });
});
