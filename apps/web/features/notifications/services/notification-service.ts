import { randomUUID } from 'node:crypto';
import { auditRepository, emailMessagesRepository, notificationTemplatesRepository } from '@ncb/database';
import { render } from '@react-email/render';
import { isSvgDataUrl } from '../../../lib/image-data-url';
import { inlineDataUrlImages } from '../../../lib/inline-images';
import { sendMail } from '../../../lib/mail';
import { getSettings } from '../../settings/services/settings-service';
import { NotificationEmail } from '../emails/notification-email';
import { findNotificationTemplateDefinition } from '../registry';
import { substituteBodyVariables, substituteVariables } from '../template-rendering';

export interface SendNotificationInput {
  templateKey: string;
  to: string;
  variables: Record<string, string>;
  /** Merged with the template's own saved CC (Settings → Templates), not a replacement for it — used for a standing copy address like Settings → Notifications' "Doctor notification copy email(s)", which should apply to every doctor-directed template regardless of what that template's own CC field says. */
  extraCc?: string;
  /** Ties the resulting email_messages row back to whatever triggered it (a case, a user) — same entityType/entityId convention as audit_events, shown in the Message Centre's detail view. */
  entityType?: string;
  entityId?: string;
}

export interface RenderedNotificationEmail {
  subject: string;
  html: string;
  text: string;
  ccEmails?: string;
  bccEmails?: string;
}

/**
 * The actual rendering pipeline -- subject/body lookup-with-fallback, shared header/footer,
 * variable substitution, HTML + plain-text rendering -- shared by a real automatic send
 * (sendNotification, below) and Settings -> Mail's "send test email" (features/settings/actions/
 * send-test-email.ts) when an admin picks a real template to preview via an actual SMTP send
 * instead of the generic test message. Deliberately doesn't check whether the template is
 * enabled -- that's a gate on automatic dispatch, not on being able to preview what a template
 * would produce. `preloadedSaved` lets a caller that already fetched the row (sendNotification,
 * to check `enabled`) skip a redundant lookup.
 */
export async function renderNotificationEmail(
  templateKey: string,
  variables: Record<string, string>,
  preloadedSaved?: Awaited<ReturnType<typeof notificationTemplatesRepository.findByKey>>
): Promise<RenderedNotificationEmail | null> {
  const definition = findNotificationTemplateDefinition(templateKey);
  if (!definition) return null;

  const settings = await getSettings();
  const saved = preloadedSaved !== undefined ? preloadedSaved : await notificationTemplatesRepository.findByKey(templateKey);

  const subjectTemplate = saved?.subject ?? definition.defaultSubject;
  const bodyTemplate = saved?.body ?? definition.defaultBody;

  const allVariables: Record<string, string> = {
    portalName: settings.general.portalName,
    organizationName: settings.general.organizationName,
    logoUrl: settings.general.smallLogoDataUrl,
    ...variables
  };

  const subject = substituteVariables(subjectTemplate, allVariables);
  const bodyHtml = substituteBodyVariables(bodyTemplate, allVariables);

  const [savedHeader, savedFooter] = await Promise.all([
    notificationTemplatesRepository.findByKey('email_header'),
    notificationTemplatesRepository.findByKey('email_footer')
  ]);
  const headerTemplate = savedHeader?.body ?? findNotificationTemplateDefinition('email_header')?.defaultBody ?? '';
  const footerTemplate = savedFooter?.body ?? findNotificationTemplateDefinition('email_footer')?.defaultBody ?? '';
  const footerBackgroundColor = savedFooter?.backgroundColor ?? findNotificationTemplateDefinition('email_footer')?.defaultBackgroundColor ?? undefined;

  // SVG has essentially no support across real email clients (Outlook in particular shows a
  // broken image and dumps the raw .svg as an attachment instead) — fall back to the same
  // plain-text portal name NotificationEmail already renders when there's no logo at all, rather
  // than sending something guaranteed to look broken. Browser-rendered surfaces (topbar, login
  // screen, the template editor's own live preview) are unaffected — SVG works fine there.
  const rawLogoUrl = settings.general.smallLogoDataUrl || undefined;
  const emailLogoUrl = rawLogoUrl && !isSvgDataUrl(rawLogoUrl) ? rawLogoUrl : undefined;

  const emailElement = NotificationEmail({
    previewText: subject,
    portalName: settings.general.portalName,
    bodyHtml,
    logoUrl: emailLogoUrl,
    headerHtml: substituteBodyVariables(headerTemplate, allVariables),
    footerHtml: substituteBodyVariables(footerTemplate, allVariables),
    footerBackgroundColor
  });
  const html = await render(emailElement);
  const text = await render(emailElement, { plainText: true });

  return { subject, html, text, ccEmails: saved?.ccEmails ?? undefined, bccEmails: saved?.bccEmails ?? undefined };
}

