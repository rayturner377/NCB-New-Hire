'use server';

import { revalidatePath } from 'next/cache';
import type { ZodError } from 'zod';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import {
  exportSettingsSchema,
  generalSettingsSchema,
  mailSettingsSchema,
  notificationSettingsSchema,
  slaSettingsSchema,
  themeSettingsSchema,
  userPolicySettingsSchema
} from '../schemas/settings';
import { getSettings, updateSettingsSection } from '../services/settings-service';
import type { SettingsActionResult } from '../types-action';

function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const flattened = error.flatten().fieldErrors;
  return Object.fromEntries(
    Object.entries(flattened)
      .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0)
      .map(([field, messages]) => [field, messages[0]!])
  );
}

async function requireSettingsAccess() {
  await assertSameOrigin();
  const session = await getSession();
  if (!session) {
    return { ok: false as const, result: { ok: false, error: 'Your session has expired. Please sign in again.' } };
  }
  try {
    requirePermission(session.user, PERMISSIONS.SETTINGS_MANAGE);
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false as const, result: { ok: false, error: error.message } };
    throw error;
  }
  return { ok: true as const, actorId: session.user.id };
}

export async function updateGeneralSettingsAction(
  _prevState: SettingsActionResult | null,
  formData: FormData
): Promise<SettingsActionResult> {
  const access = await requireSettingsAccess();
  if (!access.ok) return access.result;

  const parsed = generalSettingsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid settings.', fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  await updateSettingsSection('general', parsed.data, access.actorId);
  revalidatePath('/settings');
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function updateNotificationSettingsAction(
  _prevState: SettingsActionResult | null,
  formData: FormData
): Promise<SettingsActionResult> {
  const access = await requireSettingsAccess();
  if (!access.ok) return access.result;

  const parsed = notificationSettingsSchema.safeParse({
    reviewerNotificationEmail: formData.get('reviewerNotificationEmail'),
    doctorNotificationEmail: formData.get('doctorNotificationEmail')
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid settings.', fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  await updateSettingsSection('notifications', parsed.data, access.actorId);
  revalidatePath('/settings');
  return { ok: true };
}

export async function updateExportSettingsAction(
  _prevState: SettingsActionResult | null,
  formData: FormData
): Promise<SettingsActionResult> {
  const access = await requireSettingsAccess();
  if (!access.ok) return access.result;

  const parsed = exportSettingsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid settings.', fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  await updateSettingsSection('export', parsed.data, access.actorId);
  revalidatePath('/settings');
  return { ok: true };
}

export async function updateUserPolicySettingsAction(
  _prevState: SettingsActionResult | null,
  formData: FormData
): Promise<SettingsActionResult> {
  const access = await requireSettingsAccess();
  if (!access.ok) return access.result;

  const parsed = userPolicySettingsSchema.safeParse({
    minPasswordLength: formData.get('minPasswordLength'),
    requireUppercase: formData.get('requireUppercase') != null,
    requireNumber: formData.get('requireNumber') != null,
    requireSymbol: formData.get('requireSymbol') != null,
    sessionTimeoutMinutes: formData.get('sessionTimeoutMinutes'),
    loginMaxAttempts: formData.get('loginMaxAttempts'),
    loginWindowMinutes: formData.get('loginWindowMinutes')
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid settings.', fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  await updateSettingsSection('userPolicy', parsed.data, access.actorId);
  revalidatePath('/settings');
  return { ok: true };
}

/**
 * Unlike every other settings tab, the SLA manager's set of rows is dynamic —
 * an admin can add or remove policies freely (sla-settings-form.tsx) — so
 * there's no fixed set of named fields to read off `formData` the way the
 * other actions do. The client instead keeps the whole policy list in local
 * state and serializes it into one hidden `definitionsJson` field on submit.
 */
export async function updateSlaSettingsAction(
  _prevState: SettingsActionResult | null,
  formData: FormData
): Promise<SettingsActionResult> {
  const access = await requireSettingsAccess();
  if (!access.ok) return access.result;

  let definitions: unknown;
  try {
    definitions = JSON.parse(String(formData.get('definitionsJson') || '[]'));
  } catch {
    return { ok: false, error: 'Could not read the submitted SLA policies.' };
  }

  const parsed = slaSettingsSchema.safeParse({ definitions });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid SLA policies.', fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  await updateSettingsSection('sla', parsed.data, access.actorId);
  revalidatePath('/settings');
  revalidatePath('/cases');
  return { ok: true };
}

export async function updateThemeSettingsAction(
  _prevState: SettingsActionResult | null,
  formData: FormData
): Promise<SettingsActionResult> {
  const access = await requireSettingsAccess();
  if (!access.ok) return access.result;

  const parsed = themeSettingsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid theme settings.', fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  await updateSettingsSection('theme', parsed.data, access.actorId);
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function updateMailSettingsAction(
  _prevState: SettingsActionResult | null,
  formData: FormData
): Promise<SettingsActionResult> {
  const access = await requireSettingsAccess();
  if (!access.ok) return access.result;

  const parsed = mailSettingsSchema.safeParse({
    enabled: formData.get('enabled') != null,
    fromEmail: formData.get('fromEmail'),
    host: formData.get('host'),
    port: formData.get('port'),
    username: formData.get('username'),
    password: formData.get('password'),
    secure: formData.get('secure') != null
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid mail settings.', fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  // The password field is never pre-filled with the real saved value (see mail-settings-form.tsx) —
  // submitting it blank means "keep what's already saved", not "clear the password".
  if (!parsed.data.password) {
    const current = await getSettings();
    parsed.data.password = current.mail.password;
  }

  await updateSettingsSection('mail', parsed.data, access.actorId);
  revalidatePath('/settings');
  return { ok: true };
}
