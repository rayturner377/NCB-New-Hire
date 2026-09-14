import { beforeEach, describe, expect, it, vi } from 'vitest';

const auditAppend = vi.fn();
const findByEmailMock = vi.fn();
const sendNotificationMock = vi.fn();
const issueAccessCodeMock = vi.fn();
const isPasswordResetRequestRateLimitedMock = vi.fn();
const recordPasswordResetRequestAttemptMock = vi.fn();

vi.mock('@ncb/database', () => ({
  auditRepository: { append: (...args: unknown[]) => auditAppend(...args) },
  usersRepository: { findByEmail: (...args: unknown[]) => findByEmailMock(...args) }
}));
vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/client-ip', () => ({ getClientIp: async () => '203.0.113.5' }));
vi.mock('../../../../notifications/services/notification-service', () => ({
  sendNotification: (...args: unknown[]) => sendNotificationMock(...args)
}));
vi.mock('../../../services/access-codes-service', () => ({
  issueAccessCode: (...args: unknown[]) => issueAccessCodeMock(...args)
}));
vi.mock('../../../services/password-reset-request-rate-limit', () => ({
  isPasswordResetRequestRateLimited: (...args: unknown[]) => isPasswordResetRequestRateLimitedMock(...args),
  recordPasswordResetRequestAttempt: (...args: unknown[]) => recordPasswordResetRequestAttemptMock(...args)
}));

const { requestPasswordResetAction } = await import('../../request-password-reset');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('requestPasswordResetAction', () => {
  beforeEach(() => {
    auditAppend.mockReset();
    findByEmailMock.mockReset();
    sendNotificationMock.mockReset();
    issueAccessCodeMock.mockReset();
    issueAccessCodeMock.mockResolvedValue('482913');
    isPasswordResetRequestRateLimitedMock.mockReset();
    isPasswordResetRequestRateLimitedMock.mockResolvedValue(false);
    recordPasswordResetRequestAttemptMock.mockReset();
  });

  it('rejects an invalid email without touching the rate limiter', async () => {
    const result = await requestPasswordResetAction(null, formData({ email: 'not-an-email' }));

    expect(result.ok).toBe(false);
    expect(isPasswordResetRequestRateLimitedMock).not.toHaveBeenCalled();
  });

  it('rejects when rate-limited, without looking up the user', async () => {
    isPasswordResetRequestRateLimitedMock.mockResolvedValue(true);

    const result = await requestPasswordResetAction(null, formData({ email: 'jane@example.com' }));

    expect(result.ok).toBe(false);
    expect(findByEmailMock).not.toHaveBeenCalled();
  });

  it('issues a code, audits, and emails it when the account exists', async () => {
    findByEmailMock.mockResolvedValue({ id: 'usr_1', email: 'jane@example.com', displayName: 'Jane Doe' });

    const result = await requestPasswordResetAction(null, formData({ email: 'jane@example.com' }));

    expect(result.ok).toBe(true);
    expect(issueAccessCodeMock).toHaveBeenCalledWith('usr_1', 'password_reset');
    expect(auditAppend).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'password_reset_requested', actorUserId: 'usr_1', entityId: 'usr_1' })
    );
    expect(sendNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ templateKey: 'password_reset', to: 'jane@example.com', variables: expect.objectContaining({ resetCode: '482913' }) })
    );
  });

  it('still returns ok — without issuing a code or sending anything — when no account exists, to avoid confirming which emails are registered', async () => {
    findByEmailMock.mockResolvedValue(null);

    const result = await requestPasswordResetAction(null, formData({ email: 'nobody@example.com' }));

    expect(result.ok).toBe(true);
    expect(issueAccessCodeMock).not.toHaveBeenCalled();
    expect(auditAppend).not.toHaveBeenCalled();
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it('records an attempt against the rate limiter on every well-formed request', async () => {
    findByEmailMock.mockResolvedValue(null);

    await requestPasswordResetAction(null, formData({ email: 'nobody@example.com' }));

    expect(recordPasswordResetRequestAttemptMock).toHaveBeenCalled();
  });
});
