import { redirect } from 'next/navigation';
import { Alert } from '../../../components/ui/alert';
import { Card } from '../../../components/ui/card';
import { PERMISSIONS, hasPermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { getCandidateById } from '../../candidates/services/candidates-service';
import { getCaseById } from '../../cases/services/cases-service';
import { SubmissionForm } from '../components/submission-form';

export interface NewSubmissionContainerProps {
  caseId: string;
}

export async function NewSubmissionContainer({ caseId }: NewSubmissionContainerProps) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  if (!hasPermission(session.user, PERMISSIONS.SUBMISSIONS_CREATE)) {
    redirect('/cases');
  }

  const medicalCase = await getCaseById(caseId);
  if (!medicalCase) {
    return (
      <div className="submission-page">
        <Alert tone="error">That case could not be found.</Alert>
      </div>
    );
  }

  if (medicalCase.status !== 'sent_to_doctor') {
    return (
      <div className="submission-page">
        <Alert tone="info">
          This case is not currently awaiting a doctor assessment (status: {medicalCase.status}).
        </Alert>
      </div>
    );
  }

  const candidate = await getCandidateById(medicalCase.patientId);
  if (!candidate) {
    return (
      <div className="submission-page">
        <Alert tone="error">The candidate for this case could not be found.</Alert>
      </div>
    );
  }

  return (
    <div className="submission-page">
      <h1>Complete medical assessment</h1>
      <Card>
        <SubmissionForm caseId={medicalCase.id} caseVersion={medicalCase.version} candidate={candidate} />
      </Card>
    </div>
  );
}
