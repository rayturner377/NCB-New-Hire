'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { FormField } from '../../../components/ui/form-field';
import { Input } from '../../../components/ui/input';
import { createMedicalOfficeAction, type MedicalOfficeActionResult } from '../actions/create-medical-office';

const initialState: MedicalOfficeActionResult | null = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creating…' : 'Create facility'}
    </Button>
  );
}

/** A medical facility a doctor can be assigned to (see doctor-profile-fields.tsx's facility picker) — name/address/phone/email plus a default per-medical rate new doctors at this facility can start from. */
export function MedicalOfficeForm() {
  const [state, formAction] = useFormState(createMedicalOfficeAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        <FormField label="Facility name" name="name" required error={state?.fieldErrors?.name} className="sm:col-span-2">
          <Input id="name" name="name" type="text" maxLength={180} placeholder="e.g. New Kingston Medical Centre" required />
        </FormField>

        <FormField label="Address" name="address" error={state?.fieldErrors?.address} className="sm:col-span-2">
          <Input id="address" name="address" type="text" maxLength={500} placeholder="Street address" />
        </FormField>

        <FormField label="Phone" name="phone" error={state?.fieldErrors?.phone}>
          <Input id="phone" name="phone" type="tel" maxLength={50} />
        </FormField>

        <FormField label="Email" name="email" error={state?.fieldErrors?.email}>
          <Input id="email" name="email" type="email" maxLength={254} />
        </FormField>

        <FormField
          label="Default rate"
          name="defaultMedicalFee"
          error={state?.fieldErrors?.defaultMedicalFee}
          description="Starting point for a doctor assigned here — each doctor's own rate is still set (and can be changed) on their account."
        >
          <Input id="defaultMedicalFee" name="defaultMedicalFee" type="number" min={0} step="0.01" />
        </FormField>
      </div>

      {state?.error && !Object.keys(state.fieldErrors ?? {}).length ? <Alert tone="error">{state.error}</Alert> : null}

      <div className="flex items-center gap-3 border-t pt-4">
        <SubmitButton />
        <Button type="button" variant="outline" asChild>
          <Link href="/doctors?tab=offices">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
