import { ROLES } from '../../lib/permissions';
import { listCandidatesForUser } from '../candidates/services/candidates-service';

/**
 * Whether the given user may act on this specific case — not "does this role
 * generally hold the permission" (that's a separate, coarser check via
 * hasPermission/requirePermission), but "is this the one clinician actually
 * assigned to it." A clinician's SUBMISSIONS_CREATE/MEDICAL_CASES_* grants
 * are role-wide, so every action that touches one specific case still needs
 * this check — see save-submission-draft.ts, upload/delete-case-attachment.ts,
 * and case-detail-container.tsx for the pattern this was extracted from.
 *
 * Non-clinician roles (admin/reviewer/auditor) are intentionally NOT scoped
 * here — their access to a case is already gated by the coarser permission
 * check and isn't meant to be limited to "cases assigned to me."
 */
export function ownsCase(user: { role: string; id: string }, medicalCase: { assignedClinicianId: string | null }): boolean {
  if (user.role !== ROLES.DOCTOR) return true;
  return medicalCase.assignedClinicianId === user.id;
}

/**
 * The patient-side equivalent of ownsCase — a patient's MEDICAL_CASES_LIST/
 * UPDATE grants are role-wide too, so anything that lets a patient act on
 * "their" case still needs to confirm the case's patientId is actually one
 * of their own linked candidates. Extracted from case-detail-container.tsx's
 * patient branch and save-patient-case.ts, which had the same check
 * duplicated with slightly different shapes.
 */
export async function patientOwnsCase(userId: string, medicalCase: { patientId: string }): Promise<boolean> {
  const ownCandidates = await listCandidatesForUser(userId);
  return ownCandidates.some((candidate) => candidate.id === medicalCase.patientId);
}
