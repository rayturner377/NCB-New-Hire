import { beforeEach, describe, expect, it, vi } from 'vitest';

const findByKeyMock = vi.fn();
const emailCreateMock = vi.fn();
const getSettingsMock = vi.fn();
const findDefinitionMock = vi.fn();
const sendMailMock = vi.fn();

vi.mock('@ncb/database', () => ({
  notificationTemplatesRepository: { findByKey: (...args: unknown[]) => findByKeyMock(...args) },
  emailMessagesRepository: { create: (...args: unknown[]) => emailCreateMock(...args) }
}));
vi.mock('../../../settings/services/settings-service', () => ({ getSettings: (...args: unknown[]) => getSettingsMock(...args) }));
vi.mock('../../registry', () => ({ findNotificationTemplateDefinition: (...args: unknown[]) => findDefinitionMock(...args) }));
vi.mock('../../template-rendering', () => ({
  substituteVariables: (template: string) => template,
  substituteBodyVariables: (template: string) => template
}));
vi.mock('../../emails/notification-email', () => ({ NotificationEmail: () => null }));
vi.mock('@react-email/render', () => ({ render: async (_el: unknown, options?: { plainText?: boolean }) => (options?.plainText ? 'plain text body' : '<p>html body</p>') }));
vi.mock('../../../../lib/mail', () => ({ sendMail: (...args: unknown[]) => sendMailMock(...args) }));

const { sendNotification } = await import('../../services/notification-service');

/** Lets a test yield to the microtask queue so a detached (non-awaited) promise chain gets a chance to run. */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('sendNotification', () => {
  beforeEach(() => {
    findByKeyMock.mockReset();
    emailCreateMock.mockReset();
    getSettingsMock.mockReset();
    findDefinitionMock.mockReset();
    sendMailMock.mockReset();

    findDefinitionMock.mockImplementation((key: string) =>
      key === 'case_reviewed'
        ? { key, label: 'Case reviewed', defaultSubject: 'Subject', defaultBody: 'Body' }
        : { key, label: key, defaultSubject: '', defaultBody: '' }
    );
    findByKeyMock.mockResolvedValue(null);
    getSettingsMock.mockResolvedValue({
      mail: { enabled: true, fromEmail: 'noreply@ncb.local', host: 'smtp.local', port: 587, username: '', password: '', secure: false },
      general: { portalName: 'NCB Medical Platform', organizationName: 'NCB' }
    });
  });

  it('returns null and never attempts to send when SMTP is disabled', async () => {
    getSettingsMock.mockResolvedValue({ mail: { enabled: false }, general: { portalName: 'NCB', organizationName: 'NCB' } });

    const id = await sendNotification({ templateKey: 'case_reviewed', to: 'doctor@ncb.local', variables: {} });

    expect(id).toBeNull();
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('resolves before the SMTP send settles, then records a sent row once it completes', async () => {
    const mailSend = deferred<void>();
    sendMailMock.mockReturnValue(mailSend.promise);

    const id = await sendNotification({ templateKey: 'case_reviewed', to: 'doctor@ncb.local', variables: {} });

    expect(id).toEqual(expect.any(String));
    // The mail send is still pending, but sendNotification already returned — nothing should be
    // recorded yet, proving the caller isn't blocked on the SMTP round trip.
    expect(emailCreateMock).not.toHaveBeenCalled();

    mailSend.resolve();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(emailCreateMock).toHaveBeenCalledWith(expect.objectContaining({ id, status: 'sent', toEmail: 'doctor@ncb.local' }));
  });

  it('records a failed row (without throwing) when the SMTP send rejects', async () => {
    sendMailMock.mockRejectedValue(new Error('Connection refused'));

    const id = await sendNotification({ templateKey: 'case_reviewed', to: 'doctor@ncb.local', variables: {} });
    await flushMicrotasks();
    await flushMicrotasks();

    expect(emailCreateMock).toHaveBeenCalledWith(expect.objectContaining({ id, status: 'failed', errorMessage: 'Connection refused' }));
  });
});
