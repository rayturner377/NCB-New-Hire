'use server';

import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { updateCandidate } from '../services/candidates-service';

/** A plain, no-JS-required form action (candidate id + clinician come from hidden/select fields). */
export async function assignCandidateAction(formData: FormData): Promise<void> {
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
  const assignedClinicianId = String(formData.get('assignedClinicianId') || '');
  const assignedClinicianName = String(formData.get('assignedClinicianName') || '');
  if (!candidateId || !assignedClinicianId) return;

  await updateCandidate(candidateId, { assignedClinicianId, assignedClinicianName });
  revalidatePath('/candidates');
}
