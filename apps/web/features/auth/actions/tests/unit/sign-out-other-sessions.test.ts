import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const revokeOtherSessionsMock = vi.fn();
const revalidatePathMock = vi.fn();
const auditAppendMock = vi.fn();

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args), requireFullSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('@ncb/auth', () => ({
  auth: { api: { revokeOtherSessions: (...args: unknown[]) => revokeOtherSessionsMock(...args) } }
}));
// Without this, the "success" test below reached the real auditRepository.append — a real Prisma
// client hitting a real (or, in CI, unreachable) Postgres — the same mocking every other action's
// test already does for @ncb/database, just missing here.
vi.mock('@ncb/database', () => ({
  auditRepository: { append: (...args: unknown[]) => auditAppendMock(...args) }
}));

const { signOutOtherSessionsAction } = await import('../../sign-out-other-sessions');

describe('signOutOtherSessionsAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    revokeOtherSessionsMock.mockReset();
    revalidatePathMock.mockClear();
    auditAppendMock.mockReset();
  });

  it('rejects without an active session, without touching Better Auth', async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await signOutOtherSessionsAction(null, new FormData());

    expect(result.ok).toBe(false);
    expect(revokeOtherSessionsMock).not.toHaveBeenCalled();
  });

  it('revokes other sessions, audits it, and revalidates the profile page on success', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1' } });

    const result = await signOutOtherSessionsAction(null, new FormData());

    expect(result).toEqual({ ok: true });
    expect(revokeOtherSessionsMock).toHaveBeenCalled();
    expect(auditAppendMock).toHaveBeenCalledWith({
      eventType: 'sessions_revoked',
      actorUserId: 'usr_1',
      entityType: 'user',
      entityId: 'usr_1'
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/profile');
  });
});
