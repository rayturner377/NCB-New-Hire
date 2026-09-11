import { redirect } from 'next/navigation';
import { NewSubmissionContainer } from '../../../../features/submissions/containers/new-submission-container';

export default async function NewSubmissionPage(
  props: {
    searchParams: Promise<{ caseId?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const caseId = searchParams.caseId;
  if (!caseId) {
    redirect('/cases');
  }

  return <NewSubmissionContainer caseId={caseId} />;
}
