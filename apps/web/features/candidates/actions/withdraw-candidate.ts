'use server';

import { revalidatePath } from 'next/cache';
import { auditRepository } from '@ncb/database';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../lib/permissions';
import { requireFullSession } from '../../../lib/session';
import { requireOwnsCandidate } from '../candidate-authorization';
import { updateCandidate } from '../services/candidates-service';

export async function withdrawCandidateAction(formData: FormData): Promise<void> {
  await assertSameOrigin();

  const session = await requireFullSession();
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

  try {
    await requireOwnsCandidate(session.user, candidateId);
  } catch (error) {
    if (error instanceof ForbiddenError) return;
    throw error;
  }

  await updateCandidate(candidateId, { status: 'withdrawn', withdrawalReason });

  await auditRepository.append({
    eventType: 'candidate_withdrawn',
    actorUserId: session.user.id,
    entityType: 'candidate',
    entityId: candidateId,
    details: { withdrawalReason }
  });

  revalidatePath('/candidates');
}
