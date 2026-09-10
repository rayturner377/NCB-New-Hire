'use server';

import { revalidatePath } from 'next/cache';
import { auditRepository, notificationTemplatesRepository } from '@ncb/database';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { findNotificationTemplateDefinition } from '../registry';
import { sanitizeEmailHtml } from '../sanitize-email-html';
import { updateTemplateSchema } from '../schemas/template';
import type { SettingsActionResult } from '../../settings/types-action';

/** One action shared by every template's own form on the Templates tab — `key` (a hidden field on each form) says which one. */
export async function updateTemplateAction(
  _prevState: SettingsActionResult | null,
  formData: FormData
): Promise<SettingsActionResult> {
  await assertSameOrigin();

  const session = await getSession();
  if (!session) {
    return { ok: false, error: 'Your session has expired. Please sign in again.' };
  }

  try {
    requirePermission(session.user, PERMISSIONS.SETTINGS_MANAGE);
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    throw error;
  }

  // formData.get() returns null (not undefined) for a field the form never rendered — the
  // structural templates' editor omits ccEmails/bccEmails entirely (see template-editor-page.tsx),
  // and zod's `.optional()` accepts undefined but not null, so those need coalescing here.
  const parsed = updateTemplateSchema.safeParse({
    key: formData.get('key'),
    subject: formData.get('subject'),
    body: formData.get('body'),
    bodyMode: formData.get('bodyMode'),
    ccEmails: formData.get('ccEmails') ?? undefined,
    bccEmails: formData.get('bccEmails') ?? undefined,
    backgroundColor: formData.get('backgroundColor') ?? undefined,
    enabled: formData.get('enabled') != null
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid template.' };
  }

  const definition = findNotificationTemplateDefinition(parsed.data.key);
  if (!definition) {
    return { ok: false, error: 'Unknown notification type.' };
  }

  await notificationTemplatesRepository.upsert(
    {
      key: parsed.data.key,
      label: definition.label,
      subject: parsed.data.subject,
      // Sanitized regardless of which editor wrote it — Code mode lets an admin paste arbitrary
      // HTML, and this is the actual enforcement point for the NCB Email Design Style Guide's
      // no-clickable-links rule now, not just the WYSIWYG editor's missing Link button.
      body: sanitizeEmailHtml(parsed.data.body),
      bodyMode: parsed.data.bodyMode,
      ccEmails: parsed.data.ccEmails || null,
      bccEmails: parsed.data.bccEmails || null,
      backgroundColor: parsed.data.backgroundColor || null,
      enabled: parsed.data.enabled
    },
    session.user.id
  );

  await auditRepository.append({
    eventType: 'settings_updated',
    actorUserId: session.user.id,
    entityType: 'settings',
    entityId: `template:${parsed.data.key}`,
    details: { templateKey: parsed.data.key }
  });

  revalidatePath('/settings');
  return { ok: true };
}
