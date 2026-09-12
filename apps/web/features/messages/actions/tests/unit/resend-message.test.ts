import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const resendEmailMessageMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../../notifications/services/notification-service', () => ({
  resendEmailMessage: (...args: unknown[]) => resendEmailMessageMock(...args)
}));
vi.mock('@ncb/redis', () => ({
  isRateLimited: async () => false,
  recordFailedAttempt: async () => undefined
}));

const { resendMessageAction } = await import('../../resend-message');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('resendMessageAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    resendEmailMessageMock.mockReset();
    revalidatePathMock.mockClear();
  });

  it('rejects without an active session', async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await resendMessageAction(null, formData({ id: 'msg_1' }));

    expect(result.ok).toBe(false);
    expect(resendEmailMessageMock).not.toHaveBeenCalled();
  });

  it("rejects when the caller's role lacks NOTIFICATIONS_MANAGE", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'auditor' } });

    const result = await resendMessageAction(null, formData({ id: 'msg_1' }));

    expect(result.ok).toBe(false);
    expect(resendEmailMessageMock).not.toHaveBeenCalled();
  });

  it('rejects a missing message id', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'reviewer' } });

    const result = await resendMessageAction(null, formData({}));

    expect(result.ok).toBe(false);
    expect(resendEmailMessageMock).not.toHaveBeenCalled();
  });

  it('surfaces a resend failure as a friendly error rather than throwing', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'reviewer' } });
    resendEmailMessageMock.mockRejectedValue(new Error('SMTP unreachable'));

    const result = await resendMessageAction(null, formData({ id: 'msg_1' }));

    expect(result.ok).toBe(false);
    expect(result.error).toBe('SMTP unreachable');
  });

  it('falls back to a generic message when the thrown error has no message', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'reviewer' } });
    resendEmailMessageMock.mockRejectedValue('not an Error instance');

    const result = await resendMessageAction(null, formData({ id: 'msg_1' }));

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Failed to resend.');
  });

  it('resends and revalidates both the list and detail pages on success', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'reviewer' } });
    resendEmailMessageMock.mockResolvedValue(undefined);

    const result = await resendMessageAction(null, formData({ id: 'msg_1' }));

    expect(result).toEqual({ ok: true });
    expect(revalidatePathMock).toHaveBeenCalledWith('/messages');
    expect(revalidatePathMock).toHaveBeenCalledWith('/messages/msg_1');
  });
});
