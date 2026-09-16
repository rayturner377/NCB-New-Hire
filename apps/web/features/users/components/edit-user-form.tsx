'use client';

import { DoctorProfileFields, type DoctorProfileFieldsOffice } from '../../../components/form/doctor-profile-fields';
import { FormSection } from '../../../components/form/form-section';
import { NameFields } from '../../../components/form/name-fields';
import { ValidatedSubmitButton } from '../../../components/form/submit-button';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Combobox } from '../../../components/ui/combobox';
import { Label } from '../../../components/ui/label';
import { Separator } from '../../../components/ui/separator';
import { splitFullName } from '../../../lib/full-name';
import { useValidatedForm } from '../../../lib/hooks/use-validated-form';
import { updateUserAction, type UpdateUserActionResult } from '../actions/update-user';
import { UserPermissionOverridesForm } from './user-permission-overrides-form';
import type { PermissionOption } from '../../../lib/permissions';
import type { UserSummary } from '../types';
import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';

const initialState: UpdateUserActionResult | null = null;

export interface EditUserFormProps {
  user: UserSummary;
  roleLabel: string;
  /** Where "Cancel" and a successful save both send the admin back to — the role's own list page. */
  cancelHref: string;
  /** Only meaningful when user.role === 'clinician' — see DoctorProfileFields. */
  offices?: DoctorProfileFieldsOffice[];
  /** Only meaningful when user.role === 'delegate' — which doctor this assistant can be reassigned to. */
  doctors?: UserSummary[];
  /** Only present when the viewer holds ROLES_MANAGE — see users-table.tsx's own comment. */
  allPermissions?: PermissionOption[];
}

/**
 * The full-page replacement for the old EditUserDialog modal — same fields
 * (name, and for a doctor its facility/rate/registration, or for a delegate
 * which doctor it supports), just on its own route instead of cramped into a
 * dialog, per the same "modal is too restrictive for this" feedback that
 * moved doctor case entry off a dialog earlier. Email/role stay fixed here,
 * same as the dialog before it — this is a rename/profile-update surface,
 * not account recreation.
 */
export function EditUserForm({ user, roleLabel, cancelHref, offices = [], doctors = [], allPermissions }: EditUserFormProps) {
  const [state, formAction] = useActionState(updateUserAction, initialState);
  const { formRef, formValid, refreshValidity, handleSubmit, fieldError, hasClientErrors } = useValidatedForm(state?.fieldErrors);
  const { firstName, lastName } = splitFullName(user.displayName);
  const profile = user.medicalProfile as {
    officeUserType?: 'doctor' | 'clinician';
    facilityId?: string;
    facilityName?: string;
    facilityAddress?: string;
    registrationNumber?: string;
    defaultMedicalFee?: number;
  };
  const [delegateForClinicianId, setDelegateForClinicianId] = useState(user.delegateForClinicianId ?? '');
  const doctorOptions = doctors.map((doctor) => ({ value: doctor.id, label: doctor.displayName, description: doctor.email }));

  // Picking an option in the Combobox's popover doesn't fire a native DOM "change" event the way a
  // real <select>/<input> does, so the form's own onChange={refreshValidity} (see the <form> below)
  // never notices it — without this, Save stayed disabled/stale until something else triggered a
  // real change event afterward. See user-form.tsx's identical fix for the create-side Combobox.
  useEffect(() => {
    refreshValidity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delegateForClinicianId]);

  return (
    <div className="flex flex-col gap-8">
      <form ref={formRef} action={formAction} onSubmit={handleSubmit} onChange={refreshValidity} className="flex flex-col gap-8">
        <div className="sticky top-0 z-10 -mx-6 -mt-6 flex items-center justify-between gap-4 border-b bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <p className="text-sm text-muted-foreground">
            Fields marked <span className="text-destructive">*</span> are required.
          </p>
          <div className="flex shrink-0 items-center gap-3">
            <Button type="button" variant="outline" asChild>
              <Link href={cancelHref}>Cancel</Link>
            </Button>
            <ValidatedSubmitButton formValid={formValid} label="Save changes" pendingLabel="Saving…" />
          </div>
        </div>

        {hasClientErrors ? (
          <Alert tone="error">Please fill in the required fields highlighted below before saving.</Alert>
        ) : null}

        <input type="hidden" name="userId" value={user.id} />
        <input type="hidden" name="role" value={user.role} />

        <FormSection title="Account type" description="Fixed for the life of the account.">
          <p className="text-sm font-medium">
            {roleLabel} <span className="font-normal text-muted-foreground">— {user.email}</span>
          </p>
        </FormSection>

        <Separator />

        <FormSection title="Personal information" description="Who this account belongs to.">
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            <NameFields
              firstNameDefault={firstName}
              lastNameDefault={lastName}
              firstNameError={fieldError('firstName') ?? fieldError('displayName')}
              lastNameError={fieldError('lastName')}
            />
          </div>
        </FormSection>

        {user.role === 'clinician' ? (
          <>
            <Separator />
            <FormSection title="Doctor details" description="Which facility they're based at and how they bill for medicals.">
              <DoctorProfileFields
                offices={offices}
                defaultOfficeUserType={profile.officeUserType ?? 'doctor'}
                defaultFacilityId={profile.facilityId ?? ''}
                defaultRegistrationNumber={profile.registrationNumber ?? ''}
                defaultFee={profile.defaultMedicalFee}
              />
            </FormSection>
          </>
        ) : null}

        {user.role === 'delegate' ? (
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
                {/* Deliberately not type="hidden" — a hidden input is barred from HTML constraint
                    validation entirely, so `required` on one is silently ignored and Save would enable
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

      {allPermissions ? (
        <>
          <Separator />
          <UserPermissionOverridesForm
            userId={user.id}
            allPermissions={allPermissions}
            grant={user.permissionOverrides.grant}
            revoke={user.permissionOverrides.revoke}
          />
        </>
      ) : null}
    </div>
  );
}
