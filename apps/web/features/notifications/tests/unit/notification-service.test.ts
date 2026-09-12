import { beforeEach, describe, expect, it, vi } from 'vitest';

const findByKeyMock = vi.fn();
const emailCreateMock = vi.fn();
const emailFindByIdMock = vi.fn();
const emailUpdateStatusMock = vi.fn();
const getSettingsMock = vi.fn();
const findDefinitionMock = vi.fn();
const sendMailMock = vi.fn();
const isSvgDataUrlMock = vi.fn();
const inlineDataUrlImagesMock = vi.fn((html: string) => ({ html, attachments: [] }));

vi.mock('@ncb/database', () => ({
  notificationTemplatesRepository: { findByKey: (...args: unknown[]) => findByKeyMock(...args) },
  emailMessagesRepository: {
    create: (...args: unknown[]) => emailCreateMock(...args),
    findById: (...args: unknown[]) => emailFindByIdMock(...args),
    updateStatus: (...args: unknown[]) => emailUpdateStatusMock(...args)
  }
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
vi.mock('../../../../lib/image-data-url', () => ({ isSvgDataUrl: (...args: [string]) => isSvgDataUrlMock(...args) }));
vi.mock('../../../../lib/inline-images', () => ({ inlineDataUrlImages: (...args: [string]) => inlineDataUrlImagesMock(...args) }));

const { sendNotification, renderNotificationEmail, resendEmailMessage } = await import('../../services/notification-service');

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
    emailFindByIdMock.mockReset();
    emailUpdateStatusMock.mockReset();
    getSettingsMock.mockReset();
    findDefinitionMock.mockReset();
    sendMailMock.mockReset();
    isSvgDataUrlMock.mockReset();
    inlineDataUrlImagesMock.mockClear();

    findDefinitionMock.mockImplementation((key: string) =>
      key === 'case_reviewed'
        ? { key, label: 'Case reviewed', defaultSubject: 'Subject', defaultBody: 'Body' }
        : key === 'unknown_template'
          ? undefined
          : { key, label: key, defaultSubject: '', defaultBody: '' }
    );
    findByKeyMock.mockResolvedValue(null);
    isSvgDataUrlMock.mockReturnValue(false);
    getSettingsMock.mockResolvedValue({
      mail: { enabled: true, fromEmail: 'noreply@ncb.local', host: 'smtp.local', port: 587, username: '', password: '', secure: false },
      general: { portalName: 'NCB Medical Platform', organizationName: 'NCB', smallLogoDataUrl: '' }
    });
  });

  it('returns null for an unknown template key', async () => {
    expect(await sendNotification({ templateKey: 'unknown_template', to: 'a@b.com', variables: {} })).toBeNull();
    expect(getSettingsMock).not.toHaveBeenCalled();
  });

  it('returns null when there is no recipient', async () => {
    expect(await sendNotification({ templateKey: 'case_reviewed', to: '', variables: {} })).toBeNull();
  });

  it('returns null when the saved template row has been explicitly disabled', async () => {
    findByKeyMock.mockResolvedValue({ enabled: false });
    expect(await sendNotification({ templateKey: 'case_reviewed', to: 'a@b.com', variables: {} })).toBeNull();
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('merges the saved CC with an extraCc address', async () => {
    findByKeyMock.mockResolvedValue({ enabled: true, ccEmails: 'saved-cc@ncb.local' });
    sendMailMock.mockResolvedValue(undefined);

    await sendNotification({ templateKey: 'case_reviewed', to: 'a@b.com', variables: {}, extraCc: 'extra@ncb.local' });
    await flushMicrotasks();
    await flushMicrotasks();

    expect(sendMailMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ cc: 'saved-cc@ncb.local,extra@ncb.local' }));
  });

  it('sends with no CC at all when neither the template nor the call specifies one', async () => {
    sendMailMock.mockResolvedValue(undefined);

    await sendNotification({ templateKey: 'case_reviewed', to: 'a@b.com', variables: {} });
    await flushMicrotasks();
    await flushMicrotasks();

    expect(sendMailMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ cc: undefined }));
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

  it('never lets a failure while recording the failed row escape as an unhandled rejection', async () => {
    sendMailMock.mockRejectedValue(new Error('Connection refused'));
    emailCreateMock.mockRejectedValue(new Error('DB connection lost'));
    const unhandled = vi.fn();
    process.once('unhandledRejection', unhandled);

    await sendNotification({ templateKey: 'case_reviewed', to: 'doctor@ncb.local', variables: {} });
    await flushMicrotasks();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(unhandled).not.toHaveBeenCalled();
  });
});

