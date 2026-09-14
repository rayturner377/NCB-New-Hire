import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyAccessCodeMock = vi.fn();
const isAccessCodeRateLimitedMock = vi.fn();
const recordFailedAccessCodeAttemptMock = vi.fn();

vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/client-ip', () => ({ getClientIp: async () => '203.0.113.5' }));
vi.mock('../../../services/access-code-rate-limit', () => ({
  isAccessCodeRateLimited: (...args: unknown[]) => isAccessCodeRateLimitedMock(...args),
  recordFailedAccessCodeAttempt: (...args: unknown[]) => recordFailedAccessCodeAttemptMock(...args)
}));
vi.mock('../../../services/access-codes-service', () => ({
  verifyAccessCode: (...args: unknown[]) => verifyAccessCodeMock(...args)
}));

const { verifyAccessCodeAction } = await import('../../verify-access-code');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('verifyAccessCodeAction', () => {
  beforeEach(() => {
    verifyAccessCodeMock.mockReset();
    isAccessCodeRateLimitedMock.mockReset();
    isAccessCodeRateLimitedMock.mockResolvedValue(false);
    recordFailedAccessCodeAttemptMock.mockReset();
  });

  it('rejects a malformed code without calling verifyAccessCode', async () => {
    const result = await verifyAccessCodeAction(null, formData({ email: 'jane@example.com', code: '12' }));

    expect(result.ok).toBe(false);
    expect(verifyAccessCodeMock).not.toHaveBeenCalled();
  });

  it('rejects when rate-limited', async () => {
    isAccessCodeRateLimitedMock.mockResolvedValue(true);

    const result = await verifyAccessCodeAction(null, formData({ email: 'jane@example.com', code: '482913' }));

    expect(result.ok).toBe(false);
    expect(verifyAccessCodeMock).not.toHaveBeenCalled();
  });

  it('records a failed attempt and returns the generic error on a wrong/expired code', async () => {
    verifyAccessCodeMock.mockResolvedValue({ ok: false, error: 'That code is invalid or has expired.' });

    const result = await verifyAccessCodeAction(null, formData({ email: 'jane@example.com', code: '000000' }));

    expect(result.ok).toBe(false);
    expect(recordFailedAccessCodeAttemptMock).toHaveBeenCalled();
  });

  it('succeeds on a matching code without recording a failed attempt', async () => {
    verifyAccessCodeMock.mockResolvedValue({ ok: true, userId: 'usr_1', purpose: 'password_reset' });

    const result = await verifyAccessCodeAction(null, formData({ email: 'jane@example.com', code: '482913' }));

    expect(result.ok).toBe(true);
    expect(recordFailedAccessCodeAttemptMock).not.toHaveBeenCalled();
  });
});
