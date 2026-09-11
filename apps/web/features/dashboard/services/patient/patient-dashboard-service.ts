import type { CaseWithPatient } from '@ncb/database';
import { listCandidatesForUser } from '../../../candidates/services/candidates-service';
import type { CasePayload } from '../../../cases/services/cases-service';
import { listCasesForPatient } from '../../../cases/services/cases-service';

export type PatientCaseRow = CaseWithPatient<CasePayload>;

export interface PatientDashboardData {
  cases: PatientCaseRow[];
}

/**
 * Real, patient-scoped case query — replaces the PLACEHOLDER DATA
 * (features/dashboard/mock-data.ts's MOCK_PATIENT_CASES) the dashboard used
 * to render. `userId` is the signed-in AppUser id; a patient's actual cases
 * live under their linked PatientProfile id(s) (usually exactly one, but
 * looping handles the rare case of more than one profile pointing at the
 * same login).
 */
export async function getPatientDashboardData(userId: string): Promise<PatientDashboardData> {
  const candidates = await listCandidatesForUser(userId);
  const casesByCandidate = await Promise.all(candidates.map((candidate) => listCasesForPatient(candidate.id)));
  // A reviewer can pull a case out of the patient's queue without canceling it
  // (see cases-service.ts's setCaseHidden) — it's still fully visible/
  // actionable from the reviewer's own case workspace, just not here.
  const cases = casesByCandidate
    .flat()
    .filter((item) => !item.payload?.hidden)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return { cases };
}
