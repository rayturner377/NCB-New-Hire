import { beforeEach, describe, expect, it, vi } from 'vitest';

const hasLiveAccessCodeMock = vi.fn();

vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../services/access-codes-service', () => ({
  hasLiveAccessCode: (...args: unknown[]) => hasLiveAccessCodeMock(...args)
}));

const { checkSignInMethodAction } = await import('../../check-sign-in-method');

describe('checkSignInMethodAction', () => {
  beforeEach(() => {
    hasLiveAccessCodeMock.mockReset();
  });

  it('defaults to password for an invalid email, without checking for a live code', async () => {
    const result = await checkSignInMethodAction('not-an-email');

    expect(result.method).toBe('password');
    expect(hasLiveAccessCodeMock).not.toHaveBeenCalled();
  });

  it('returns "code" when the account has a live code (fresh activation or an unredeemed reset)', async () => {
    hasLiveAccessCodeMock.mockResolvedValue(true);

    const result = await checkSignInMethodAction('jane@example.com');

    expect(result.method).toBe('code');
    expect(hasLiveAccessCodeMock).toHaveBeenCalledWith('jane@example.com');
  });

  it('returns "password" when there is no live code (the ordinary sign-in case, including unknown emails)', async () => {
    hasLiveAccessCodeMock.mockResolvedValue(false);

    const result = await checkSignInMethodAction('jane@example.com');

    expect(result.method).toBe('password');
  });
});