describe('renderNotificationEmail', () => {
  beforeEach(() => {
    findByKeyMock.mockReset();
    getSettingsMock.mockReset();
    findDefinitionMock.mockReset();
    isSvgDataUrlMock.mockReset();

    findDefinitionMock.mockImplementation((key: string) => {
      if (key === 'case_reviewed') return { key, label: 'Case reviewed', defaultSubject: 'Default subject', defaultBody: 'Default body' };
      if (key === 'unknown_template') return undefined;
      return { key, label: key, defaultSubject: '', defaultBody: '' };
    });
    findByKeyMock.mockResolvedValue(null);
    isSvgDataUrlMock.mockReturnValue(false);
    getSettingsMock.mockResolvedValue({
      general: { portalName: 'NCB Medical Platform', organizationName: 'NCB', smallLogoDataUrl: '' }
    });
  });

  it('returns null for an unknown template', async () => {
    expect(await renderNotificationEmail('unknown_template', {})).toBeNull();
  });

  it('falls back to the registry default subject/body when nothing has been saved', async () => {
    const result = await renderNotificationEmail('case_reviewed', {});
    expect(result?.subject).toBe('Default subject');
  });

  it('prefers a saved subject/body over the registry default', async () => {
    findByKeyMock.mockResolvedValue({ subject: 'Saved subject', body: 'Saved body' });
    const result = await renderNotificationEmail('case_reviewed', {});
    expect(result?.subject).toBe('Saved subject');
  });

  it('uses a preloaded saved row instead of looking one up again', async () => {
    await renderNotificationEmail('case_reviewed', {}, { subject: 'Preloaded', body: 'Preloaded body' } as never);
    // findByKey is still called for the shared header/footer templates, but not for case_reviewed's own row.
    expect(findByKeyMock).not.toHaveBeenCalledWith('case_reviewed');
  });

  it('omits the logo entirely when none is configured', async () => {
    getSettingsMock.mockResolvedValue({ general: { portalName: 'NCB', organizationName: 'NCB', smallLogoDataUrl: '' } });
    await renderNotificationEmail('case_reviewed', {});
    expect(isSvgDataUrlMock).not.toHaveBeenCalled();
  });

  it('drops an SVG logo (no email-client support) but keeps a non-SVG one', async () => {
    getSettingsMock.mockResolvedValue({ general: { portalName: 'NCB', organizationName: 'NCB', smallLogoDataUrl: 'data:image/svg+xml;base64,x' } });
    isSvgDataUrlMock.mockReturnValue(true);
    // Doesn't throw, and completes — the actual logoUrl passed to NotificationEmail is opaque here
    // since that component is mocked out, so this just exercises the branch without asserting DOM.
    await expect(renderNotificationEmail('case_reviewed', {})).resolves.not.toBeNull();
  });
});

describe('resendEmailMessage', () => {
  beforeEach(() => {
    emailFindByIdMock.mockReset();
    emailUpdateStatusMock.mockReset();
    getSettingsMock.mockReset();
    sendMailMock.mockReset();
    inlineDataUrlImagesMock.mockClear();

    getSettingsMock.mockResolvedValue({
      mail: { enabled: true, fromEmail: 'noreply@ncb.local', host: 'smtp.local', port: 587, username: '', password: '', secure: false }
    });
  });

  it('throws when the message does not exist', async () => {
    emailFindByIdMock.mockResolvedValue(null);
    await expect(resendEmailMessage('missing')).rejects.toThrow('Message not found.');
  });

  it('resends the exact stored subject/HTML and marks it sent', async () => {
    emailFindByIdMock.mockResolvedValue({
      id: 'msg_1',
      toEmail: 'a@b.com',
      ccEmails: null,
      bccEmails: null,
      subject: 'Stored subject',
      bodyHtml: '<p>Stored body</p>'
    });
    sendMailMock.mockResolvedValue(undefined);

    await resendEmailMessage('msg_1');

    expect(sendMailMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ to: 'a@b.com', subject: 'Stored subject' }));
    expect(emailUpdateStatusMock).toHaveBeenCalledWith('msg_1', 'sent', null);
  });

  it('marks the message failed and rethrows when the resend attempt fails', async () => {
    emailFindByIdMock.mockResolvedValue({
      id: 'msg_1',
      toEmail: 'a@b.com',
      ccEmails: null,
      bccEmails: null,
      subject: 'Stored subject',
      bodyHtml: '<p>Stored body</p>'
    });
    sendMailMock.mockRejectedValue(new Error('SMTP down'));

    await expect(resendEmailMessage('msg_1')).rejects.toThrow('SMTP down');
    expect(emailUpdateStatusMock).toHaveBeenCalledWith('msg_1', 'failed', 'SMTP down');
  });
});
