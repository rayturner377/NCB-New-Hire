'use client';

import Link from 'next/link';
import { CredentialsFields } from '../../../components/form/credentials-fields';
import { DoctorProfileFields, type DoctorProfileFieldsOffice } from '../../../components/form/doctor-profile-fields';
import { FormSection } from '../../../components/form/form-section';
import { NameFields } from '../../../components/form/name-fields';
import { ValidatedSubmitButton } from '../../../components/form/submit-button';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Combobox } from '../../../components/ui/combobox';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Separator } from '../../../components/ui/separator';
import { ACTIVATION_CODE_TTL_PRESETS, DEFAULT_ACTIVATION_CODE_TTL_VALUE } from '../../auth/activation-code-ttl';
import { useValidatedForm } from '../../../lib/hooks/use-validated-form';
import { createUserAction, type UserActionResult } from '../actions/create-user';
import type { Role } from '../../../lib/permissions';
import type { UserSummary } from '../types';
import { useActionState, useEffect, useState } from 'react';

const initialState: UserActionResult | null = null;

export interface UserFormProps {
  /** The account type this form creates — fixed by which "+ New" route got here (e.g. /doctors/new), not user-selectable, since the route already says what kind of account is being made. */
  role: Role;
  roleLabel: string;
  /** Where "Cancel" and a successful create both send the admin back to. */
  cancelHref: string;
  /** Only meaningful when role === 'clinician' — see DoctorProfileFields. */
  offices?: DoctorProfileFieldsOffice[];
  /** Only meaningful when role === 'delegate' — which doctor this assistant can be assigned to support. */
  doctors?: UserSummary[];
}

/**
 * Reused for every staff account type (doctor/reviewer/admin) rather than
 * one form per role — the fields are identical (name, login email); only the
 * role differs, and that's fixed by the page this form is rendered on. Same
 * validated-submit treatment as CandidateForm (components/form/submit-button.tsx
 * + lib/hooks/use-validated-form.ts).
 */
export function UserForm({ role, roleLabel, cancelHref, offices = [], doctors = [] }: UserFormProps) {
  const [state, formAction] = useActionState(createUserAction, initialState);
  const { formRef, formValid, refreshValidity, handleSubmit, fieldError, hasClientErrors } = useValidatedForm(state?.fieldErrors);
  const [email, setEmail] = useState('');
  const [delegateForClinicianId, setDelegateForClinicianId] = useState('');
  const [activationCodeTtl, setActivationCodeTtl] = useState(DEFAULT_ACTIVATION_CODE_TTL_VALUE);
  const doctorOptions = doctors.map((doctor) => ({ value: doctor.id, label: doctor.displayName, description: doctor.email }));

  // Picking an option in the Combobox's popover doesn't fire a native DOM "change" event the way a
  // real <select>/<input> does, so the form's own onChange={refreshValidity} (see the <form> below)
  // never notices it — without this, the Create button stayed disabled/stale until something else
  // (e.g. the activation-code Select) happened to trigger a real change event afterward.
  useEffect(() => {
    refreshValidity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delegateForClinicianId]);

  return (
    <form ref={formRef} action={formAction} onSubmit={handleSubmit} onChange={refreshValidity} className="flex flex-col gap-8">
      <div className="sticky top-0 z-10 -mx-6 -mt-6 flex items-center justify-between gap-4 border-b bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <p className="text-sm text-muted-foreground">
          Fields marked <span className="text-destructive">*</span> are required.
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href={cancelHref}>Cancel</Link>
          </Button>
          <ValidatedSubmitButton formValid={formValid} label={`Create ${roleLabel.toLowerCase()}`} pendingLabel="Creating…" />
        </div>
      </div>

      {hasClientErrors ? (
        <Alert tone="error">Please fill in the required fields highlighted below before creating the account.</Alert>
      ) : null}

      <input type="hidden" name="role" value={role} />

      <FormSection title="Account type" description="Fixed by where this form was opened from.">
        <p className="text-sm font-medium">{roleLabel}</p>
      </FormSection>

      <Separator />

      <FormSection title="Personal information" description="Who this account belongs to.">
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          <NameFields firstNameError={fieldError('firstName') ?? fieldError('displayName')} lastNameError={fieldError('lastName')} />
        </div>
      </FormSection>

      <Separator />

      <FormSection title="Login credentials" description="They'll receive an activation code by email to set their own password.">
        <div className="flex flex-col gap-3">
          <CredentialsFields
            emailRequired
            emailError={fieldError('email')}
            onEmailChange={role === 'delegate' ? setEmail : undefined}
          />

          {role === 'delegate' && email.trim() ? (
            <div className="flex flex-col gap-1.5 pl-0.5 sm:max-w-sm">
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
      </FormSection>

      {role === 'clinician' ? (
        <>
          <Separator />
          <FormSection title="Doctor details" description="Which facility they're based at and how they bill for medicals.">
            <DoctorProfileFields offices={offices} />
          </FormSection>
        </>
      ) : null}

      {role === 'delegate' ? (
        <>
          <Separator />
          <FormSection title="Delegate details" description="Which doctor this assistant will see the inbox and case history for.">
            <div className="flex flex-col gap-1.5 sm:max-w-sm">
              <Label htmlFor="delegateForClinicianId">
                Supports doctor <span className="text-destructive">*</span>
              </Label>
              <Combobox
                options={doctorOptions}
                value={delegateForClinicianId}
                onChange={setDelegateForClinicianId}
                placeholder="Select a doctor…"
                searchPlaceholder="Search by doctor name or email…"
                emptyText="No doctor found."
              />
              {/* Deliberately not type="hidden" — a hidden input is barred from HTML constraint validation
                  entirely, so `required` on one is silently ignored and the Create button would enable
                  itself before a doctor is actually chosen. sr-only keeps it out of view while still
                  participating in checkValidity()/reportValidity() like every other required field here. */}
              <input
                type="text"
                id="delegateForClinicianId"
                name="delegateForClinicianId"
                value={delegateForClinicianId}
                onChange={() => {}}
                required
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              />
              {fieldError('delegateForClinicianId') ? (
                <p className="text-xs font-medium text-destructive">{fieldError('delegateForClinicianId')}</p>
              ) : null}
            </div>
          </FormSection>
        </>
      ) : null}

      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
    </form>
  );
}
