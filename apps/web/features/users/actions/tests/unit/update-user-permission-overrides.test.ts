import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const updateUserMock = vi.fn();
const getUserRoleMock = vi.fn();
const auditAppendMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('@ncb/database', () => ({ auditRepository: { append: (...args: unknown[]) => auditAppendMock(...args) } }));
vi.mock('../../../services/users-service', () => ({
  updateUser: (...args: unknown[]) => updateUserMock(...args),
  getUserRole: (...args: unknown[]) => getUserRoleMock(...args)
}));

const { updateUserPermissionOverridesAction } = await import('../../update-user-permission-overrides');
const { PERMISSIONS } = await import('../../../../../lib/permissions');

function formData(fields: { userId: string; grant?: string[]; revoke?: string[] }): FormData {
  const data = new FormData();
  data.set('userId', fields.userId);
  for (const permission of fields.grant ?? []) data.append('grant', permission);
  for (const permission of fields.revoke ?? []) data.append('revoke', permission);
  return data;
}

describe('updateUserPermissionOverridesAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    updateUserMock.mockReset();
    getUserRoleMock.mockReset();
    auditAppendMock.mockReset();
    revalidatePathMock.mockClear();
    getSessionMock.mockResolvedValue({ user: { id: 'usr_admin_demo', role: 'admin' } });
  });

  it('rejects a non-admin caller, even one holding STAFF_ACCOUNTS_MANAGE', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });

    const result = await updateUserPermissionOverridesAction(null, formData({ userId: 'usr_1', grant: [PERMISSIONS.SETTINGS_MANAGE] }));

    expect(result.ok).toBe(false);
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it('rejects an unknown permission key', async () => {
    const result = await updateUserPermissionOverridesAction(null, formData({ userId: 'usr_1', grant: ['not:a-real-permission'] }));

    expect(result.ok).toBe(false);
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it('refuses to grant USERS_MANAGE/SETTINGS_MANAGE to any user, even for an authorized admin caller', async () => {
    getUserRoleMock.mockResolvedValue('reviewer');

    const result = await updateUserPermissionOverridesAction(null, formData({ userId: 'usr_1', grant: [PERMISSIONS.USERS_MANAGE] }));

    expect(result.ok).toBe(false);
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it('refuses an admin target — overrides would have no effect on that role', async () => {
    getUserRoleMock.mockResolvedValue('admin');

    const result = await updateUserPermissionOverridesAction(null, formData({ userId: 'usr_admin_1', grant: [PERMISSIONS.REPORTS_VIEW] }));

    expect(result.ok).toBe(false);
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it('drops a permission from grant when it is also in revoke, so revoke unambiguously wins in storage', async () => {
    getUserRoleMock.mockResolvedValue('reviewer');

    const result = await updateUserPermissionOverridesAction(
      null,
      formData({ userId: 'usr_1', grant: [PERMISSIONS.REPORTS_VIEW], revoke: [PERMISSIONS.REPORTS_VIEW] })
    );

    expect(result.ok).toBe(true);
    expect(updateUserMock).toHaveBeenCalledWith('usr_1', { permissionOverrides: { grant: [], revoke: [PERMISSIONS.REPORTS_VIEW] } });
  });

  it('saves valid grant/revoke overrides for a non-admin target', async () => {
    getUserRoleMock.mockResolvedValue('clinician');

    const result = await updateUserPermissionOverridesAction(
      null,
      formData({ userId: 'usr_1', grant: [PERMISSIONS.MEDICAL_CASES_TRANSITION] })
    );

    expect(result.ok).toBe(true);
    expect(updateUserMock).toHaveBeenCalledWith('usr_1', {
      permissionOverrides: { grant: [PERMISSIONS.MEDICAL_CASES_TRANSITION], revoke: [] }
    });
    expect(auditAppendMock).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'user_permission_overrides_updated' }));
  });
});
