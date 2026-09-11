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
import { Separator } from '../../../components/ui/separator';
import { updateCandidateAction } from '../actions/update-candidate';
import type { CandidateActionResult } from '../actions/create-candidate';
import type { CandidatePayload } from '../types';
import { useActionState } from 'react';

const initialState: CandidateActionResult | null = null;

const TEXTAREA_CLASS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Save changes'}
    </Button>
  );
}

export interface CandidateEditFormProps {
  candidate: CandidatePayload;
}

/**
 * The "View candidate" page's editable personal-info section — reuses the
 * same field components as CandidateForm (create) with default values
 * instead of building a second parallel set. `fullName` is a single field
 * here (unlike create's split NameFields pair) since there's an existing
 * string to edit in place, not two fresh inputs to combine. Portal
 * access/password management isn't part of this form — resetting an
 * existing account's password is a different operation than setting one at
 * creation, and isn't wired up yet.
 */
export function CandidateEditForm({ candidate }: CandidateEditFormProps) {
  const [state, formAction] = useActionState(updateCandidateAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="candidateId" value={candidate.id} />

      {state?.error && !Object.keys(state.fieldErrors ?? {}).length ? <Alert tone="error">{state.error}</Alert> : null}
      {state?.message ? <Alert tone="success">{state.message}</Alert> : null}

      <FormSection title="Personal information" description="The candidate's identity and the role they applied for.">
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="Full name" name="fullName" required error={state?.fieldErrors?.fullName}>
            <Input id="fullName" name="fullName" type="text" maxLength={140} defaultValue={candidate.fullName} required />
          </FormField>

          <FormField label="Date of birth" name="dateOfBirth" required error={state?.fieldErrors?.dateOfBirth}>
            <DateField name="dateOfBirth" required defaultValue={candidate.dateOfBirth} toYear={new Date().getFullYear()} />
          </FormField>

          <FormField label="Position applied for" name="position" required error={state?.fieldErrors?.position}>
            <Input id="position" name="position" type="text" maxLength={140} defaultValue={candidate.position} required />
          </FormField>

          <FormField label="Employee / applicant ID" name="employeeId" error={state?.fieldErrors?.employeeId}>
            <Input id="employeeId" name="employeeId" type="text" maxLength={80} defaultValue={candidate.employeeId} />
          </FormField>

          <FormField label="National ID / TRN" name="nationalId" error={state?.fieldErrors?.nationalId}>
            <Input id="nationalId" name="nationalId" type="text" maxLength={80} defaultValue={candidate.nationalId} />
          </FormField>
        </div>
      </FormSection>

      <Separator />

      <FormSection title="Contact information" description="How to reach the candidate directly.">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            <FormField label="Email" name="email" error={state?.fieldErrors?.email}>
              <Input id="email" name="email" type="email" autoComplete="email" maxLength={254} defaultValue={candidate.email} />
            </FormField>
            <PhoneNumbersField
              name="contactNumber"
              error={state?.fieldErrors?.contactNumber}
              defaultValues={candidate.contactNumber ? candidate.contactNumber.split(', ').filter(Boolean) : undefined}
            />
          </div>
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

      <FormSection title="Emergency contact & physician" description="Who to contact if something goes wrong during the medical.">
        <div className="flex flex-col gap-5">
          <ContactFields
            legend="Emergency contact"
            namePrefix="emergencyContact"
            namePlaceholder="e.g. John Doe"
            defaultName={candidate.emergencyContactName}
            defaultNumber={candidate.emergencyContactNumber}
            nameError={state?.fieldErrors?.emergencyContactName}
            numberError={state?.fieldErrors?.emergencyContactNumber}
          />
          <ContactFields
            legend="Primary physician"
            namePrefix="primaryPhysician"
            namePlaceholder="e.g. Dr. Andre Simms"
            defaultName={candidate.primaryPhysicianName}
            defaultNumber={candidate.primaryPhysicianNumber}
            nameError={state?.fieldErrors?.primaryPhysicianName}
            numberError={state?.fieldErrors?.primaryPhysicianNumber}
          />
        </div>
      </FormSection>

      <Separator />

      <FormSection title="Additional notes" description="Anything the medical office should know ahead of time.">
        <FormField label="Medication information" name="medicationInformation" error={state?.fieldErrors?.medicationInformation}>
          <textarea
            id="medicationInformation"
            name="medicationInformation"
            rows={3}
            maxLength={2000}
            defaultValue={candidate.medicationInformation}
            className={TEXTAREA_CLASS}
          />
        </FormField>
      </FormSection>

      <div className="flex items-center gap-3 border-t pt-4">
        <SaveButton />
      </div>
    </form>
  );
}
