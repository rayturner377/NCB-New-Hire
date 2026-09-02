'use server';

import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { createCandidateSchema } from '../schemas/candidate';
import { createCandidate } from '../services/candidates-service';

export interface CandidateActionResult {
  ok: boolean;
  error?: string;
}

export async function createCandidateAction(
  _prevState: CandidateActionResult | null,
  formData: FormData
): Promise<CandidateActionResult> {
  await assertSameOrigin();

  const session = await getSession();
  if (!session) {
    return { ok: false, error: 'Your session has expired. Please sign in again.' };
  }

  try {
    requirePermission(session.user, PERMISSIONS.PATIENT_PROFILES_CREATE);
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    throw error;
  }

  const parsed = createCandidateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid candidate details.' };
  }

  await createCandidate({
    ...parsed.data,
    createdBy: session.user.id,
    createdByName: session.user.displayName
  });

  revalidatePath('/candidates');
  return { ok: true };
}
