'use client';

import { useState } from 'react';
import { TabbedFormShell, type TabbedFormShellTab } from '../../../components/form/tabbed-form-shell';
import { AssessmentTab } from './doctor-case-form/assessment-tab';
import { DeterminationAttestationTab } from './doctor-case-form/determination-attestation-tab';
import { PhysicalExaminationTab } from './doctor-case-form/physical-examination-tab';
import { submissionToDraft } from './doctor-case-form/submission-to-draft';
import type { SubmissionPayload } from '../types';

export interface SubmissionViewerProps {
  submission: SubmissionPayload;
  /** From the patient's own intake (personalInfo.sex) — same reasoning as doctor-case-form.tsx's own use of PhysicalExaminationTab: Pregnancy test only applies to female candidates, so it's left off entirely for a male patient rather than shown blank. */
  patientSex?: string;
}

const NOOP = () => {};

const TAB_ORDER = ['assessment', 'exam', 'determination'] as const;
type TabValue = (typeof TAB_ORDER)[number];

/**
 * Read-only rendering of a doctor's assessment submission — reuses the exact
 * same tab components the doctor filled these in with (AssessmentTab/
 * PhysicalExaminationTab/DeterminationAttestationTab, each taking a
 * `disabled` prop for this) rather than a hand-rolled summary layout, the
 * same reasoning PatientCaseReadOnlyView already applies on the patient's
 * side: this can never silently drift out of sync with what the doctor
 * actually filled in and sees. Same 3-tab shape as the doctor's own
 * authoring form (Assessment / Physical examination / Determination &
 * attestation, see doctor-case-form.tsx) so a reviewer sees the submission
 * organized exactly the way the doctor entered it.
 *
 * `submission` is the finalized, validated shape (see submissions/types.ts)
 * rather than the loose DoctorAssessmentDraft the editable tabs expect —
 * submissionToDraft reshapes it to match.
 */
export function SubmissionViewer({ submission, patientSex }: SubmissionViewerProps) {
  const [tab, setTab] = useState<TabValue>('assessment');

  const draft = submissionToDraft(submission);

  const tabs: TabbedFormShellTab[] = [
    {
      key: 'assessment',
      label: 'Assessment',
      content: <AssessmentTab draft={draft} onFieldChange={NOOP} disabled />
    },
    {
      key: 'exam',
      label: 'Physical examination',
      content: <PhysicalExaminationTab draft={draft} patientSex={patientSex} disabled />
    },
    {
      key: 'determination',
      label: 'Determination & attestation',
      content: (
        <DeterminationAttestationTab
          draft={draft}
          determinationStatus={submission.determination.status}
          onDeterminationStatusChange={NOOP}
          onFieldChange={NOOP}
          signedBy={submission.attestation.signedBy}
          onSignedByChange={NOOP}
          signatureDate={submission.attestation.signatureDate}
          signatureDataUrl={submission.attestation.signatureDataUrl}
          onSignatureChange={NOOP}
          consentConfirmed={submission.attestation.consentConfirmed}
          onConsentConfirmedChange={NOOP}
          disabled
        />
      )
    }
  ];

  return <TabbedFormShell tabs={tabs} value={tab} onValueChange={(value) => setTab(value as TabValue)} />;
}
