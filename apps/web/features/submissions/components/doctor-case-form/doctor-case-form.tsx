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
  /**
   * A delegate can fill in Assessment/Physical exam/Lab results and upload
   * attachments exactly like the doctor they support, but never the
   * Determination & Attestation tab (fitness status, conclusions,
   * signature) and never Submit — that stays doctor-only, enforced here in
   * the UI and again server-side in create-submission.ts (a hidden button
   * alone isn't enough, that action is reachable directly).
   */
  isDelegate?: boolean;
  /** Who last saved a draft on this case, if it wasn't the current viewer — see cases-service.ts's saveDoctorAssessmentDraft. Null when no one else has touched it, or the last save was the current viewer's own. */
  lastEditedByName?: string | null;
  lastEditedAt?: string | null;
}

const initialState: SubmissionActionResult | null = null;

type TabValue = 'patient' | 'assessment' | 'exam' | 'determination' | 'documents';

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
  attachments,
  isDelegate = false,
  lastEditedByName = null,
  lastEditedAt = null
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

  // Tracks the version this editor's own next save should check against — starts at whatever the
  // page loaded with, then advances on every successful autosave (see saveSubmissionDraftAction's
  // own newVersion return). Confirmed via external security review that updatePayload now genuinely
  // increments the case's version on every save, so submitting the ORIGINAL page-load value on a
  // second or third autosave would spuriously conflict with this editor's own prior save — this is
  // what keeps repeated autosaves (and the final Submit button, which posts this same hidden field)
  // advancing smoothly instead of self-conflicting.
  const [currentVersion, setCurrentVersion] = useState(caseVersion);

  const { status: autosaveStatus, notifyChange, saveNow } = useAutosave({
    formRef,
    onSave: async (formData) => {
      const result = await saveSubmissionDraftAction(null, formData);
      if (result.ok && result.newVersion !== undefined) {
        setCurrentVersion(result.newVersion);
      }
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
  // A delegate can never submit — Determination & Attestation is locked to them (see the `tabs`
  // array below), so canSubmit staying false here is what keeps both the Submit button and the
  // Documents tab's own visibility gate from ever activating for them client-side. The real
  // enforcement is server-side in create-submission.ts; this just keeps the UI honest about it.
  const canSubmit = !isDelegate && uncontrolledComplete.assessment && uncontrolledComplete.exam && determinationComplete;

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
          hideNationalId
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
      content: isDelegate ? (
        <div className="flex flex-col gap-2 rounded-md border border-dashed border-input p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Only the assigned doctor can complete this section.</p>
          <p>
            The fitness determination and attestation — including the signature — require the doctor&apos;s own
            clinical judgment and sign-off, and aren&apos;t part of what a delegate can enter on their behalf.
          </p>
        </div>
      ) : (
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
    // still building the assessment could reach it prematurely). A delegate
    // gets it unconditionally instead — they can never make canSubmit true
    // (Determination & Attestation is locked to them above), but still need
    // to upload/view attachments while doing the rest of the data entry.
    ...(canSubmit || isDelegate
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
                  hidePosition
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
      <input type="hidden" name="caseVersion" value={currentVersion} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold">{candidate.fullName}</h1>
          <p className="text-sm text-muted-foreground">Employee ID: {candidate.employeeId || '—'}</p>
          {lastEditedByName ? (
            <p className="text-xs text-muted-foreground">
              Last updated by {lastEditedByName}
              {lastEditedAt ? ` on ${new Date(lastEditedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
            </p>
          ) : null}
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
        // No Submit control at all for a delegate — they can never finish the case (see the
        // Determination & Attestation lock above), so a disabled button here would just be a
        // confusing dead end rather than an honest reflection of what they can do. Their work is
        // done entirely via autosave (see AutosaveIndicator above), same as every other tab.
        lastTabSlot={
          isDelegate ? undefined : (
            <div className="flex flex-col items-end gap-1">
              <SubmitButton canSubmit={canSubmit} />
              {!canSubmit ? (
                <p className="text-xs text-muted-foreground">Complete the assessment, choose a determination, and sign to submit.</p>
              ) : null}
            </div>
          )
        }
      />
    </form>
  );
}
