'use server';

import { revalidatePath } from 'next/cache';
import { auditRepository } from '@ncb/database';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../lib/permissions';
import { requireFullSession } from '../../../lib/session';
import { requireOwnsCandidate } from '../candidate-authorization';
import { updateCandidate } from '../services/candidates-service';

/** A plain, no-JS-required form action (candidate id + clinician come from hidden/select fields). */
export async function assignCandidateAction(formData: FormData): Promise<void> {
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
  const assignedClinicianId = String(formData.get('assignedClinicianId') || '');
  const assignedClinicianName = String(formData.get('assignedClinicianName') || '');
  if (!candidateId || !assignedClinicianId) return;

  try {
    await requireOwnsCandidate(session.user, candidateId);
  } catch (error) {
    if (error instanceof ForbiddenError) return;
    throw error;
  }

  await updateCandidate(candidateId, { assignedClinicianId, assignedClinicianName });

  await auditRepository.append({
    eventType: 'candidate_clinician_assigned',
    actorUserId: session.user.id,
    entityType: 'candidate',
    entityId: candidateId,
    details: { assignedClinicianId, assignedClinicianName }
  });

  revalidatePath('/candidates');
}
