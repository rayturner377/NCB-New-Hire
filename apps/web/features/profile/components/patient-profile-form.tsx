'use client';

import { useFormStatus } from 'react-dom';
import { AddressFields } from '../../../components/form/address-fields';
import { ContactFields } from '../../../components/form/contact-fields';
import { DateField } from '../../../components/form/date-field';
import { FormSection } from '../../../components/form/form-section';
import { PhoneNumbersField } from '../../../components/form/phone-numbers-field';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { FormField } from '../../../components/ui/form-field';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Separator } from '../../../components/ui/separator';
import { updateOwnProfileAction } from '../../candidates/actions/update-own-profile';
import type { CandidatePayload } from '../../candidates/types';
import { useActionState } from 'react';

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Save changes'}
    </Button>
  );
}

export interface PatientProfileFormProps {
  candidate: CandidatePayload;
  email: string;
}

/**
 * Self-service subset of CandidateEditForm's fields — same field components
 * (AddressFields/PhoneNumbersField/ContactFields/DateField), but only the
 * ones a candidate should be able to change about themselves. Name,
 * position, employeeId, status, and assignment stay read-only here; those
 * are HR-managed identity fields, edited only through /candidates/[id].
 */
export function PatientProfileForm({ candidate, email }: PatientProfileFormProps) {
  const [state, formAction] = useActionState(updateOwnProfileAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {state?.error && !Object.keys(state.fieldErrors ?? {}).length ? <Alert tone="error">{state.error}</Alert> : null}
      {state?.message ? <Alert tone="success">{state.message}</Alert> : null}

      <FormSection title="Identity" description="Managed by HR — contact them if anything here needs correcting.">
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Full name</Label>
            <Input value={candidate.fullName} disabled />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Email</Label>
            <Input value={email} disabled />
          </div>
        </div>
      </FormSection>

      <Separator />

      <FormSection title="Personal details" description="Your date of birth, on file for your medical records.">
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          <FormField label="Date of birth" name="dateOfBirth" error={state?.fieldErrors?.dateOfBirth}>
            <DateField name="dateOfBirth" defaultValue={candidate.dateOfBirth} toYear={new Date().getFullYear()} />
          </FormField>
        </div>
      </FormSection>

      <Separator />

      <FormSection title="Contact information" description="How we reach you directly.">
        <div className="flex flex-col gap-5">
          <PhoneNumbersField
            name="contactNumber"
            error={state?.fieldErrors?.contactNumber}
            defaultValues={candidate.contactNumber ? candidate.contactNumber.split(', ').filter(Boolean) : undefined}
          />
          <AddressFields
            defaultLine1={candidate.addressLine1}
            defaultLine2={candidate.addressLine2}
            defaultCity={candidate.city}
            defaultState={candidate.state}
            defaultCountry={candidate.country}
          />
        </div>
      </FormSection>

      <Separator />

      <FormSection title="Next of kin" description="Who to contact in an emergency.">
        <ContactFields
          legend="Emergency contact"
          namePrefix="emergencyContact"
          namePlaceholder="e.g. John Doe"
          defaultName={candidate.emergencyContactName}
          defaultNumber={candidate.emergencyContactNumber}
          nameError={state?.fieldErrors?.emergencyContactName}
          numberError={state?.fieldErrors?.emergencyContactNumber}
        />
      </FormSection>

      <div className="flex items-center gap-3 border-t pt-4">
        <SaveButton />
      </div>
    </form>
  );
}
