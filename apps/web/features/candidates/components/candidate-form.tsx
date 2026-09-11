'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { AddressFields } from '../../../components/form/address-fields';
import { ContactFields } from '../../../components/form/contact-fields';
import { CredentialsFields } from '../../../components/form/credentials-fields';
import { DateField } from '../../../components/form/date-field';
import { ForcePasswordChangeField } from '../../../components/form/force-password-change-field';
import { FormSection } from '../../../components/form/form-section';
import { NameFields } from '../../../components/form/name-fields';
import { PhoneNumbersField } from '../../../components/form/phone-numbers-field';
import { ValidatedSubmitButton } from '../../../components/form/submit-button';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { FormField } from '../../../components/ui/form-field';
import { Input } from '../../../components/ui/input';
import { Separator } from '../../../components/ui/separator';
import { useValidatedForm } from '../../../lib/hooks/use-validated-form';
import { createCandidateAction, type CandidateActionResult } from '../actions/create-candidate';

const initialState: CandidateActionResult | null = null;

const TEXTAREA_CLASS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Ported from server.js's candidateSetupForm (public/app.js ~L8243-8254) and
 * the admin edit form (~L8106-8123), expanded well past the old app's
 * candidate-level record: multiple phone numbers, a split address, and a
 * "Portal access" section that only appears once an email is entered (a
 * password needs an email to log in with). Note: the old app's
 * *candidate*-level record only ever had one "Primary physician" field and a
 * name+number emergency contact — the richer primary-doctor name/address/
 * phone split lives on the patient's own medical-intake form (a different,
 * still-deferred feature), not here.
 */
export function CandidateForm() {
  const [state, formAction] = useActionState(createCandidateAction, initialState);
  const { formRef, formValid, refreshValidity, handleSubmit, fieldError, hasClientErrors } = useValidatedForm(state?.fieldErrors);
  const [email, setEmail] = useState('');

  return (
    <form ref={formRef} action={formAction} onSubmit={handleSubmit} onChange={refreshValidity} className="flex flex-col gap-8">
      <div className="sticky top-0 z-10 -mx-6 -mt-6 flex items-center justify-between gap-4 border-b bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <p className="text-sm text-muted-foreground">
          Fields marked <span className="text-destructive">*</span> are required.
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href="/candidates">Cancel</Link>
          </Button>
          <ValidatedSubmitButton formValid={formValid} label="Create candidate" pendingLabel="Creating…" />
        </div>
      </div>

      {hasClientErrors ? (
        <Alert tone="error">Please fill in the required fields highlighted below before creating the candidate.</Alert>
      ) : null}

      <FormSection title="Personal information" description="The candidate's identity and the role they applied for.">
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <NameFields firstNameError={fieldError('firstName') ?? fieldError('fullName')} lastNameError={fieldError('lastName')} />

          <FormField label="Date of birth" name="dateOfBirth" required error={fieldError('dateOfBirth')}>
            <DateField name="dateOfBirth" required toYear={new Date().getFullYear()} onChange={refreshValidity} />
          </FormField>

          <FormField label="Position applied for" name="position" required error={fieldError('position')}>
            <Input id="position" name="position" type="text" maxLength={140} placeholder="e.g. Teller" required />
          </FormField>

          <FormField label="Employee / applicant ID" name="employeeId" error={fieldError('employeeId')}>
            <Input id="employeeId" name="employeeId" type="text" maxLength={80} placeholder="e.g. EMP-1042" />
          </FormField>

          <FormField label="National ID / TRN" name="nationalId" error={fieldError('nationalId')}>
            <Input id="nationalId" name="nationalId" type="text" maxLength={80} placeholder="e.g. 123-456-789" />
          </FormField>
        </div>
      </FormSection>

      <Separator />

      <FormSection title="Contact information" description="How to reach the candidate directly.">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            <FormField label="Email" name="email" error={fieldError('email')}>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                placeholder="e.g. jane.doe@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </FormField>
            <PhoneNumbersField name="contactNumber" error={fieldError('contactNumber')} />
          </div>
          <AddressFields line1Error={fieldError('address')} />
        </div>
      </FormSection>

      <Separator />

      <FormSection title="Emergency contact & physician" description="Who to contact if something goes wrong during the medical.">
        <div className="flex flex-col gap-5">
          <ContactFields
            legend="Emergency contact"
            namePrefix="emergencyContact"
            namePlaceholder="e.g. John Doe"
            nameError={fieldError('emergencyContactName')}
            numberError={fieldError('emergencyContactNumber')}
          />
          <ContactFields
            legend="Primary physician"
            namePrefix="primaryPhysician"
            namePlaceholder="e.g. Dr. Andre Simms"
            nameError={fieldError('primaryPhysicianName')}
            numberError={fieldError('primaryPhysicianNumber')}
          />
        </div>
      </FormSection>

      <Separator />

      <FormSection title="Additional notes" description="Anything the medical office should know ahead of time.">
        <FormField label="Medication information" name="medicationInformation" error={fieldError('medicationInformation')}>
          <textarea
            id="medicationInformation"
            name="medicationInformation"
            rows={3}
            maxLength={2000}
            placeholder="e.g. Currently taking blood pressure medication"
            className={TEXTAREA_CLASS}
          />
        </FormField>
      </FormSection>

      {email.trim() ? (
        <>
          <Separator />
          <FormSection
            title="Portal access"
            description="Optional — set a temporary password to let the candidate sign in themselves at the email above. Leave blank to grant access later."
          >
            <div className="flex flex-col gap-5">
              <CredentialsFields showEmail={false} passwordError={fieldError('password')} />
              <ForcePasswordChangeField />
            </div>
          </FormSection>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Enter an email above to also set up the candidate&apos;s portal access.</p>
      )}

      {state?.error && !Object.keys(state.fieldErrors ?? {}).length ? <Alert tone="error">{state.error}</Alert> : null}
    </form>
  );
}
