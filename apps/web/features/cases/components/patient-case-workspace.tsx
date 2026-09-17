import { listActiveDoctors } from '../../users/services/users-service';
import type { CandidatePayload } from '../../candidates/types';
import { buildPatientIntakeDefaults } from '../patient-intake-defaults';
import { getCaseWithPatientById } from '../services/cases-service';
import { PatientCaseForm } from './patient-case-form/patient-case-form';

export interface PatientCaseWorkspaceProps {
  medicalCase: NonNullable<Awaited<ReturnType<typeof getCaseWithPatientById>>>;
  candidate: CandidatePayload;
}

/** The patient's own view of their case — just their intake form, pre-filled from whatever HR already collected on their candidate profile (see patient-intake-defaults.ts), editable only while the case is actually sitting with them. */
export async function PatientCaseWorkspace({ medicalCase, candidate }: PatientCaseWorkspaceProps) {
  const doctors = await listActiveDoctors();
  const data = buildPatientIntakeDefaults(candidate, medicalCase.payload?.patientCaseData);

  return (
    <div className="flex flex-col gap-4 p-6">
      <PatientCaseForm
        caseId={medicalCase.id}
        version={medicalCase.version}
        data={data}
        employeeId={candidate.employeeId}
        email={candidate.email}
        doctors={doctors}
        readOnly={medicalCase.status !== 'sent_to_patient'}
      />
    </div>
  );
}