/**
 * The one path every real notification in the app goes through — looks up
 * an admin-saved override for `templateKey` (Settings → Templates), falling
 * back to the registry's own default subject/body if none has been saved
 * yet, substitutes `{{variable}}` placeholders, and renders the result
 * through the shared NotificationEmail react-email component (HTML + a
 * plain-text fallback) via renderNotificationEmail above. Everything up to
 * here is local, fast, and awaited — it's what decides whether there's
 * anything to send at all.
 *
 * The actual dispatch (the SMTP round trip, plus writing the email_messages
 * row — the Message Centre's entire data source) is handed off to
 * dispatchNotification below *without* being awaited. Every caller of this
 * function is itself a case/user action a real person is waiting on (a case
 * transition, a payment confirmation, a password reset) — those shouldn't
 * sit blocked on a mail server that can be slow or briefly unreachable, since
 * nodemailer's connection has no timeout override here and can take minutes
 * to give up. This relies on the app running as a long-lived Node process
 * (true today — see lib/master-key.ts's on-disk key and the direct Postgres
 * connection) rather than a serverless/edge runtime that tears the process
 * down the moment the response is sent; if that ever changes, this needs
 * Next's after()/a real job queue instead of a detached promise.
 *
 * Never throws: a misconfigured/offline mail server, or SMTP simply being
 * turned off, should never break whatever case/user action triggered the
 * notification. Returns the id the message will be recorded under, or null
 * if nothing was attempted (SMTP disabled, template disabled, or no
 * recipient) — note the row isn't necessarily written yet by the time this
 * resolves, since dispatch keeps running after this function returns.
 */
export async function sendNotification(input: SendNotificationInput): Promise<string | null> {
  const definition = findNotificationTemplateDefinition(input.templateKey);
  if (!definition || !input.to) return null;

  const settings = await getSettings();
  if (!settings.mail.enabled) return null;

  const saved = await notificationTemplatesRepository.findByKey(input.templateKey);
  if (saved && !saved.enabled) return null;

  const rendered = await renderNotificationEmail(input.templateKey, input.variables, saved);
  if (!rendered) return null;

  const ccEmails = [rendered.ccEmails, input.extraCc].filter(Boolean).join(',') || undefined;
  const bccEmails = rendered.bccEmails;

  const id = randomUUID();
  void dispatchNotification({
    id,
    templateKey: input.templateKey,
    to: input.to,
    ccEmails,
    bccEmails,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    entityType: input.entityType,
    entityId: input.entityId,
    mailSettings: settings.mail
  });

  return id;
}

interface DispatchNotificationInput {
  id: string;
  templateKey: string;
  to: string;
  ccEmails?: string;
  bccEmails?: string;
  subject: string;
  html: string;
  text: string;
  entityType?: string;
  entityId?: string;
  mailSettings: Awaited<ReturnType<typeof getSettings>>['mail'];
}

/** The actual send + logging, run detached from the caller — see sendNotification's own doc comment for why. */
async function dispatchNotification(input: DispatchNotificationInput): Promise<void> {
  try {
    // Swapped to cid: references only for the actual SMTP send — most real inboxes strip inline
    // base64 images outright (see inline-images.ts), but the row below still stores the original
    // data-URI html so it keeps rendering correctly in the Message Centre's own detail view.
    const { html: outgoingHtml, attachments } = inlineDataUrlImages(input.html);
    await sendMail(input.mailSettings, {
      to: input.to,
      cc: input.ccEmails,
      bcc: input.bccEmails,
      subject: input.subject,
      html: outgoingHtml,
      text: input.text,
      attachments
    });
    await emailMessagesRepository.create({
      id: input.id,
      templateKey: input.templateKey,
      toEmail: input.to,
      ccEmails: input.ccEmails,
      bccEmails: input.bccEmails,
      subject: input.subject,
      bodyHtml: input.html,
      status: 'sent',
      entityType: input.entityType,
      entityId: input.entityId
    });
  } catch (error) {
    console.error(`Notification "${input.templateKey}" failed to send:`, error);
    // This call's own failure (a DB hiccup while trying to log the *first* failure) must not
    // throw out of dispatchNotification — it's invoked as `void dispatchNotification(...)` (see
    // sendNotification), so an uncaught rejection here would escape as an unhandled promise
    // rejection instead of being contained the way the send failure above already is.
    try {
      await emailMessagesRepository.create({
        id: input.id,
        templateKey: input.templateKey,
        toEmail: input.to,
        ccEmails: input.ccEmails,
        bccEmails: input.bccEmails,
        subject: input.subject,
        bodyHtml: input.html,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
        entityType: input.entityType,
        entityId: input.entityId
      });
    } catch (loggingError) {
      console.error(`Notification "${input.templateKey}" also failed to record its own failure:`, loggingError);
    }
  }
}

/**
 * The Message Centre's "Resend" action — replays a past attempt's already-
 * rendered subject/HTML exactly as it was, rather than re-rendering the
 * (possibly since-edited) template. Updates that same row in place instead
 * of creating a new one, so a message's history stays "one row per logical
 * send," not one per attempt.
 */
export async function resendEmailMessage(id: string, actorId?: string): Promise<void> {
  const message = await emailMessagesRepository.findById(id);
  if (!message) {
    throw new Error('Message not found.');
  }

  // Recorded regardless of the resend's own delivery outcome (tracked separately on the
  // email_messages row itself) — this is about who triggered it, not whether it landed.
  await auditRepository.append({
    eventType: 'message_resent',
    actorUserId: actorId,
    entityType: 'email_message',
    entityId: id,
    details: { toEmail: message.toEmail, subject: message.subject }
  });

  const settings = await getSettings();
  try {
    const { html: outgoingHtml, attachments } = inlineDataUrlImages(message.bodyHtml);
    await sendMail(settings.mail, {
      to: message.toEmail,
      cc: message.ccEmails ?? undefined,
      bcc: message.bccEmails ?? undefined,
      subject: message.subject,
      html: outgoingHtml,
      attachments
    });
    await emailMessagesRepository.updateStatus(id, 'sent', null);
  } catch (error) {
    await emailMessagesRepository.updateStatus(id, 'failed', error instanceof Error ? error.message : String(error));
    throw error;
  }
}
