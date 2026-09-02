'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { FormField } from '../../../components/ui/form-field';
import type { CandidatePayload } from '../../candidates/types';
import { createSubmissionAction, type SubmissionActionResult } from '../actions/create-submission';

const initialState: SubmissionActionResult | null = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Submitting…' : 'Submit assessment'}
    </Button>
  );
}

export interface SubmissionFormProps {
  caseId: string;
  caseVersion: number;
  candidate: CandidatePayload;
}

const HISTORY_FIELDS: { key: string; label: string }[] = [
  { key: 'cardiac', label: 'Cardiac' },
  { key: 'respiratory', label: 'Respiratory' },
  { key: 'diabetes', label: 'Diabetes' },
  { key: 'hypertension', label: 'Hypertension' },
  { key: 'allergies', label: 'Allergies' },
  { key: 'surgeries', label: 'Surgeries' },
  { key: 'medications', label: 'Medications' },
  { key: 'mentalHealth', label: 'Mental health' },
  { key: 'infectiousDisease', label: 'Infectious disease' }
];

const FAMILY_HISTORY_FIELDS: { key: string; label: string }[] = [
  { key: 'hypertension', label: 'Hypertension' },
  { key: 'diabetes', label: 'Diabetes' },
  { key: 'heartDisease', label: 'Heart disease' },
  { key: 'asthma', label: 'Asthma' },
  { key: 'cancer', label: 'Cancer' },
  { key: 'stroke', label: 'Stroke' },
  { key: 'kidneyDisease', label: 'Kidney disease' },
  { key: 'mentalHealth', label: 'Mental health' }
];

export function SubmissionForm({ caseId, caseVersion, candidate }: SubmissionFormProps) {
  const [state, formAction] = useFormState(createSubmissionAction, initialState);

  return (
    <form action={formAction} className="submission-form">
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="caseVersion" value={caseVersion} />

      <section className="submission-section">
        <h2>Candidate</h2>
        <p>
          <strong>{candidate.fullName}</strong> — {candidate.position}
        </p>
        <p>
          Employee ID: {candidate.employeeId || '—'} · Date of birth: {candidate.dateOfBirth}
        </p>
      </section>

      <section className="submission-section">
        <h2>Assessment</h2>
        <FormField label="Medical facility" name="assessment.facilityName">
          <input id="assessment.facilityName" name="assessment.facilityName" type="text" required />
        </FormField>
        <FormField label="Facility address" name="assessment.facilityAddress">
          <input id="assessment.facilityAddress" name="assessment.facilityAddress" type="text" />
        </FormField>
        <FormField label="Assessment date" name="assessment.assessmentDate">
          <input id="assessment.assessmentDate" name="assessment.assessmentDate" type="date" required />
        </FormField>
        <FormField label="Clinician name" name="assessment.clinicianName">
          <input id="assessment.clinicianName" name="assessment.clinicianName" type="text" required />
        </FormField>
        <FormField label="Clinician registration number" name="assessment.clinicianRegistrationNumber">
          <input id="assessment.clinicianRegistrationNumber" name="assessment.clinicianRegistrationNumber" type="text" />
        </FormField>
      </section>

      <section className="submission-section">
        <h2>Vitals</h2>
        <FormField label="Height (cm)" name="vitals.heightCm">
          <input id="vitals.heightCm" name="vitals.heightCm" type="text" />
        </FormField>
        <FormField label="Weight (kg)" name="vitals.weightKg">
          <input id="vitals.weightKg" name="vitals.weightKg" type="text" />
        </FormField>
        <FormField label="Blood pressure" name="vitals.bloodPressure">
          <input id="vitals.bloodPressure" name="vitals.bloodPressure" type="text" />
        </FormField>
        <FormField label="Pulse" name="vitals.pulse">
          <input id="vitals.pulse" name="vitals.pulse" type="text" />
        </FormField>
        <FormField label="Vision" name="vitals.vision">
          <input id="vitals.vision" name="vitals.vision" type="text" />
        </FormField>
        <FormField label="Hearing" name="vitals.hearing">
          <input id="vitals.hearing" name="vitals.hearing" type="text" />
        </FormField>
      </section>

      <section className="submission-section">
        <h2>Medical history</h2>
        <div className="submission-checkbox-grid">
          {HISTORY_FIELDS.map((field) => (
            <label key={field.key} className="submission-checkbox">
              <input type="checkbox" name={`medicalHistory.${field.key}`} value="true" />
              {field.label}
            </label>
          ))}
        </div>
        <FormField label="Notes" name="medicalHistory.notes">
          <textarea id="medicalHistory.notes" name="medicalHistory.notes" rows={3} />
        </FormField>
      </section>

      <section className="submission-section">
        <h2>Family history</h2>
        <div className="submission-checkbox-grid">
          {FAMILY_HISTORY_FIELDS.map((field) => (
            <label key={field.key} className="submission-checkbox">
              <input type="checkbox" name={`familyHistory.${field.key}`} value="true" />
              {field.label}
            </label>
          ))}
        </div>
        <FormField label="Notes" name="familyHistory.notes">
          <textarea id="familyHistory.notes" name="familyHistory.notes" rows={3} />
        </FormField>
      </section>

      <section className="submission-section">
        <h2>Lab results</h2>
        <FormField label="Blood test" name="labResults.bloodTest">
          <input id="labResults.bloodTest" name="labResults.bloodTest" type="text" />
        </FormField>
        <FormField label="Urine test" name="labResults.urineTest">
          <input id="labResults.urineTest" name="labResults.urineTest" type="text" />
        </FormField>
        <FormField label="Chest X-ray" name="labResults.chestXray">
          <input id="labResults.chestXray" name="labResults.chestXray" type="text" />
        </FormField>
        <FormField label="Drug screen" name="labResults.drugScreen">
          <input id="labResults.drugScreen" name="labResults.drugScreen" type="text" />
        </FormField>
      </section>

      <section className="submission-section">
        <h2>Determination</h2>
        <FormField label="Fitness determination" name="determination.status">
          <select id="determination.status" name="determination.status" required defaultValue="">
            <option value="" disabled>
              Select a determination
            </option>
            <option value="fit">Fit</option>
            <option value="fit_with_restrictions">Fit with restrictions</option>
            <option value="temporarily_deferred">Temporarily deferred</option>
            <option value="not_fit">Not fit</option>
          </select>
        </FormField>
        <FormField label="Conclusions" name="determination.conclusions">
          <textarea id="determination.conclusions" name="determination.conclusions" rows={3} />
        </FormField>
        <FormField label="Restrictions" name="determination.restrictions">
          <textarea id="determination.restrictions" name="determination.restrictions" rows={2} />
        </FormField>
        <FormField label="Recommendation" name="determination.recommendation">
          <textarea id="determination.recommendation" name="determination.recommendation" rows={2} />
        </FormField>
      </section>

      <section className="submission-section">
        <h2>Attestation</h2>
        <FormField label="Signed by" name="attestation.signedBy">
          <input id="attestation.signedBy" name="attestation.signedBy" type="text" required />
        </FormField>
        <FormField label="Signature date" name="attestation.signatureDate">
          <input id="attestation.signatureDate" name="attestation.signatureDate" type="date" required />
        </FormField>
        <label className="submission-checkbox">
          <input type="checkbox" name="attestation.consentConfirmed" value="true" required />
          I confirm the candidate&apos;s consent was obtained before this assessment.
        </label>
      </section>

      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}

      <SubmitButton />
    </form>
  );
}
