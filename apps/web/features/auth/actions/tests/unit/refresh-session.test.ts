import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@ncb/auth', () => ({ auth: { api: { getSession: (...args: unknown[]) => getSessionMock(...args) } } }));
vi.mock('../../../../../lib/session', () => ({ sessionTtlMs: () => 900_000 }));

const { refreshSessionAction } = await import('../../refresh-session');

describe('refreshSessionAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
  });

  it('returns ok:true with the TTL when the session is still valid', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1' } });

    const result = await refreshSessionAction();

    expect(result).toEqual({ ok: true, expiresInMs: 900_000 });
  });

  it('returns ok:false when there is no valid session', async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await refreshSessionAction();

    expect(result).toEqual({ ok: false });
  });
});
