'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { createActionRateLimiter } from '../../../lib/action-rate-limit';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { createMedicalOfficeSchema } from '../schemas/medical-office';
import { createMedicalOffice } from '../services/medical-offices-service';

export interface MedicalOfficeActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/** 10 per 15 minutes per admin — medical offices are created rarely; a tight limit is appropriate. */
const createMedicalOfficeLimiter = createActionRateLimiter(10, 15 * 60 * 1000);

export async function createMedicalOfficeAction(
  _prevState: MedicalOfficeActionResult | null,
  formData: FormData
): Promise<MedicalOfficeActionResult> {
  await assertSameOrigin();

  const session = await getSession();
  if (!session) {
    return { ok: false, error: 'Your session has expired. Please sign in again.' };
  }

  try {
    requirePermission(session.user, PERMISSIONS.MEDICAL_OFFICES_CREATE);
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    throw error;
  }

  if (createMedicalOfficeLimiter.isLimited(session.user.id)) {
    return { ok: false, error: 'Too many facilities created recently — please wait a few minutes and try again.' };
  }
  createMedicalOfficeLimiter.recordAttempt(session.user.id);

  const parsed = createMedicalOfficeSchema.safeParse(Object.fromEntries(formData.entries()));
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

  await createMedicalOffice(parsed.data);

  revalidatePath('/doctors');
  redirect('/doctors?tab=offices');
}
