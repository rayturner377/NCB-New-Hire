'use client';

import { useRouter } from 'nextjs-toploader/app';
import { ActionSuccessDialog } from '../../../../components/feedback/action-success-dialog';

export interface SubmissionAlreadyRecordedNoticeProps {
  candidateName: string;
}

/**
 * What a doctor sees at /submissions/new?caseId=... once that case has
 * already moved past sent_to_doctor — whether they just submitted it a
 * moment ago (see new-submission-container.tsx's status check, and
 * doctor-case-form.tsx's comment on why the dialog can't live there) or
 * they're revisiting a stale link to a case someone else already handled.
 * Always open, with nowhere else this page can go but back to their cases.
 */
export function SubmissionAlreadyRecordedNotice({ candidateName }: SubmissionAlreadyRecordedNoticeProps) {
  const router = useRouter();
  return (
    <ActionSuccessDialog
      open
      title="Assessment submitted"
      description={`The medical assessment for ${candidateName} has been submitted for HR review.`}
      confirmLabel="Back to cases"
      onConfirm={() => router.push('/cases')}
    />
  );
}
