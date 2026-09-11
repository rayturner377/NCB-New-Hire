'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ActionSuccessDialog } from '../../../../components/feedback/action-success-dialog';
import { AutosaveIndicator } from '../../../../components/form/autosave-indicator';
import { TabbedFormShell, type TabbedFormShellTab } from '../../../../components/form/tabbed-form-shell';
import { Alert } from '../../../../components/ui/alert';
import { Button } from '../../../../components/ui/button';
import { useAutosave } from '../../../../lib/hooks/use-autosave';
import { savePatientCaseAction, type SavePatientCaseResult } from '../../actions/save-patient-case';
import type { FamilyRelativeRow, PatientCaseData } from '../../patient-case-data';
import type { UserSummary } from '../../../users/types';
import { ConsentTab } from './consent-tab';
import { FamilyHistoryTab } from './family-history-tab';
import { MedicalHistoryTab } from './medical-history-tab';
import { PersonalInfoTab } from './personal-info-tab';

export interface PatientCaseFormProps {
  caseId: string;
  version: number;
  data: PatientCaseData;
  employeeId: string;
  email: string;
  doctors: UserSummary[];
  /** True once the case has moved past `sent_to_patient` — everything renders read-only and the action bar disappears. */
  readOnly: boolean;
}

const initialState: SavePatientCaseResult | null = null;

const TAB_ORDER = ['personal', 'family', 'medical', 'consent'] as const;
type TabValue = (typeof TAB_ORDER)[number];

const TAB_LABELS: Record<TabValue, string> = {
  personal: 'Personal info',
  family: 'Family history',
  medical: 'Medical history',
  consent: 'Consent'
};

/** Every native input/select/textarea in `container` passes its own `required`/type validation — a generic proxy for "this section's required fields are filled in" that doesn't need each tab to hand-roll its own completeness check. */
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
    <Button type="submit" name="intent" value="submit" disabled={pending || !canSubmit}>
      {pending ? 'Submitting…' : 'Submit'}
    </Button>
  );
}

/**
 * Ported from public/app.js's renderPatientMedicalCaseForm/bindPatientCaseForm
 * (~L9390-9939) — 4 tabs (Personal info / Family history / Medical history /
 * Consent) navigated with Previous/Next, and a Submit button that only
 * appears on the last tab and re-validates everything server-side before
 * transitioning the case to the chosen doctor. See
 * features/cases/actions/save-patient-case.ts for the save/submit action
 * Submit posts to. Tab navigation/progress itself lives in the shared
 * TabbedFormShell (components/form/tabbed-form-shell.tsx) — the doctor's own
 * assessment form (features/submissions/components/doctor-case-form) uses the
 * exact same shell.
 *
 * There's no manual Save button — this autosaves in the background instead,
 * see lib/hooks/use-autosave.ts — the same debounce-plus-ceiling pattern
 * editors and process-form tools (Google Docs, Notion, Pega/Appian-style BPM
 * forms) use: a short pause after the last change triggers a save, and a
 * hard ceiling makes sure a save still happens periodically even during one
 * long continuous stretch of typing (e.g. the "other health information"
 * textarea).
 */
