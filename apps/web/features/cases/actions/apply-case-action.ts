'use server';

import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../lib/permissions';
import { requireFullSession } from '../../../lib/session';
import { listActiveDoctors } from '../../users/services/users-service';
import { findCaseAction } from '../case-transitions';
import { getCaseById, reassignClinician, transitionCase } from '../services/cases-service';

export interface ApplyCaseActionResult {
  ok: boolean;
  error?: string;
}

/**
 * The "Case actions" menu's single entry point — validates the requested
 * move against case-transitions.ts's rule set (server-side, not just a
 * disabled button client-side) before doing anything, so a stale page or a
 * hand-crafted request can't apply a move that's no longer legal for the
 * case's current status. When the chosen action requires a doctor (sending
 * to the doctor stage, whether that's the first hand-off or a return trip),
 * the doctor is reassigned first and the status transition second — two
 * audit entries rather than one combined one, which reads more clearly on
 * the History tab ("doctor changed", then "status changed") than a single
 * entry trying to describe both at once.
 */
export async function applyCaseActionAction(
  _prevState: ApplyCaseActionResult | null,
  formData: FormData
): Promise<ApplyCaseActionResult> {
  await assertSameOrigin();

  const session = await requireFullSession();
  if (!session) {
    return { ok: false, error: 'Your session has expired. Please sign in again.' };
  }

  try {
    requirePermission(session.user, PERMISSIONS.MEDICAL_CASES_TRANSITION);
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    throw error;
  }

  const caseId = String(formData.get('caseId') || '');
  const expectedVersion = Number.parseInt(String(formData.get('version') || ''), 10);
  const actionId = String(formData.get('actionId') || '');
  if (!caseId || !Number.isFinite(expectedVersion) || !actionId) {
    return { ok: false, error: 'Missing case reference.' };
  }

  const medicalCase = await getCaseById(caseId);
  if (!medicalCase) {
    return { ok: false, error: 'Case not found.' };
  }

  const action = findCaseAction(medicalCase.status, session.user.role, actionId, medicalCase.paymentStatus === 'paid');
  if (!action) {
    return { ok: false, error: 'That action is no longer available for this case.' };
  }

  let reason: string | undefined;
  if (action.requiresReason) {
    reason = String(formData.get('reason') || '').trim();
    if (!reason) {
      return { ok: false, error: 'Explain why you’re reopening this case.' };
    }
  }

  if (action.requiresDoctor) {
    const clinicianId = String(formData.get('clinicianId') || '');
    if (!clinicianId) {
      return { ok: false, error: 'Choose a doctor.' };
    }
    const doctors = await listActiveDoctors();
    if (!doctors.some((doctor) => doctor.id === clinicianId)) {
      return { ok: false, error: 'Choose an active doctor.' };
    }
    await reassignClinician(caseId, clinicianId, session.user.id);
  }

  await transitionCase(caseId, expectedVersion, action.targetStatus, session.user.id, reason);

  revalidatePath(`/cases/${caseId}`);
  revalidatePath('/cases');
  return { ok: true };
}
