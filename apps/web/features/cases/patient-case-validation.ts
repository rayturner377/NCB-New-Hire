import { parseAndValidateImageDataUrl } from '../../lib/image-data-url';
import { FAMILY_DISORDER_CATALOG, MEDICAL_DISEASE_CATALOG, type PatientCaseData } from './patient-case-data';

/**
 * The real gate for submitting a patient intake form (save-patient-case.ts) — re-checks everything
 * the client's own validatePatientCaseBeforeSubmit already checked, since that one's just UX.
 * Returns the first problem found, or null once every section is complete enough to submit.
 */
export function validatePatientIntakeForSubmission(data: PatientCaseData): string | null {
  const { consent } = data;
  if (!consent.accepted || !consent.signedBy || !consent.signedAt || !consent.signatureDataUrl) {
    return 'Consent acceptance and signature are required before submitting.';
  }
  try {
    parseAndValidateImageDataUrl(consent.signatureDataUrl, 500 * 1024);
  } catch {
    return 'Your signature could not be read — please sign again.';
  }
  if (!data.assignedClinicianId) {
    return 'Choose the doctor who will complete your assessment.';
  }
  for (const item of FAMILY_DISORDER_CATALOG) {
    if (!data.familyHistory.disorders[item.key]?.answer) {
      return 'The family illnesses or disorders section is not complete.';
    }
  }
  for (const item of MEDICAL_DISEASE_CATALOG) {
    const answer = data.medicalHistory.diseases[item.key];
    if (!answer?.answer) {
      return 'The medical history section is not complete.';
    }
    if (answer.answer === 'yes' && !answer.year) {
      return 'Add a year for each "Yes" answer in your medical history.';
    }
  }
  return null;
}
