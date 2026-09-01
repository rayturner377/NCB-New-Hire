import { beforeEach, describe, expect, it, vi } from 'vitest';

const auditAppend = vi.fn();
const getSessionMock = vi.fn();
const destroySessionMock = vi.fn();
const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('@ncb/database', () => ({
  auditRepository: { append: (...args: unknown[]) => auditAppend(...args) }
}));
vi.mock('next/navigation', () => ({ redirect: (path: string) => redirectMock(path) }));
vi.mock('../../../../../lib/session', () => ({
  getSession: (...args: unknown[]) => getSessionMock(...args),
  destroySession: (...args: unknown[]) => destroySessionMock(...args)
}));

const { logout } = await import('../../logout');

describe('logout action', () => {
  beforeEach(() => {
    auditAppend.mockReset();
    getSessionMock.mockReset();
    destroySessionMock.mockReset();
    redirectMock.mockClear();
  });

  it('logs a logout event when there is an active session, then redirects', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'user_1' } });

    await expect(logout()).rejects.toThrow('NEXT_REDIRECT:/login');

    expect(auditAppend).toHaveBeenCalledWith({ eventType: 'logout', actorUserId: 'user_1' });
    expect(destroySessionMock).toHaveBeenCalled();
  });

  it('still destroys the session and redirects when there is no active session', async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(logout()).rejects.toThrow('NEXT_REDIRECT:/login');

    expect(auditAppend).not.toHaveBeenCalled();
    expect(destroySessionMock).toHaveBeenCalled();
  });
});
