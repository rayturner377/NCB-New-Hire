import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMailMock = vi.fn();
const createTransportMock = vi.fn(() => ({ sendMail: sendMailMock }));

vi.mock('nodemailer', () => ({
  default: { createTransport: (...args: unknown[]) => createTransportMock(...args) }
}));

const { sendMail, MailNotConfiguredError } = await import('../../mail');

const baseMailSettings = {
  enabled: true,
  host: 'smtp.ncb.local',
  port: 587,
  secure: false,
  username: '',
  password: '',
  fromEmail: 'noreply@ncb.local'
};

describe('sendMail', () => {
  beforeEach(() => {
    sendMailMock.mockReset();
    createTransportMock.mockClear();
  });

  it('throws MailNotConfiguredError when SMTP is disabled, without ever creating a transport', async () => {
    await expect(sendMail({ ...baseMailSettings, enabled: false }, { to: 'a@b.com', subject: 'Hi' })).rejects.toThrow(
      MailNotConfiguredError
    );
    expect(createTransportMock).not.toHaveBeenCalled();
  });

  it('omits auth entirely when no username is configured', async () => {
    await sendMail(baseMailSettings, { to: 'a@b.com', subject: 'Hi' });

    expect(createTransportMock).toHaveBeenCalledWith(expect.objectContaining({ auth: undefined }));
  });

  it('includes auth when a username is configured', async () => {
    await sendMail({ ...baseMailSettings, username: 'smtp-user', password: 'secret' }, { to: 'a@b.com', subject: 'Hi' });

    expect(createTransportMock).toHaveBeenCalledWith(expect.objectContaining({ auth: { user: 'smtp-user', pass: 'secret' } }));
  });

  it('falls back to the SMTP username as the from address when fromEmail is blank', async () => {
    await sendMail({ ...baseMailSettings, fromEmail: '', username: 'smtp-user' }, { to: 'a@b.com', subject: 'Hi' });

    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({ from: 'smtp-user' }));
  });

  it('passes cc/bcc/attachments through, mapping attachments to nodemailer\'s cid shape', async () => {
    await sendMail(baseMailSettings, {
      to: 'a@b.com',
      cc: 'cc@b.com',
      bcc: 'bcc@b.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
      attachments: [{ cid: 'img1', content: Buffer.from('x'), contentType: 'image/png' }]
    });

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cc: 'cc@b.com',
        bcc: 'bcc@b.com',
        attachments: [{ cid: 'img1', content: Buffer.from('x'), contentType: 'image/png' }]
      })
    );
  });

  it('omits cc/bcc entirely (undefined, not empty string) when not provided', async () => {
    await sendMail(baseMailSettings, { to: 'a@b.com', subject: 'Hi' });

    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({ cc: undefined, bcc: undefined }));
  });
});
