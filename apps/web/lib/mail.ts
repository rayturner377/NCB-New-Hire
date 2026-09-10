import nodemailer from 'nodemailer';
import type { AppSettings } from '../features/settings/types';
import type { InlineImageAttachment } from './inline-images';

export interface SendMailInput {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  text?: string;
  html?: string;
  /** CID-embedded images (see inline-images.ts's inlineDataUrlImages) — a `src="cid:..."` in `html` needs a matching entry here to actually render in the recipient's inbox. */
  attachments?: InlineImageAttachment[];
}

export class MailNotConfiguredError extends Error {
  constructor() {
    super('SMTP is not enabled — turn it on and fill in the server details under Settings → Mail.');
  }
}

/**
 * Thin nodemailer wrapper reading the admin-configured SMTP settings (see
 * features/settings) — the only place in the app that imports nodemailer
 * directly. Two callers: notification-service.ts's sendNotification (the
 * real, template-driven path everything else should go through) and the
 * settings page's own "Send test email" button, which has no template to
 * render and just wants a bare text email.
 */
export async function sendMail(mail: AppSettings['mail'], input: SendMailInput): Promise<void> {
  if (!mail.enabled) {
    throw new MailNotConfiguredError();
  }

  const transporter = nodemailer.createTransport({
    host: mail.host,
    port: mail.port,
    secure: mail.secure,
    auth: mail.username ? { user: mail.username, pass: mail.password } : undefined
  });

  await transporter.sendMail({
    from: mail.fromEmail || mail.username,
    to: input.to,
    cc: input.cc || undefined,
    bcc: input.bcc || undefined,
    subject: input.subject,
    text: input.text,
    html: input.html,
    attachments: input.attachments?.map((attachment) => ({
      cid: attachment.cid,
      content: attachment.content,
      contentType: attachment.contentType
    }))
  });
}
