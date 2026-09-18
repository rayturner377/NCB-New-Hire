import { statusLabel } from '../../lib/status-labels';
import { derivedPaymentStatus } from './billing-status';
import type { CaseStatus } from './types';

/** Which stage a case entered the workflow at — set once, at creation (see cases-service.ts's createCase), not updated as the case moves. "patient" means HR sent it to the candidate first, to fill in their intake and pick a doctor themselves; "doctor" means HR assigned a doctor directly and skipped that step. */
export function caseRouteLabel(route: string): string {
  switch (route) {
    case 'patient':
      return 'Sent to patient first';
    case 'doctor':
      return 'Sent directly to doctor';
    default:
      return route;
  }
}

/**
 * Ported from server.js caseStageLabel (public/app.js ~L4681) — groups the granular status into
 * who's holding the ball. Once HR completes review there's nothing left in the medical-processing
 * sense (case-workflow.ts's isCaseClosed already treats 'reviewed' as closed for that reason), but
 * payment is a real, separate step that can still be outstanding — showing a flat "Completed" here
 * made a reviewed-but-unpaid case look like nothing was left to do. Folding payment in as the
 * lifecycle's actual last stage (paid/unpaid, via the same derivedPaymentStatus the billing report
 * already uses) instead of a parallel column keeps "Stage" answering one question — where does this
 * case sit right now — end to end.
 */
export function caseStageLabel(status: CaseStatus | string, paymentStatus: string | null): string {
  switch (status) {
    case 'draft':
      return 'HR creation';
    case 'sent_to_patient':
    case 'patient_completed':
      return 'Patient action';
    case 'sent_to_doctor':
    case 'review_pending':
      return 'Medical office action';
    case 'doctor_submitted':
      return 'HR review';
    case 'reviewed':
      return statusLabel(derivedPaymentStatus(status, paymentStatus));
    case 'canceled_by_doctor':
    case 'withdrawn':
    case 'archived':
      return 'Closed';
    default:
      return status;
  }
}
