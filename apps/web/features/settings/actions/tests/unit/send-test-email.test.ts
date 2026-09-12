import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const emailCreateMock = vi.fn();
const getSettingsMock = vi.fn();
const sendMailMock = vi.fn();
const renderNotificationEmailMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args), requireFullSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../../../lib/mail', () => ({ sendMail: (...args: unknown[]) => sendMailMock(...args) }));
vi.mock('@ncb/database', () => ({ emailMessagesRepository: { create: (...args: unknown[]) => emailCreateMock(...args) } }));
vi.mock('../../../services/settings-service', () => ({ getSettings: (...args: unknown[]) => getSettingsMock(...args) }));
vi.mock('../../../../notifications/services/notification-service', () => ({
  renderNotificationEmail: (...args: unknown[]) => renderNotificationEmailMock(...args)
}));
// send-test-email.ts's own createActionRateLimiter() ultimately depends on
// @ncb/redis's client, which throws at construction if REDIS_URL isn't set
// — not exercised by this test's assertions, so the stub just needs to load.
vi.mock('@ncb/redis', () => ({
  isRateLimited: async () => false,
  recordFailedAttempt: async () => undefined
}));

const { sendTestEmailAction } = await import('../../send-test-email');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('sendTestEmailAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    emailCreateMock.mockReset();
    getSettingsMock.mockReset();
    sendMailMock.mockReset();
    renderNotificationEmailMock.mockReset();

    getSessionMock.mockResolvedValue({ user: { id: 'usr_admin_demo', role: 'admin' } });
    getSettingsMock.mockResolvedValue({
      mail: { enabled: true, fromEmail: 'noreply@ncb.local', host: 'smtp.local', port: 587, username: '', password: '', secure: false },
      general: { portalName: 'NCB Medical Platform', organizationName: 'NCB' }
    });
  });

  it('sends the generic test message when no template is chosen', async () => {
    const result = await sendTestEmailAction(null, formData({ testRecipient: 'admin@ncb.local' }));

    expect(result.ok).toBe(true);
    expect(renderNotificationEmailMock).not.toHaveBeenCalled();
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ to: 'admin@ncb.local', subject: 'NCB Medical Platform — test email' })
    );
  });

  it('renders and sends a real template, prefixed [TEST], when one is chosen', async () => {
    renderNotificationEmailMock.mockResolvedValue({ subject: 'case CASE-1234 is ready for HR review', html: '<p>Rendered</p>', text: 'Rendered' });

    const result = await sendTestEmailAction(null, formData({ testRecipient: 'admin@ncb.local', templateKey: 'case_doctor_submitted' }));

    expect(result.ok).toBe(true);
    expect(renderNotificationEmailMock).toHaveBeenCalledWith('case_doctor_submitted', expect.objectContaining({ caseId: expect.any(String) }));
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ to: 'admin@ncb.local', subject: '[TEST] case CASE-1234 is ready for HR review', html: '<p>Rendered</p>' })
    );
  });

  it('rejects a structural key (email_header/email_footer) — those have no subject/variables of their own to test', async () => {
    const result = await sendTestEmailAction(null, formData({ testRecipient: 'admin@ncb.local', templateKey: 'email_header' }));

    expect(result.ok).toBe(false);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('rejects an unknown template key', async () => {
    const result = await sendTestEmailAction(null, formData({ testRecipient: 'admin@ncb.local', templateKey: 'not_a_real_key' }));

    expect(result.ok).toBe(false);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('rejects without an active session', async () => {
    getSessionMock.mockResolvedValue(null);
    const result = await sendTestEmailAction(null, formData({ testRecipient: 'admin@ncb.local' }));
    expect(result.ok).toBe(false);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("rejects when the caller's role lacks SETTINGS_MANAGE", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'reviewer' } });
    const result = await sendTestEmailAction(null, formData({ testRecipient: 'admin@ncb.local' }));
    expect(result.ok).toBe(false);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('rejects a missing/invalid recipient email', async () => {
    const result = await sendTestEmailAction(null, formData({ testRecipient: 'not-an-email' }));
    expect(result.ok).toBe(false);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('rejects when renderNotificationEmail itself returns null for the chosen template', async () => {
    renderNotificationEmailMock.mockResolvedValue(null);

    const result = await sendTestEmailAction(null, formData({ testRecipient: 'admin@ncb.local', templateKey: 'case_doctor_submitted' }));

    expect(result.ok).toBe(false);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('records a failed row and surfaces the error message when the send itself fails', async () => {
    sendMailMock.mockRejectedValue(new Error('SMTP timeout'));

    const result = await sendTestEmailAction(null, formData({ testRecipient: 'admin@ncb.local' }));

    expect(result.ok).toBe(false);
    expect(result.error).toBe('SMTP timeout');
    expect(emailCreateMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', errorMessage: 'SMTP timeout' }));
  });

  it('falls back to a generic error message when the thrown value is not an Error', async () => {
    sendMailMock.mockRejectedValue('not an Error instance');

    const result = await sendTestEmailAction(null, formData({ testRecipient: 'admin@ncb.local' }));

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Failed to send test email.');
  });
});
