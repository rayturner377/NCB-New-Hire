'use server';

import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../lib/permissions';
import { requireFullSession } from '../../../lib/session';
import { isBillingStatus } from '../billing-status';
import { getCaseById, hasDoctorSubmitted, setCaseBilling } from '../services/cases-service';

/**
 * Admin/reviewer override of a case's billed amount/status — separate from
 * the automatic snapshot create-submission.ts takes at doctor-submission
 * time. Gated on MEDICAL_CASES_BILLING_UPDATE, which (unlike
 * MEDICAL_CASES_UPDATE) doctors don't hold — they can move a case forward
 * but not change what it's billed for.
 */
export async function updateCaseBillingAction(formData: FormData): Promise<void> {
  await assertSameOrigin();

  const session = await requireFullSession();
  if (!session) return;

  try {
    requirePermission(session.user, PERMISSIONS.MEDICAL_CASES_BILLING_UPDATE);
  } catch (error) {
    if (error instanceof ForbiddenError) return;
    throw error;
  }

  const caseId = String(formData.get('caseId') || '');
  if (!caseId) return;

  // Mirrors the greyed-out state case-workspace-capabilities.ts's billingLocked renders — nothing
  // to bill before the doctor submits, billing stays locked until HR actually completes review, and
  // (once paid) locked again so this generic form can't be used to silently flip payment_status
  // back to 'unpaid' as a side-channel around the reason-required reopen action (case-transitions.ts)
  // or the dedicated payment-date correction (correct-case-payment-date.ts) — enforced here too so
  // none of that can be bypassed by posting directly to this action.
  const medicalCase = await getCaseById(caseId);
  if (
    !medicalCase ||
    !hasDoctorSubmitted(medicalCase.status) ||
    medicalCase.status === 'doctor_submitted' ||
    medicalCase.paymentStatus === 'paid'
  ) {
    return;
  }

  const paymentStatus = String(formData.get('paymentStatus') || '');
  if (!isBillingStatus(paymentStatus)) return;

  const payableAmountRaw = String(formData.get('payableAmount') || '').trim();
  const payableAmount = payableAmountRaw === '' ? null : Number(payableAmountRaw);
  if (payableAmount !== null && (!Number.isFinite(payableAmount) || payableAmount < 0)) return;

  await setCaseBilling(caseId, payableAmount, paymentStatus, session.user.id);
  revalidatePath(`/cases/${caseId}`);
  revalidatePath('/cases');
}
