import { PERMISSIONS, ROLES, hasPermission } from '../../lib/permissions';
import type { AuthenticatedSession } from '../../lib/session';
import { matchesClinicianAssignment } from './case-authorization';
import { hasDoctorSubmitted } from './services/cases-service';

/**
 * Everything case-detail-container.tsx's staff workspace needs to decide what to show/lock, derived
 * purely from the viewer and the case itself — no I/O, so it's cheap to compute once and pass down
 * rather than re-deriving hasPermission/matchesClinicianAssignment calls in three different tabs.
 */
export interface CaseWorkspaceCapabilities {
  canUpdateBilling: boolean;
  canViewBilling: boolean;
  canConfirmPayment: boolean;
  canTransition: boolean;
  canReassign: boolean;
  canHide: boolean;
  canUploadDocuments: boolean;
  /** Doctors (and their delegates) shouldn't see the audit trail while assessing/reviewing a case — History is an HR/admin oversight tool, not something relevant to the clinician's own workflow. */
  canViewHistory: boolean;
  /** Nor the role the candidate applied for — showing it to the examining clinician risks biasing the assessment toward (or against) fitness for that specific role. */
  hidePositionFromViewer: boolean;
  /** A separate policy decision from hidePositionFromViewer that happens to apply to the same roles today (doctor/delegate) — the patient's national ID isn't something the examining clinician needs, independent of any bias concern about the applied-for position. Keep these two named separately even though their values currently coincide, so a future change to one doesn't silently change the other. */
  hideNationalIdFromViewer: boolean;
  isPaid: boolean;
  /** Billing amount/status, exporting, and uploading a stamped copy all require a completed doctor assessment to mean anything — before then there's nothing to bill, nothing to print, and nothing to stamp. */
  doctorHasSubmitted: boolean;
  /** A case fresh off the doctor's desk still needs HR to actually look at it before billing/payment/export mean anything — see the Complete review action on the Billing & status tab, which is what clears this. */
  awaitingReview: boolean;
  billingLocked: boolean;
  billingLockedMessage: string | undefined;
  exportLockedMessage: string | undefined;
  uploadLockedMessage: string | undefined;
}

export function deriveCaseWorkspaceCapabilities(
  user: AuthenticatedSession['user'],
  medicalCase: { status: string; assignedClinicianId: string | null; paymentStatus: string | null }
): CaseWorkspaceCapabilities {
  const doctorHasSubmitted = hasDoctorSubmitted(medicalCase.status);
  const awaitingReview = medicalCase.status === 'doctor_submitted';
  const billingLocked = !doctorHasSubmitted || awaitingReview;

  return {
    canUpdateBilling: hasPermission(user, PERMISSIONS.MEDICAL_CASES_BILLING_UPDATE),
    // Read-only visibility into the payable amount — gated so a delegate's access to it can be
    // toggled per-account (see permissionOverrides) without changing what admin/reviewer/auditor/
    // doctor already see.
    canViewBilling: hasPermission(user, PERMISSIONS.MEDICAL_CASES_BILLING_VIEW),
    canConfirmPayment: hasPermission(user, PERMISSIONS.MEDICAL_CASES_PAYMENT_CONFIRM),
    canTransition: hasPermission(user, PERMISSIONS.MEDICAL_CASES_TRANSITION),
    canReassign: hasPermission(user, PERMISSIONS.MEDICAL_CASES_REASSIGN),
    canHide: hasPermission(user, PERMISSIONS.MEDICAL_CASES_HIDE),
    canUploadDocuments: hasPermission(user, PERMISSIONS.MEDICAL_CASES_ATTACH) && matchesClinicianAssignment(user, medicalCase),
    canViewHistory: user.role !== ROLES.DOCTOR && user.role !== ROLES.DELEGATE,
    hidePositionFromViewer: user.role === ROLES.DOCTOR || user.role === ROLES.DELEGATE,
    hideNationalIdFromViewer: user.role === ROLES.DOCTOR || user.role === ROLES.DELEGATE,
    isPaid: medicalCase.paymentStatus === 'paid',
    doctorHasSubmitted,
    awaitingReview,
    billingLocked,
    billingLockedMessage: !doctorHasSubmitted
      ? "Available once the doctor's assessment has been submitted — there's nothing to pay before then."
      : awaitingReview
        ? 'Complete review above before confirming payment.'
        : undefined,
    // Export is further gated even after the doctor submits — forces HR to mark the case reviewed
    // first — but this never blocks the doctor's own authoring page (DoctorCaseForm never renders
    // while a case is anything but sent_to_doctor, so this gate has no effect there).
    exportLockedMessage: !doctorHasSubmitted
      ? "Available once the doctor's assessment has been submitted — there's nothing to export before then."
      : awaitingReview
        ? 'Complete review on the Billing & status tab before exporting it.'
        : undefined,
    uploadLockedMessage: !doctorHasSubmitted
      ? "Available once the doctor's assessment has been submitted — there's nothing to stamp before then."
      : undefined
  };
}
