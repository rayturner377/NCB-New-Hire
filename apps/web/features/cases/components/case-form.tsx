'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { FormField } from '../../../components/ui/form-field';
import type { CandidatePayload } from '../../candidates/types';
import { createCaseAction, type CaseActionResult } from '../actions/create-case';

const initialState: CaseActionResult | null = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creating…' : 'Create case'}
    </Button>
  );
}

export interface CaseFormProps {
  candidates: CandidatePayload[];
}

export function CaseForm({ candidates }: CaseFormProps) {
  const [state, formAction] = useFormState(createCaseAction, initialState);

  return (
    <form action={formAction} className="case-form">
      <FormField label="Candidate" name="patientId">
        <select id="patientId" name="patientId" required defaultValue="">
          <option value="" disabled>
            Select a candidate
          </option>
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.fullName} ({candidate.employeeId || candidate.id})
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Route" name="route">
        <select id="route" name="route" required defaultValue="doctor">
          <option value="doctor">Doctor completes the assessment</option>
          <option value="patient">Patient completes intake first</option>
        </select>
      </FormField>

      <FormField label="Assigned clinician (required for doctor route)" name="assignedClinicianId">
        <input id="assignedClinicianId" name="assignedClinicianId" type="text" placeholder="Clinician user id" />
      </FormField>

      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="success">Case created.</Alert> : null}

      <SubmitButton />
    </form>
  );
}
