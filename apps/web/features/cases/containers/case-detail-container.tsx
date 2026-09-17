import { redirect } from 'next/navigation';
import { listCandidatesForUser } from '../../candidates/services/candidates-service';
import { PatientCaseWorkspace } from '../components/patient-case-workspace';
import { StaffCaseWorkspace } from '../components/staff-case-workspace';
import { matchesClinicianAssignment } from '../case-authorization';
import { logAccessDenied } from '../../../lib/audit-access';
import { PERMISSIONS, hasPermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { getCaseWithPatientById } from '../services/cases-service';

export interface CaseDetailContainerProps {
  caseId: string;
}

/**
 * Authorizes the viewer against this specific case, then hands off to whichever workspace applies —
 * a patient only ever sees their own intake form (PatientCaseWorkspace); every other role lands on
 * the full adaptive workspace (StaffCaseWorkspace), scoped by deriveCaseWorkspaceCapabilities there.
 */
export async function CaseDetailContainer({ caseId }: CaseDetailContainerProps) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  if (!hasPermission(session.user, PERMISSIONS.MEDICAL_CASES_LIST)) {
    redirect('/');
  }

  const medicalCase = await getCaseWithPatientById(caseId);

  // MEDICAL_CASES_LIST is a broad "can see cases" permission that a patient
  // also holds (for their own dashboard) — without this, any patient could
  // view any other patient's case (name, DOB, contact info) just by knowing
  // its id, since the permission check above doesn't imply ownership.
  if (session.user.role === 'patient') {
    const ownCandidates = await listCandidatesForUser(session.user.id);
    const ownCandidate = medicalCase ? ownCandidates.find((candidate) => candidate.id === medicalCase.patientId) : undefined;
    if (!medicalCase || !ownCandidate) {
      return (
        <div className="p-6">
          <p className="text-sm text-muted-foreground">Case not found.</p>
        </div>
      );
    }

    return <PatientCaseWorkspace medicalCase={medicalCase} candidate={ownCandidate} />;
  }

  if (!medicalCase) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Case not found.</p>
      </div>
    );
  }

  // Same reasoning as the patient branch above: MEDICAL_CASES_LIST is a broad "can see cases"
  // permission a clinician also holds, but that must not mean "any case in the system" — without
  // this, a doctor could open another doctor's assigned case (full candidate PII, family/medical
  // history) just by guessing/incrementing a case id.
  if (!matchesClinicianAssignment(session.user, medicalCase)) {
    await logAccessDenied({
      userId: session.user.id,
      role: session.user.role,
      permission: PERMISSIONS.MEDICAL_CASES_LIST,
      path: '/cases',
      entityId: caseId
    });
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Case not found.</p>
      </div>
    );
  }

  return <StaffCaseWorkspace medicalCase={medicalCase} user={session.user} />;
}
