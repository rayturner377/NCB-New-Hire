'use server';

import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { listActiveDoctors } from '../../users/services/users-service';
import { getCaseById, reassignClinician } from '../services/cases-service';

export interface ReassignClinicianResult {
  ok: boolean;
  error?: string;
}

/**
 * Changes which doctor a case is assigned to, without moving its stage —
 * only valid while the case is still sitting untouched in a doctor's inbox
 * (`sent_to_doctor`). Once a doctor has actually submitted an assessment,
 * swapping doctors is a stage move instead (see actions/apply-case-action.ts's
 * "Send to doctor" action, which reassigns and transitions together).
 */
export async function reassignClinicianAction(
  _prevState: ReassignClinicianResult | null,
  formData: FormData
): Promise<ReassignClinicianResult> {
  await assertSameOrigin();

  const session = await getSession();
  if (!session) {
    return { ok: false, error: 'Your session has expired. Please sign in again.' };
  }

  try {
    requirePermission(session.user, PERMISSIONS.MEDICAL_CASES_REASSIGN);
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    throw error;
  }

  const caseId = String(formData.get('caseId') || '');
  const clinicianId = String(formData.get('clinicianId') || '');
  if (!caseId || !clinicianId) {
    return { ok: false, error: 'Choose a doctor to reassign this case to.' };
  }

  const medicalCase = await getCaseById(caseId);
  if (!medicalCase) {
    return { ok: false, error: 'Case not found.' };
  }
  if (medicalCase.status !== 'sent_to_doctor') {
    return { ok: false, error: 'This case can only be reassigned while it’s still waiting on the doctor to start.' };
  }

  const doctors = await listActiveDoctors();
  if (!doctors.some((doctor) => doctor.id === clinicianId)) {
    return { ok: false, error: 'Choose an active doctor.' };
  }

  await reassignClinician(caseId, clinicianId, session.user.id);

  revalidatePath(`/cases/${caseId}`);
  revalidatePath('/cases');
  return { ok: true };
}
