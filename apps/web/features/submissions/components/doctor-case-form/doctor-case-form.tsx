'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { AutosaveIndicator } from '../../../../components/form/autosave-indicator';
import { TabbedFormShell, type TabbedFormShellTab } from '../../../../components/form/tabbed-form-shell';
import { Alert } from '../../../../components/ui/alert';
import { Button } from '../../../../components/ui/button';
import { useAutosave } from '../../../../lib/hooks/use-autosave';
import { captureSignatureTimestamp } from '../../../../lib/signature-timestamp';
import type { CandidatePayload } from '../../../candidates/types';
import { CaseAttachmentList, type CaseDocumentSummary } from '../../../cases/components/case-documents/case-attachment-list';
import { CaseAttachmentUpload } from '../../../cases/components/case-documents/case-attachment-upload';
import { CasePdfExport } from '../../../cases/components/case-documents/case-pdf-export';
import { PatientCaseReadOnlyView } from '../../../cases/components/patient-case-form/patient-case-read-only-view';
import type { PatientCaseData } from '../../../cases/patient-case-data';
import type { UserSummary } from '../../../users/types';
import type { SubmissionPayload } from '../../types';
import { createSubmissionAction, type SubmissionActionResult } from '../../actions/create-submission';
import { saveSubmissionDraftAction } from '../../actions/save-submission-draft';
import { AssessmentTab } from './assessment-tab';
import { DeterminationAttestationTab } from './determination-attestation-tab';
import { PhysicalExaminationTab } from './physical-examination-tab';
import type { DoctorAssessmentDraft } from './types';

export interface DoctorCaseFormProps {
  caseId: string;
  caseVersion: number;
  candidate: CandidatePayload;
  caseTypeLabel: string;
  patientCaseData: PatientCaseData | null;
  submission: SubmissionPayload | null;
  doctors: UserSummary[];
  draft: DoctorAssessmentDraft;
  attachments: CaseDocumentSummary[];
}

const initialState: SubmissionActionResult | null = null;

const TAB_ORDER = ['patient', 'assessment', 'exam', 'determination', 'documents'] as const;
type TabValue = (typeof TAB_ORDER)[number];

const TAB_LABELS: Record<TabValue, string> = {
  patient: 'Patient submission',
  assessment: 'Assessment',
  exam: 'Physical examination',
  determination: 'Determination & attestation',
  documents: 'Documents'
};

/** Same generic proxy patient-case-form.tsx uses: every native input/select/textarea in `container` passing its own `required`/type validation stands in for "this section's required fields are filled in". */
function isSectionComplete(container: HTMLElement | null): boolean {
  if (!container) return false;
  const fields = container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea');
  for (const field of Array.from(fields)) {
    if (!field.checkValidity()) return false;
  }
  return true;
}

function SubmitButton({ canSubmit }: { canSubmit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || !canSubmit}>
      {pending ? 'Submitting…' : 'Submit assessment'}
    </Button>
  );
}

/**
 * The doctor's own case-opening view — same shape as the patient's intake
 * form (patient-case-form.tsx): tabs sharing the TabbedFormShell, a
 * completion progress line, Previous/Next named after the adjacent tab,
 * background autosave, and the same signature capture. The first tab is
 * everything the patient already submitted, read-only (see
 * PatientCaseReadOnlyView) — the doctor's own editable tabs follow it,
 * matching the "TO BE COMPLETED BY THE EXAMINING PHYSICIAN" page of the
 * paper form field-for-field (see physician-exam-sections.ts). Determination
 * and attestation share one tab — there isn't enough on either half alone to
 * justify separate tabs.
 *
 * Documents (export as PDF / upload a stamped copy) is its own tab, deliberately
 * given no `complete` flag so it never counts toward the progress bar or
 * gates Submit — printing and re-uploading a stamped copy is optional, not
 * part of what the assessment itself requires. It's also reachable after
 * submission, from this same case's /cases/[id] workspace (case-detail-
 * container.tsx), which isn't gated on case status the way this page is.
 *
 * Autosave posts to save-submission-draft.ts; the final Submit still goes
 * through create-submission.ts unchanged, using the exact same field names
 * the draft uses so nothing needs translating between the two.
 *
 * No local "submitted!" dialog here on purpose: a successful submit changes
 * the case's status away from sent_to_doctor, and calling a Server Action
 * from a form always re-renders the invoking route's Server Components as
 * part of resolving useActionState's result — new-submission-container.tsx
 * immediately stops rendering this component in that same update (its
 * status guard no longer matches), so any local state set from `state.ok`
 * never gets a chance to paint. The actual "assessment submitted" dialog
 * lives in new-submission-container.tsx instead, driven by the case's new
 * status rather than this component's own state.
 */
