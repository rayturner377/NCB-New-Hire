import type { SubmissionPayload } from '../../types';
import type { DoctorAssessmentDraft } from './types';

function toStringRecord(record: Record<string, string | boolean>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, typeof value === 'boolean' ? String(value) : value]));
}

/**
 * Reshapes a finalized submission back into the loose draft shape the
 * editable doctor tabs expect (vitals/physicalExam merged, the rest mapped
 * 1:1 — see types.ts's DoctorAssessmentDraft) — the field names and
 * groupings are otherwise identical by design (see cases-service.ts's
 * CasePayload comment). Used two ways: read-only, by submission-viewer.tsx,
 * to show a completed submission through the same tabs the doctor filled
 * them in with; and as a resume-editing seed, by new-submission-container.tsx,
 * when a case is sent back to the SAME doctor who submitted it — see that
 * file's comment on when this applies versus when a doctor starts blank.
 */
export function submissionToDraft(submission: SubmissionPayload): DoctorAssessmentDraft {
  return {
    assessment: submission.assessment,
    physicalExam: toStringRecord({ ...submission.vitals, ...submission.physicalExam }),
    labResults: toStringRecord(submission.labResults),
    determination: submission.determination,
    attestation: submission.attestation
  };
}
