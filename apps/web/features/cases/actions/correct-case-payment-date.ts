'use server';

import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { PERMISSIONS, requirePermission, ForbiddenError } from '../../../lib/permissions';
import { requireFullSession } from '../../../lib/session';
import { correctCasePaymentDate, getCaseById } from '../services/cases-service';

export interface CorrectCasePaymentDateResult {
  ok: boolean;
  error?: string;
}

/**
 * Fixes a wrong payment date on an already-paid case — the only way to change it before this was
 * an undocumented side-channel (flip "Payment status" back to unpaid on the billing form, which
 * silently un-locks the confirm-payment form again, with no distinct record that it was a
 * correction rather than a fresh confirmation). Same permission as confirming payment in the first
 * place (MEDICAL_CASES_PAYMENT_CONFIRM) — a reason is required so the audit trail says why the
 * date changed, not just that it did.
 */
export async function correctCasePaymentDateAction(
  _prevState: CorrectCasePaymentDateResult | null,
  formData: FormData
): Promise<CorrectCasePaymentDateResult> {
  await assertSameOrigin();

  const session = await requireFullSession();
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
  const reason = String(formData.get('reason') || '').trim();
  if (!caseId || !paidOn) {
    return { ok: false, error: 'Choose the corrected payment date.' };
  }
  if (!reason) {
    return { ok: false, error: 'Explain why the payment date is being corrected.' };
  }

  // Mirrors the greyed-out state case-payment-summary.tsx only renders once paid — enforced here
  // too so it can't be bypassed by posting directly to this action.
  const medicalCase = await getCaseById(caseId);
  if (!medicalCase || medicalCase.paymentStatus !== 'paid') {
    return { ok: false, error: 'This case has not been marked paid yet — there is no payment date to correct.' };
  }

  await correctCasePaymentDate(caseId, paidOn, reason, session.user.id);

  revalidatePath(`/cases/${caseId}`);
  revalidatePath('/cases');
  return { ok: true };
}