export function DoctorCaseForm({
  caseId,
  caseVersion,
  candidate,
  caseTypeLabel,
  patientCaseData,
  submission,
  doctors,
  draft,
  attachments
}: DoctorCaseFormProps) {
  const [state, formAction] = useActionState(createSubmissionAction, initialState);

  const [tab, setTab] = useState<TabValue>('patient');
  const formRef = useRef<HTMLFormElement>(null);
  const assessmentRef = useRef<HTMLDivElement>(null);
  const examRef = useRef<HTMLDivElement>(null);

  // Determination and attestation are tracked explicitly (not the generic ref-check) — the fitness
  // determination is a shadcn Select (a hidden input backing it, not a native <select>, so
  // checkValidity can't see it either), and a signature isn't a native field at all.
  const [determinationStatus, setDeterminationStatus] = useState(draft.determination?.status ?? '');
  const [signedBy, setSignedBy] = useState(draft.attestation?.signedBy ?? '');
  const [signatureDate, setSignatureDate] = useState(draft.attestation?.signatureDate ?? '');
  const [signatureDataUrl, setSignatureDataUrl] = useState(draft.attestation?.signatureDataUrl ?? '');
  const [consentConfirmed, setConsentConfirmed] = useState(
    draft.attestation?.consentConfirmed === 'true' || draft.attestation?.consentConfirmed === true
  );
  const [uncontrolledComplete, setUncontrolledComplete] = useState({ assessment: false, exam: false });

  const { status: autosaveStatus, notifyChange, saveNow } = useAutosave({
    formRef,
    onSave: async (formData) => {
      const result = await saveSubmissionDraftAction(null, formData);
      return result.ok;
    }
  });

  // Deliberately only re-checks the section belonging to whichever tab is CURRENTLY active — see
  // patient-case-form.tsx's identical comment on recomputeActiveSectionCompletion for why: a hidden
  // tab's fields aren't reliably checkable via checkValidity() the moment they're not on screen, so
  // trusting that check only while a tab is genuinely visible is what keeps a not-yet-opened tab from
  // silently reading as already complete.
  function recomputeActiveSectionCompletion(activeTab: TabValue) {
    if (activeTab === 'assessment') {
      setUncontrolledComplete((prev) => ({ ...prev, assessment: isSectionComplete(assessmentRef.current) }));
    } else if (activeTab === 'exam') {
      setUncontrolledComplete((prev) => ({ ...prev, exam: isSectionComplete(examRef.current) }));
    }
  }

  useEffect(() => {
    recomputeActiveSectionCompletion(tab);
  }, [tab]);

  function handleFormChange() {
    notifyChange();
    recomputeActiveSectionCompletion(tab);
  }

  function handleSignatureChange(dataUrl: string) {
    setSignatureDataUrl(dataUrl);
    if (dataUrl && !signatureDate) {
      setSignatureDate(captureSignatureTimestamp());
    } else if (!dataUrl) {
      setSignatureDate('');
    }
    notifyChange();
  }

  const attestationComplete = Boolean(signedBy.trim()) && Boolean(signatureDataUrl) && consentConfirmed;
  const determinationComplete = Boolean(determinationStatus) && attestationComplete;
  const canSubmit = uncontrolledComplete.assessment && uncontrolledComplete.exam && determinationComplete;

  // If the Documents tab disappears (see `tabs` below) while it's the active
  // one — the doctor had finished everything, opened it, then went back and
  // invalidated an earlier field — fall back to determination rather than
  // leaving `tab` pointed at a value with no matching trigger anymore.
  useEffect(() => {
    if (!canSubmit && tab === 'documents') setTab('determination');
  }, [canSubmit, tab]);

  const tabs: TabbedFormShellTab[] = [
    {
      key: 'patient',
      label: TAB_LABELS.patient,
      content: patientCaseData ? (
        <PatientCaseReadOnlyView
          data={patientCaseData}
          employeeId={candidate.employeeId}
          email={candidate.email}
          doctors={doctors}
          layout="flat"
        />
      ) : (
        <p className="text-sm text-muted-foreground">The patient hasn&apos;t completed their intake form yet.</p>
      )
    },
    {
      key: 'assessment',
      label: TAB_LABELS.assessment,
      complete: uncontrolledComplete.assessment,
      content: (
        <div ref={assessmentRef}>
          <AssessmentTab draft={draft} onFieldChange={handleFormChange} />
        </div>
      )
    },
    {
      key: 'exam',
      label: TAB_LABELS.exam,
      complete: uncontrolledComplete.exam,
      content: (
        <div ref={examRef}>
          <PhysicalExaminationTab draft={draft} patientSex={patientCaseData?.personalInfo.sex} />
        </div>
      )
    },
    {
      key: 'determination',
      label: TAB_LABELS.determination,
      complete: determinationComplete,
      content: (
        <DeterminationAttestationTab
          draft={draft}
          determinationStatus={determinationStatus}
          onDeterminationStatusChange={(value) => {
            setDeterminationStatus(value);
            notifyChange();
          }}
          onFieldChange={handleFormChange}
          signedBy={signedBy}
          onSignedByChange={(value) => {
            setSignedBy(value);
            notifyChange();
          }}
          signatureDate={signatureDate}
          signatureDataUrl={signatureDataUrl}
          onSignatureChange={handleSignatureChange}
          consentConfirmed={consentConfirmed}
          onConsentConfirmedChange={(value) => {
            setConsentConfirmed(value);
            notifyChange();
          }}
        />
      )
    },
    // Held back until the assessment itself is actually finishable — there's
    // nothing to export or stamp before the doctor has filled in the exam,
    // chosen a determination, and signed, so the tab doesn't exist yet
    // rather than showing up locked (see case-detail-container.tsx's
    // Documents tab, which greys out for the same reason once the doctor's
    // own record of the case moves there — this is the one place a doctor
    // still building the assessment could reach it prematurely).
    ...(canSubmit
      ? [
          {
            key: 'documents',
            label: TAB_LABELS.documents,
            // No `complete` flag on purpose — optional, doesn't count toward the progress bar or Submit.
            // `lazy` so react-pdf's export bundle only loads once this tab is actually opened, not on
            // every visit to this page — none of its fields belong to the submission's own FormData.
            lazy: true,
            content: (
              <div className="flex flex-col gap-4">
                <CasePdfExport
                  caseId={caseId}
                  candidate={candidate}
                  caseTypeLabel={caseTypeLabel}
                  patientCaseData={patientCaseData}
                  submission={submission}
                />
                <CaseAttachmentUpload caseId={caseId} />
                <CaseAttachmentList caseId={caseId} attachments={attachments} />
              </div>
            )
          } satisfies TabbedFormShellTab
        ]
      : [])
  ];

  return (
    <form ref={formRef} action={formAction} onChange={handleFormChange} className="flex flex-col gap-3">
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="caseVersion" value={caseVersion} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold">{candidate.fullName}</h1>
          <p className="text-sm text-muted-foreground">
            {candidate.position} · Employee ID: {candidate.employeeId || '—'}
          </p>
        </div>
        <AutosaveIndicator status={autosaveStatus} />
      </div>

      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}

      <TabbedFormShell
        tabs={tabs}
        value={tab}
        onValueChange={(value) => setTab(value as TabValue)}
        onNavigate={() => void saveNow()}
        finalSlotTabKey="determination"
        lastTabSlot={
          <div className="flex flex-col items-end gap-1">
            <SubmitButton canSubmit={canSubmit} />
            {!canSubmit ? (
              <p className="text-xs text-muted-foreground">Complete the assessment, choose a determination, and sign to submit.</p>
            ) : null}
          </div>
        }
      />
    </form>
  );
}
