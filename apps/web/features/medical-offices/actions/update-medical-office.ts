'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { createActionRateLimiter } from '../../../lib/action-rate-limit';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../lib/permissions';
import { requireFullSession } from '../../../lib/session';
import { updateMedicalOfficeSchema } from '../schemas/medical-office';
import { updateMedicalOffice } from '../services/medical-offices-service';
import type { MedicalOfficeActionResult } from './create-medical-office';

/** Same limit as create-medical-office.ts — edits are as infrequent as creations. */
const updateMedicalOfficeLimiter = createActionRateLimiter('update-medical-office', 10, 15 * 60 * 1000);

export async function updateMedicalOfficeAction(
  _prevState: MedicalOfficeActionResult | null,
  formData: FormData
): Promise<MedicalOfficeActionResult> {
  await assertSameOrigin();

  const session = await requireFullSession();
  if (!session) {
    return { ok: false, error: 'Your session has expired. Please sign in again.' };
  }

  // No dedicated MEDICAL_OFFICES_UPDATE permission — whoever can create a facility can also fix a
  // typo in one, same one-permission-covers-CRUD shape as MEDICAL_OFFICES_CREATE already had before
  // this action existed.
  try {
    requirePermission(session.user, PERMISSIONS.MEDICAL_OFFICES_CREATE);
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    throw error;
  }

  const officeId = String(formData.get('officeId') || '');
  if (!officeId) {
    return { ok: false, error: 'Missing facility id.' };
  }

  if (await updateMedicalOfficeLimiter.isLimited(session.user.id)) {
    return { ok: false, error: 'Too many changes recently — please wait a few minutes and try again.' };
  }
  await updateMedicalOfficeLimiter.recordAttempt(session.user.id);

  const parsed = updateMedicalOfficeSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    const fieldErrors = Object.fromEntries(
      Object.entries(flattened)
        .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0)
        .map(([field, messages]) => [field, messages[0]!])
    );
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid facility details.',
      fieldErrors
    };
  }

  await updateMedicalOffice(officeId, parsed.data, session.user.id);

  revalidatePath('/doctors');
  revalidatePath(`/medical-offices/${officeId}`);
  redirect(`/medical-offices/${officeId}`);
}
