'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { AddressFields } from '../../../components/form/address-fields';
import { ContactFields } from '../../../components/form/contact-fields';
import { DateField } from '../../../components/form/date-field';
import { FormSection } from '../../../components/form/form-section';
import { NameFields } from '../../../components/form/name-fields';
import { PhoneNumbersField } from '../../../components/form/phone-numbers-field';
import { ValidatedSubmitButton } from '../../../components/form/submit-button';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Checkbox } from '../../../components/ui/checkbox';
import { FormField } from '../../../components/ui/form-field';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Separator } from '../../../components/ui/separator';
import { useValidatedForm } from '../../../lib/hooks/use-validated-form';
import { ACTIVATION_CODE_TTL_PRESETS, DEFAULT_ACTIVATION_CODE_TTL_VALUE } from '../../auth/activation-code-ttl';
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
  const [grantPortalAccess, setGrantPortalAccess] = useState(false);
  const [activationCodeTtl, setActivationCodeTtl] = useState(DEFAULT_ACTIVATION_CODE_TTL_VALUE);

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
            <div className="flex flex-col gap-3">
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

              {email.trim() ? (
                <div className="flex flex-col gap-3 rounded-md border border-dashed border-input p-3">
                  <div className="flex items-start gap-2.5">
                    <Checkbox
                      id="grantPortalAccess"
                      name="grantPortalAccess"
                      className="mt-0.5"
                      checked={grantPortalAccess}
                      onCheckedChange={(checked) => setGrantPortalAccess(checked === true)}
                    />
                    <div className="flex flex-col gap-0.5">
                      <Label htmlFor="grantPortalAccess" className="text-sm font-medium leading-none">
                        Grant portal access at the email above
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Optional — they&apos;ll receive an activation code by email to set their own password. Leave
                        unchecked to grant access later.
                      </p>
                    </div>
                  </div>

                  {grantPortalAccess ? (
                    <div className="flex flex-col gap-1.5 pl-6.5">
                      <Label htmlFor="activation-code-ttl-select">Activation code expires in</Label>
                      <input type="hidden" name="activationCodeTtl" value={activationCodeTtl} />
                      <Select value={activationCodeTtl} onValueChange={setActivationCodeTtl}>
                        <SelectTrigger id="activation-code-ttl-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACTIVATION_CODE_TTL_PRESETS.map((preset) => (
                            <SelectItem key={preset.value} value={preset.value}>
                              {preset.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        How long they have to use the code before it expires and a new one needs to be sent.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Enter an email above to also set up portal access.</p>
              )}
            </div>
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

      {state?.error && !Object.keys(state.fieldErrors ?? {}).length ? <Alert tone="error">{state.error}</Alert> : null}
    </form>
  );
}
