import { ROLES } from '../../lib/permissions';
import { listCandidatesForUser } from './services/candidates-service';

/**
 * Whether the given user may view/edit this specific candidate profile —
 * PATIENT_PROFILES_LIST/UPDATE are role-wide grants a patient also holds (so
 * they can reach their own record), so any page that loads one candidate by
 * id still needs this check for the patient role specifically. Extracted
 * from the same scoping candidates-container.tsx already applies to its own
 * list view (session.user.role === 'patient' ? listCandidatesForUser(...) :
 * listCandidates()) — this is the single-record equivalent of that.
 *
 * Non-patient roles (admin/reviewer/auditor) are intentionally NOT scoped
 * here — their access is already gated by the coarser permission check and
 * isn't meant to be limited to "candidates linked to me."
 */
export async function ownsCandidate(user: { role: string; id: string }, candidateId: string): Promise<boolean> {
  if (user.role !== ROLES.PATIENT) return true;
  const ownCandidates = await listCandidatesForUser(user.id);
  return ownCandidates.some((candidate) => candidate.id === candidateId);
}
