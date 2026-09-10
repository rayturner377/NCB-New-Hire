'use server';

import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { PERMISSIONS, requirePermission, ForbiddenError } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { confirmCasePayment, getCaseById, hasDoctorSubmitted } from '../services/cases-service';

export interface ConfirmCasePaymentResult {
  ok: boolean;
  error?: string;
}

/**
 * Marks a case as paid — the review queue's own exit condition (see
 * cases-service.ts's listReviewQueueCases/confirmCasePayment). Deliberately
 * its own action, gated by MEDICAL_CASES_PAYMENT_CONFIRM rather than
 * MEDICAL_CASES_BILLING_UPDATE (admin-only, for adjusting the billed amount
 * itself) — a reviewer routinely confirming payments shouldn't need the
 * broader billing-edit permission to do it.
 */
export async function confirmCasePaymentAction(
  _prevState: ConfirmCasePaymentResult | null,
  formData: FormData
): Promise<ConfirmCasePaymentResult> {
  await assertSameOrigin();

  const session = await getSession();
  if (!session) {
    return { ok: false, error: 'Your session has expired. Please sign in again.' };
  }

  try {
    requirePermission(session.user, PERMISSIONS.MEDICAL_CASES_PAYMENT_CONFIRM);
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    throw error;
  }

  const caseId = String(formData.get('caseId') || '');
  const paidOn = String(formData.get('paidOn') || '');
  if (!caseId || !paidOn) {
    return { ok: false, error: 'Choose the date the payment was made.' };
  }

  // Mirrors the greyed-out state CasePaymentConfirmation renders — enforced
  // here too so it can't be bypassed by posting directly to this action.
  const medicalCase = await getCaseById(caseId);
  if (!medicalCase || !hasDoctorSubmitted(medicalCase.status)) {
    return { ok: false, error: "This case can't be marked paid until the doctor has submitted their assessment." };
  }
  if (medicalCase.status === 'doctor_submitted') {
    return { ok: false, error: 'Complete review before confirming payment.' };
  }

  await confirmCasePayment(caseId, paidOn, session.user.id);

  revalidatePath(`/cases/${caseId}`);
  revalidatePath('/cases');
  return { ok: true };
}
