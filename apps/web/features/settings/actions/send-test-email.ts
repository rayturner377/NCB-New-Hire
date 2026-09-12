'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { emailMessagesRepository } from '@ncb/database';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { createActionRateLimiter } from '../../../lib/action-rate-limit';
import { inlineDataUrlImages } from '../../../lib/inline-images';
import { sendMail } from '../../../lib/mail';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../lib/permissions';
import { requireFullSession } from '../../../lib/session';
import { getSettings } from '../services/settings-service';
import { TEST_EMAIL_TEMPLATE_KEY } from '../../messages/test-email';
import { findNotificationTemplateDefinition } from '../../notifications/registry';
import { SAMPLE_VARIABLE_VALUES } from '../../notifications/sample-variable-values';
import { renderNotificationEmail } from '../../notifications/services/notification-service';
import type { SettingsActionResult } from '../types-action';

const testRecipientSchema = z.string().trim().min(1, 'Enter a recipient email address').email('Enter a valid email address');

/** 10 per 15 minutes per admin — plenty for actually verifying SMTP settings, bounds an authenticated account being used to spam a mail server or a target inbox. */
const testEmailLimiter = createActionRateLimiter('send-test-email', 10, 15 * 60 * 1000);

/**
 * Sends one real email through the already-saved SMTP settings — save the
 * Mail tab first, this only reads what's on record, it doesn't take the
 * form's current unsaved values. Unlike sendNotification (notification-
 * service.ts), this is deliberately left synchronous rather than
 * backgrounded — the entire point of clicking "Send test email" is to learn
 * immediately whether SMTP is configured correctly, not to fire it and find
 * out later. It still writes its own email_messages row (same shape
 * sendNotification writes) so the attempt shows up in the Message Centre
 * alongside every other send, tagged with TEST_EMAIL_TEMPLATE_KEY rather
 * than a real notification template key — even when `templateKey` picks a
 * real notification to preview (below), since this is still a manually
 * triggered test rather than the automatic send that template's own key
 * would represent, and the subject is prefixed "[TEST]" for the same reason.
 *
 * When `templateKey` names a real (non-structural) notification type, its
 * actual currently-saved subject/body/header/footer are rendered through the
 * exact same pipeline (renderNotificationEmail) a real send would use, with
 * SAMPLE_VARIABLE_VALUES standing in for whatever real data would normally
 * fill its {{variables}} — so this sends a true preview of what a recipient
 * would actually receive, not just the WYSIWYG editor's approximation.
 */
export async function sendTestEmailAction(
  _prevState: SettingsActionResult | null,
  formData: FormData
): Promise<SettingsActionResult> {
  await assertSameOrigin();

  const session = await requireFullSession();
  if (!session) {
    return { ok: false, error: 'Your session has expired. Please sign in again.' };
  }

  try {
    requirePermission(session.user, PERMISSIONS.SETTINGS_MANAGE);
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    throw error;
  }

  if (await testEmailLimiter.isLimited(session.user.id)) {
    return { ok: false, error: 'Too many test emails sent — please wait a few minutes and try again.' };
  }
  await testEmailLimiter.recordAttempt(session.user.id);

  const parsed = testRecipientSchema.safeParse(formData.get('testRecipient'));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid recipient.' };
  }

  const templateKey = formData.get('templateKey');
  const settings = await getSettings();
  let subject: string;
  let text: string;
  let html: string | undefined;

  if (typeof templateKey === 'string' && templateKey) {
    const definition = findNotificationTemplateDefinition(templateKey);
    if (!definition || definition.isStructural) {
      return { ok: false, error: 'Unknown notification type.' };
    }
    const sampleValues = Object.fromEntries(
      definition.variables.map((variable) => [variable.name, SAMPLE_VARIABLE_VALUES[variable.name] ?? `Sample ${variable.name}`])
    );
    const rendered = await renderNotificationEmail(templateKey, sampleValues);
    if (!rendered) {
      return { ok: false, error: 'Unknown notification type.' };
    }
    subject = `[TEST] ${rendered.subject}`;
    text = rendered.text;
    html = rendered.html;
  } else {
    subject = `${settings.general.portalName} — test email`;
    text = 'This is a test email confirming your SMTP settings are working.';
  }

  const id = randomUUID();

  try {
    const { html: outgoingHtml, attachments } = html ? inlineDataUrlImages(html) : { html: undefined, attachments: undefined };
    await sendMail(settings.mail, { to: parsed.data, subject, text, html: outgoingHtml, attachments });
    await emailMessagesRepository.create({
      id,
      templateKey: TEST_EMAIL_TEMPLATE_KEY,
      toEmail: parsed.data,
      subject,
      bodyHtml: html ?? text,
      status: 'sent'
    });
    revalidatePath('/messages');
    return { ok: true };
  } catch (error) {
    await emailMessagesRepository.create({
      id,
      templateKey: TEST_EMAIL_TEMPLATE_KEY,
      toEmail: parsed.data,
      subject,
      bodyHtml: html ?? text,
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error)
    });
    revalidatePath('/messages');
    return { ok: false, error: error instanceof Error ? error.message : 'Failed to send test email.' };
  }
}
