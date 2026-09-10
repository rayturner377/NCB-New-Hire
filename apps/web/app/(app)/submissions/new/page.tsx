import { redirect } from 'next/navigation';
import { NewSubmissionContainer } from '../../../../features/submissions/containers/new-submission-container';

export default function NewSubmissionPage({
  searchParams
}: {
  searchParams: { caseId?: string };
}) {
  const caseId = searchParams.caseId;
  if (!caseId) {
    redirect('/cases');
  }

  return <NewSubmissionContainer caseId={caseId} />;
}
