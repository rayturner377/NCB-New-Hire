'use client';

import Link from 'next/link';
import { useFormStatus } from 'react-dom';
import { AddressFields } from '../../../components/form/address-fields';
import { EmailsField } from '../../../components/form/emails-field';
import { PhoneNumbersField } from '../../../components/form/phone-numbers-field';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { FormField } from '../../../components/ui/form-field';
import { Input } from '../../../components/ui/input';
import { createMedicalOfficeAction, type MedicalOfficeActionResult } from '../actions/create-medical-office';
import { updateMedicalOfficeAction } from '../actions/update-medical-office';
import { useActionState } from 'react';

const initialState: MedicalOfficeActionResult | null = null;

export interface MedicalOfficeFormProps {
  /** Present only when editing an existing facility — switches the form to updateMedicalOfficeAction and pre-fills every field. Omit to create a new one. */
  office?: {
    id: string;
    name: string;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    phone: string | null;
    email: string | null;
    defaultMedicalFee: number;
  };
}

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create facility'}
    </Button>
  );
}

/**
 * A medical facility a doctor can be assigned to (see doctor-profile-fields.tsx's
 * facility picker) — name/address/phone/email plus a default per-medical
 * rate new doctors at this facility can start from. Doubles as the edit form
 * (see MedicalOfficeFormProps.office) rather than a separate component,
 * since every field is identical — only the action and starting values
 * differ. Address/phone/email reuse the same shared components the
 * candidate/patient forms use (AddressFields/PhoneNumbersField/EmailsField)
 * rather than one-off plain inputs — PhoneNumbersField/EmailsField are
 * capped at a single entry here (`maxNumbers`/`maxEmails` = 1) since a
 * facility has just the one main line and inbox, not a personal list.
 */
export function MedicalOfficeForm({ office }: MedicalOfficeFormProps) {
  const isEdit = Boolean(office);
  const [state, formAction] = useActionState(isEdit ? updateMedicalOfficeAction : createMedicalOfficeAction, initialState);
  const cancelHref = isEdit ? `/medical-offices/${office!.id}` : '/doctors?tab=offices';

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {isEdit ? <input type="hidden" name="officeId" value={office!.id} /> : null}

      <FormField label="Facility name" name="name" required error={state?.fieldErrors?.name}>
        <Input
          id="name"
          name="name"
          type="text"
          maxLength={180}
          placeholder="e.g. New Kingston Medical Centre"
          defaultValue={office?.name}
          required
        />
      </FormField>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Address</p>
        <AddressFields
          line1Error={state?.fieldErrors?.addressLine1}
          defaultLine1={office?.addressLine1 ?? ''}
          defaultLine2={office?.addressLine2 ?? ''}
          defaultCity={office?.city ?? ''}
          defaultState={office?.state ?? ''}
          defaultCountry={office?.country ?? ''}
        />
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        <PhoneNumbersField
          name="phone"
          label="Phone"
          maxNumbers={1}
          error={state?.fieldErrors?.phone}
          defaultValues={office?.phone ? [office.phone] : undefined}
        />

        <EmailsField name="email" label="Email" maxEmails={1} defaultValues={office?.email ? [office.email] : undefined} className="" />
      </div>

      <FormField
        label="Default rate"
        name="defaultMedicalFee"
        error={state?.fieldErrors?.defaultMedicalFee}
        description="Starting point for a doctor assigned here — each doctor's own rate is still set (and can be changed) on their account."
        className="sm:max-w-xs"
      >
        <Input id="defaultMedicalFee" name="defaultMedicalFee" type="number" min={0} step="0.01" defaultValue={office?.defaultMedicalFee} />
      </FormField>

      {state?.error && !Object.keys(state.fieldErrors ?? {}).length ? <Alert tone="error">{state.error}</Alert> : null}

      <div className="flex items-center gap-3 border-t pt-4">
        <SubmitButton isEdit={isEdit} />
        <Button type="button" variant="outline" asChild>
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
