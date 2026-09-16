'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { createActionRateLimiter } from '../../../lib/action-rate-limit';
import { fieldErrorsFrom } from '../../../lib/field-errors';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../lib/permissions';
import { requireFullSession } from '../../../lib/session';
import { createMedicalOfficeSchema } from '../schemas/medical-office';
import { createMedicalOffice } from '../services/medical-offices-service';

export interface MedicalOfficeActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/** 10 per 15 minutes per admin — medical offices are created rarely; a tight limit is appropriate. */
const createMedicalOfficeLimiter = createActionRateLimiter('create-medical-office', 10, 15 * 60 * 1000);

export async function createMedicalOfficeAction(
  _prevState: MedicalOfficeActionResult | null,
  formData: FormData
): Promise<MedicalOfficeActionResult> {
  await assertSameOrigin();

  const session = await requireFullSession();
  if (!session) {
    return { ok: false, error: 'Your session has expired. Please sign in again.' };
  }

  try {
    requirePermission(session.user, PERMISSIONS.MEDICAL_OFFICES_CREATE);
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    throw error;
  }

  if (await createMedicalOfficeLimiter.isLimited(session.user.id)) {
    return { ok: false, error: 'Too many facilities created recently — please wait a few minutes and try again.' };
  }
  await createMedicalOfficeLimiter.recordAttempt(session.user.id);

  const parsed = createMedicalOfficeSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid facility details.',
      fieldErrors: fieldErrorsFrom(parsed.error)
    };
  }

  await createMedicalOffice(parsed.data, session.user.id);

  revalidatePath('/doctors');
  redirect('/doctors?tab=offices');
}
