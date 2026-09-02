'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { FormField } from '../../../components/ui/form-field';
import { createCandidateAction, type CandidateActionResult } from '../actions/create-candidate';

const initialState: CandidateActionResult | null = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creating…' : 'Create candidate'}
    </Button>
  );
}

export function CandidateForm() {
  const [state, formAction] = useFormState(createCandidateAction, initialState);

  return (
    <form action={formAction} className="candidate-form">
      <FormField label="Full name" name="fullName">
        <input id="fullName" name="fullName" type="text" required />
      </FormField>

      <FormField label="Position applied for" name="position">
        <input id="position" name="position" type="text" required />
      </FormField>

      <FormField label="Date of birth" name="dateOfBirth">
        <input id="dateOfBirth" name="dateOfBirth" type="date" required />
      </FormField>

      <FormField label="Employee ID" name="employeeId">
        <input id="employeeId" name="employeeId" type="text" />
      </FormField>

      <FormField label="Email" name="email">
        <input id="email" name="email" type="email" />
      </FormField>

      <FormField label="Contact number" name="contactNumber">
        <input id="contactNumber" name="contactNumber" type="text" />
      </FormField>

      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="success">Candidate created.</Alert> : null}

      <SubmitButton />
    </form>
  );
}
