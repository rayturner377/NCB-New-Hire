import { redirect } from 'next/navigation';
import { Alert } from '../../../components/ui/alert';
import { PERMISSIONS, hasPermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { getCandidateById } from '../../candidates/services/candidates-service';
import { ownsCase } from '../../cases/case-authorization';
import type { CaseDocumentSummary } from '../../cases/components/case-documents/case-attachment-list';
import { caseTypeLabel } from '../../cases/case-types';
import { listCaseAttachments } from '../../cases/services/case-attachments-service';
import { getCaseById } from '../../cases/services/cases-service';
import { listActiveDoctors } from '../../users/services/users-service';
import { DoctorCaseForm } from '../components/doctor-case-form/doctor-case-form';
import { SubmissionAlreadyRecordedNotice } from '../components/doctor-case-form/submission-already-recorded-notice';
import { submissionToDraft } from '../components/doctor-case-form/submission-to-draft';
import type { DoctorAssessmentDraft } from '../components/doctor-case-form/types';
import { listSubmissionsForCase } from '../services/submissions-service';

/** Statuses that mean this doctor's assessment already went through — see the status guard below. */
const ALREADY_SUBMITTED_STATUSES = new Set(['doctor_submitted', 'reviewed', 'archived', 'withdrawn', 'canceled_by_doctor']);

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
      <div className="flex flex-col gap-4 p-6">
        <Alert tone="error">That case could not be found.</Alert>
      </div>
    );
  }

  // SUBMISSIONS_CREATE is granted to every clinician, not just this case's assigned doctor —
  // without this, any doctor could open and complete another doctor's assessment by guessing/
  // incrementing a case id, the same class of bug fixed for /cases/[id] (see case-detail-container.tsx).
  if (!ownsCase(session.user, medicalCase)) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Alert tone="error">That case could not be found.</Alert>
      </div>
    );
  }

  const candidate = await getCandidateById(medicalCase.patientId);
  if (!candidate) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Alert tone="error">The candidate for this case could not be found.</Alert>
      </div>
    );
  }

  if (medicalCase.status !== 'sent_to_doctor') {
    // Covers both "I just submitted this" (see doctor-case-form.tsx's comment on why that
    // component can't show its own success dialog) and a stale link to a case someone else
    // already finished — either way the assessment is done, so this reads as confirmation
    // rather than an error.
    if (ALREADY_SUBMITTED_STATUSES.has(medicalCase.status)) {
      return <SubmissionAlreadyRecordedNotice candidateName={candidate.fullName} />;
    }
    return (
      <div className="flex flex-col gap-4 p-6">
        <Alert tone="info">
          This case is not currently awaiting a doctor assessment (status: {medicalCase.status}).
        </Alert>
      </div>
    );
  }

  const [doctors, existingAttachments, existingSubmissions] = await Promise.all([
    listActiveDoctors(),
    listCaseAttachments(caseId),
    listSubmissionsForCase(caseId)
  ]);
  const latestSubmission = existingSubmissions[0] ?? null;
  const persistedDraft = (medicalCase.payload?.doctorAssessmentDraft ?? {}) as DoctorAssessmentDraft;

  // A case sent back to the doctor stage always clears doctorAssessmentDraft at the moment of
  // submission (see create-submission.ts) — so by the time it's reopened, `persistedDraft` is only
  // ever non-empty if THIS doctor already started editing since then. When it's empty and this is
  // the same doctor who submitted last time (a case bounced back for revision, not reassigned to
  // someone new), resume from that submission instead of a blank form — reassigned to a different
  // doctor, `latestSubmission.submittedBy` won't match, so they still start fresh with their own
  // assessment rather than a copy of the previous doctor's. The instant this doctor changes
  // anything, autosave persists a real draft (save-submission-draft.ts) and this fallback stops
  // applying — the persisted draft wins from then on, until this doctor submits again and the
  // whole cycle (clear, then maybe reseed from that new submission) restarts.
  const hasPersistedDraft = Object.keys(persistedDraft).length > 0;
  const savedDraft =
    !hasPersistedDraft && latestSubmission && latestSubmission.submittedBy === session.user.id
      ? submissionToDraft(latestSubmission)
      : persistedDraft;

  const attachments: CaseDocumentSummary[] = existingAttachments.map((attachment) => ({
    id: attachment.id,
    originalName: attachment.originalName,
    byteSize: Number(attachment.byteSize),
    createdAt: attachment.createdAt.toISOString(),
    uploaderName: attachment.uploadedBy === session.user.id ? session.user.displayName : 'Unknown user',
    canDelete: attachment.uploadedBy === session.user.id
  }));

  // Physician identity/facility rarely change case to case — pre-fill from the doctor's own
  // profile (set up when their account was created, see lib/medical-profile.ts) so they aren't
  // retyping it every time, but a saved draft's own values (if this doctor already edited them
  // for this case) still win.
  const medicalProfile = session.user.medicalProfile as
    | { facilityName?: string; facilityAddress?: string; registrationNumber?: string }
    | null;
  const draft: DoctorAssessmentDraft = {
    ...savedDraft,
    assessment: {
      facilityName: medicalProfile?.facilityName ?? '',
      facilityAddress: medicalProfile?.facilityAddress ?? '',
      clinicianName: session.user.displayName,
      clinicianRegistrationNumber: medicalProfile?.registrationNumber ?? '',
      emailAddress: session.user.email,
      ...savedDraft.assessment
    }
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <DoctorCaseForm
        caseId={medicalCase.id}
        caseVersion={medicalCase.version}
        candidate={candidate}
        caseTypeLabel={caseTypeLabel(medicalCase.payload?.caseType)}
        patientCaseData={medicalCase.payload?.patientCaseData ?? null}
        submission={latestSubmission}
        doctors={doctors}
        draft={draft}
        attachments={attachments}
      />
    </div>
  );
}
