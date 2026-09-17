'use server';

import { revalidatePath } from 'next/cache';
import { CaseVersionConflictError } from '@ncb/database';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { requireFullSession } from '../../../lib/session';
import { patientOwnsCase } from '../case-authorization';
import { parsePatientCaseData } from '../parse-patient-case-data';
import { validatePatientIntakeForSubmission } from '../patient-case-validation';
import { getCaseWithPatientById, savePatientCaseProgress, submitPatientCase } from '../services/cases-service';

export interface SavePatientCaseResult {
  ok: boolean;
  error?: string;
  message?: string;
  submitted?: boolean;
}

/**
 * Both the intake form's "Save" and "Submit" buttons post here (matching the
 * old app's single PATCH .../cases/:id endpoint with an `intent` flag) — see
 * public/app.js's savePatientCase (~L10148-10177). Draft saves skip
 * validation entirely; submitting re-checks everything the client's own
 * validatePatientCaseBeforeSubmit already checked, since the client check is
 * just UX — this is the real gate.
 */
export async function savePatientCaseAction(
  _prevState: SavePatientCaseResult | null,
  formData: FormData
): Promise<SavePatientCaseResult> {
  await assertSameOrigin();

  const session = await requireFullSession();
  if (!session) {
    return { ok: false, error: 'Your session has expired. Please sign in again.' };
  }
  if (session.user.role !== 'patient') {
    return { ok: false, error: 'Only the patient this case belongs to can update it.' };
  }

  const caseId = String(formData.get('caseId') || '');
  const intent = String(formData.get('intent') || 'draft');
  if (!caseId) {
    return { ok: false, error: 'Missing case id.' };
  }

  const medicalCase = await getCaseWithPatientById(caseId);
  if (!medicalCase) {
    return { ok: false, error: 'Case not found.' };
  }

  if (!(await patientOwnsCase(session.user.id, medicalCase))) {
    return { ok: false, error: 'Case not found.' };
  }

  if (medicalCase.status !== 'sent_to_patient') {
    return { ok: false, error: 'This medical case is not waiting for your action.' };
  }

  const patientCaseData = parsePatientCaseData(formData);

  if (intent !== 'submit') {
    try {
      await savePatientCaseProgress(caseId, patientCaseData, medicalCase.payload, medicalCase.version);
    } catch (error) {
      if (error instanceof CaseVersionConflictError) {
        return { ok: false, error: error.message };
      }
      throw error;
    }
    revalidatePath(`/cases/${caseId}`);
    return { ok: true, message: 'Draft saved.' };
  }

  const validationError = validatePatientIntakeForSubmission(patientCaseData);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  await submitPatientCase(caseId, patientCaseData, medicalCase.version, session.user.id, medicalCase.payload);
  revalidatePath(`/cases/${caseId}`);
  revalidatePath('/');
  return { ok: true, submitted: true, message: 'Submitted. Your case has been sent to the selected doctor.' };
}
