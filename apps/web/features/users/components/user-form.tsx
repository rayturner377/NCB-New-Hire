'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { CredentialsFields } from '../../../components/form/credentials-fields';
import { DoctorProfileFields, type DoctorProfileFieldsOffice } from '../../../components/form/doctor-profile-fields';
import { ForcePasswordChangeField } from '../../../components/form/force-password-change-field';
import { FormSection } from '../../../components/form/form-section';
import { NameFields } from '../../../components/form/name-fields';
import { ValidatedSubmitButton } from '../../../components/form/submit-button';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Separator } from '../../../components/ui/separator';
import { useValidatedForm } from '../../../lib/hooks/use-validated-form';
import { createUserAction, type UserActionResult } from '../actions/create-user';
import type { Role } from '../../../lib/permissions';

const initialState: UserActionResult | null = null;

export interface UserFormProps {
  /** The account type this form creates — fixed by which "+ New" route got here (e.g. /doctors/new), not user-selectable, since the route already says what kind of account is being made. */
  role: Role;
  roleLabel: string;
  /** Where "Cancel" and a successful create both send the admin back to. */
  cancelHref: string;
  /** Only meaningful when role === 'clinician' — see DoctorProfileFields. */
  offices?: DoctorProfileFieldsOffice[];
}

/**
 * Reused for every staff account type (doctor/reviewer/admin) rather than
 * one form per role — the fields are identical (name, login email, temporary
 * password); only the role differs, and that's fixed by the page this form
 * is rendered on. Same validated-submit treatment as CandidateForm
 * (components/form/submit-button.tsx + lib/hooks/use-validated-form.ts).
 */
export function UserForm({ role, roleLabel, cancelHref, offices = [] }: UserFormProps) {
  const [state, formAction] = useFormState(createUserAction, initialState);
  const { formRef, formValid, refreshValidity, handleSubmit, fieldError, hasClientErrors } = useValidatedForm(state?.fieldErrors);

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

      <FormSection title="Login credentials" description="What they'll use to sign in — share the temporary password with them directly.">
        <div className="flex flex-col gap-5">
          <CredentialsFields passwordRequired emailError={fieldError('email')} passwordError={fieldError('password')} />
          <ForcePasswordChangeField />
        </div>
      </FormSection>

      {role === 'clinician' ? (
        <>
          <Separator />
          <FormSection title="Doctor details" description="Facility and billing information ported from the old doctor setup form.">
            <DoctorProfileFields offices={offices} />
          </FormSection>
        </>
      ) : null}

      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
    </form>
  );
}
