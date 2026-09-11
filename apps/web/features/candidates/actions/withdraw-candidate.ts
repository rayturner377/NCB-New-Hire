'use server';

import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { updateCandidate } from '../services/candidates-service';

export async function withdrawCandidateAction(formData: FormData): Promise<void> {
  await assertSameOrigin();

  const session = await getSession();
  if (!session) return;

  try {
    requirePermission(session.user, PERMISSIONS.PATIENT_PROFILES_UPDATE);
  } catch (error) {
    if (error instanceof ForbiddenError) return;
    throw error;
  }

  const candidateId = String(formData.get('candidateId') || '');
  const withdrawalReason = String(formData.get('withdrawalReason') || '');
  if (!candidateId) return;

  await updateCandidate(candidateId, { status: 'withdrawn', withdrawalReason });
  revalidatePath('/candidates');
}
