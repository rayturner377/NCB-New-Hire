'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { DoctorProfileFields, type DoctorProfileFieldsOffice } from '../../../components/form/doctor-profile-fields';
import { NameFields } from '../../../components/form/name-fields';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '../../../components/ui/dialog';
import { splitFullName } from '../../../lib/full-name';
import { updateUserAction, type UpdateUserActionResult } from '../actions/update-user';
import { UserPermissionOverridesForm } from './user-permission-overrides-form';
import type { PermissionOption } from '../../../lib/permissions';
import type { UserSummary } from '../types';

const initialState: UpdateUserActionResult | null = null;

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Save changes'}
    </Button>
  );
}

/** Rename an account (and, for doctors, its facility/registration/rate) — reuses the same NameFields/DoctorProfileFields as the create form, just pre-filled. */
export interface EditUserDialogProps {
  user: UserSummary;
  offices?: DoctorProfileFieldsOffice[];
  /** Only an admin (ROLES_MANAGE) sees the "Extra permissions" section — see users-table.tsx. */
  allPermissions?: PermissionOption[];
}

export function EditUserDialog({ user, offices = [], allPermissions }: EditUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(updateUserAction, initialState);
  const { firstName, lastName } = splitFullName(user.displayName);
  const profile = user.medicalProfile as {
    officeUserType?: 'doctor' | 'clinician';
    facilityId?: string;
    facilityName?: string;
    facilityAddress?: string;
    registrationNumber?: string;
    defaultMedicalFee?: number;
  };

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form action={formAction} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Edit {user.displayName}</DialogTitle>
            <DialogDescription>{user.email}</DialogDescription>
          </DialogHeader>

          <input type="hidden" name="userId" value={user.id} />
          <input type="hidden" name="role" value={user.role} />

          <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
            <NameFields firstNameDefault={firstName} lastNameDefault={lastName} />
          </div>

          {user.role === 'clinician' ? (
            <DoctorProfileFields
              offices={offices}
              defaultOfficeUserType={profile.officeUserType ?? 'doctor'}
              defaultFacilityId={profile.facilityId ?? ''}
              defaultRegistrationNumber={profile.registrationNumber ?? ''}
              defaultFee={profile.defaultMedicalFee}
            />
          ) : null}

          {state?.error ? <Alert tone="error">{state.error}</Alert> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SaveButton />
          </DialogFooter>
        </form>

        {allPermissions ? (
          <UserPermissionOverridesForm
            userId={user.id}
            allPermissions={allPermissions}
            grant={user.permissionOverrides.grant}
            revoke={user.permissionOverrides.revoke}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