export function PatientCaseForm({ caseId, version, data, employeeId, email, doctors, readOnly }: PatientCaseFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(savePatientCaseAction, initialState);
  const [showSubmittedDialog, setShowSubmittedDialog] = useState(false);

  useEffect(() => {
    if (state?.ok && state.submitted) {
      setShowSubmittedDialog(true);
    }
  }, [state]);
  const [relatives, setRelatives] = useState<FamilyRelativeRow[]>(data.familyHistory.relatives);
  const [tab, setTab] = useState<TabValue>('personal');
  const formRef = useRef<HTMLFormElement>(null);
  const personalRef = useRef<HTMLDivElement>(null);
  const familyRef = useRef<HTMLDivElement>(null);
  const medicalRef = useRef<HTMLDivElement>(null);

  // Consent/doctor selection are controlled here (not inside ConsentTab) since Submit needs to know all three are satisfied before it's even clickable.
  const [consentAccepted, setConsentAccepted] = useState(data.consent.accepted);
  const [signedBy, setSignedBy] = useState(data.consent.signedBy);
  const [signatureDataUrl, setSignatureDataUrl] = useState(data.consent.signatureDataUrl);
  const [assignedClinicianId, setAssignedClinicianId] = useState(data.assignedClinicianId);

  const [uncontrolledComplete, setUncontrolledComplete] = useState({ personal: false, family: false, medical: false });

  const { status: autosaveStatus, notifyChange, saveNow } = useAutosave({
    formRef,
    disabled: readOnly,
    onSave: async (formData) => {
      formData.set('intent', 'draft');
      const result = await savePatientCaseAction(null, formData);
      return result.ok;
    }
  });

  // Deliberately only ever re-checks the section belonging to whichever tab is CURRENTLY active,
  // never the other two. TabbedFormShell keeps every tab's fields permanently mounted so nothing
  // drops out of the form's own FormData, hiding the inactive ones instead of unmounting them — and
  // however that hiding is done, "checking validity while hidden" is not something a browser's
  // native constraint validation can be trusted to answer honestly (a hidden field's real answered/
  // unanswered state isn't reliably observable through checkValidity() the moment it isn't the one
  // on screen). Restricting every check to the tab that's actually visible sidesteps that entirely,
  // regardless of the hiding mechanism: a section's completeness only ever gets updated at a moment
  // it's genuinely being looked at, so it can never silently read "complete" for a tab nobody has
  // opened yet — see the effect below, which re-runs this every time `tab` changes.
  function recomputeActiveSectionCompletion(activeTab: TabValue) {
    if (activeTab === 'personal') {
      setUncontrolledComplete((prev) => ({ ...prev, personal: isSectionComplete(personalRef.current) }));
    } else if (activeTab === 'family') {
      setUncontrolledComplete((prev) => ({ ...prev, family: isSectionComplete(familyRef.current) }));
    } else if (activeTab === 'medical') {
      setUncontrolledComplete((prev) => ({ ...prev, medical: isSectionComplete(medicalRef.current) }));
    }
  }

  useEffect(() => {
    recomputeActiveSectionCompletion(tab);
  }, [tab]);

  const consentComplete = consentAccepted && Boolean(signedBy.trim()) && Boolean(signatureDataUrl) && Boolean(assignedClinicianId);
  const canSubmit = consentComplete && uncontrolledComplete.personal && uncontrolledComplete.family && uncontrolledComplete.medical;

  function handleFormChange() {
    notifyChange();
    recomputeActiveSectionCompletion(tab);
  }

  function addRelative() {
    setRelatives((prev) => [...prev, { relative: '', ageIfAlive: '', healthOrCauseOfDeath: '', ageAtDeath: '' }]);
    handleFormChange();
  }
  function removeRelative(index: number) {
    setRelatives((prev) => prev.filter((_, i) => i !== index));
    handleFormChange();
  }
  function handleSignatureChange(dataUrl: string) {
    setSignatureDataUrl(dataUrl);
    notifyChange();
  }

  const tabs: TabbedFormShellTab[] = [
    {
      key: 'personal',
      label: TAB_LABELS.personal,
      complete: readOnly ? undefined : uncontrolledComplete.personal,
      content: (
        <div ref={personalRef}>
          <PersonalInfoTab data={data} employeeId={employeeId} email={email} disabled={readOnly} />
        </div>
      )
    },
    {
      key: 'family',
      label: TAB_LABELS.family,
      complete: readOnly ? undefined : uncontrolledComplete.family,
      content: (
        <div ref={familyRef}>
          <FamilyHistoryTab data={data} relatives={relatives} onAddRelative={addRelative} onRemoveRelative={removeRelative} disabled={readOnly} />
        </div>
      )
    },
    {
      key: 'medical',
      label: TAB_LABELS.medical,
      complete: readOnly ? undefined : uncontrolledComplete.medical,
      content: (
        <div ref={medicalRef}>
          <MedicalHistoryTab data={data} disabled={readOnly} />
        </div>
      )
    },
    {
      key: 'consent',
      label: TAB_LABELS.consent,
      complete: readOnly ? undefined : consentComplete,
      content: (
        <ConsentTab
          data={data}
          doctors={doctors}
          disabled={readOnly}
          accepted={consentAccepted}
          onAcceptedChange={(accepted) => {
            setConsentAccepted(accepted);
            notifyChange();
          }}
          signedBy={signedBy}
          onSignedByChange={(value) => {
            setSignedBy(value);
            notifyChange();
          }}
          onSignatureChange={handleSignatureChange}
          assignedClinicianId={assignedClinicianId}
          onAssignedClinicianChange={(id) => {
            setAssignedClinicianId(id);
            notifyChange();
          }}
        />
      )
    }
  ];

  return (
    <form ref={formRef} action={formAction} onChange={handleFormChange} className="flex flex-col gap-3">
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="version" value={version} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Your medical case</h1>
        {!readOnly ? <AutosaveIndicator status={autosaveStatus} /> : null}
      </div>

      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state?.message && !state.error && !state.submitted ? <Alert tone="success">{state.message}</Alert> : null}

      <TabbedFormShell
        tabs={tabs}
        value={tab}
        onValueChange={(value) => setTab(value as TabValue)}
        onNavigate={() => void saveNow()}
        hideNav={readOnly}
        lastTabSlot={
          <div className="flex flex-col items-end gap-1">
            <SubmitButton canSubmit={canSubmit} />
            {!canSubmit ? <p className="text-xs text-muted-foreground">Complete every section, sign, and choose a doctor to submit.</p> : null}
          </div>
        }
      />

      {readOnly ? <p className="text-sm text-muted-foreground">This medical case is no longer waiting for your action.</p> : null}

      <ActionSuccessDialog
        open={showSubmittedDialog}
        title="Medical case submitted"
        description="Your case has been sent to the selected doctor for review."
        confirmLabel="Done"
        onConfirm={() => router.push('/')}
      />
    </form>
  );
}
