import { FormField } from '../ui/form-field';
import { Input } from '../ui/input';
import { PhoneNumbersField } from './phone-numbers-field';

export interface ContactFieldsProps {
  /** Human label for this contact, e.g. "Emergency contact" or "Primary physician". */
  legend: string;
  /** Field-name prefix — inputs are named `${namePrefix}Name` and `${namePrefix}Number`. Can include an outer namespace too, e.g. "personalInfo.emergencyContact". */
  namePrefix: string;
  namePlaceholder?: string;
  nameError?: string;
  numberError?: string;
  defaultName?: string;
  defaultNumber?: string;
  disabled?: boolean;
}

/**
 * A single reusable {@link Contact} (name + phone number) — used for the
 * candidate's emergency contact and primary physician, and reused as-is by
 * the patient case form's own emergency-contact/primary-physician fields
 * (same shape in both the candidate profile and the old app's
 * patientCaseData), so a candidate's existing contact pre-fills here instead
 * of being re-typed. Reuses PhoneNumbersField capped at one number, since a
 * contact-of-record only needs the one line to reach them on.
 */
export function ContactFields({
  legend,
  namePrefix,
  namePlaceholder,
  nameError,
  numberError,
  defaultName,
  defaultNumber,
  disabled
}: ContactFieldsProps) {
  const nameField = `${namePrefix}Name`;
  const numberField = `${namePrefix}Number`;

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
      <FormField label={`${legend} name`} name={nameField} error={nameError}>
        <Input id={nameField} name={nameField} type="text" maxLength={140} placeholder={namePlaceholder} defaultValue={defaultName} disabled={disabled} />
      </FormField>
      <PhoneNumbersField
        name={numberField}
        label={`${legend} phone number`}
        maxNumbers={1}
        error={numberError}
        defaultValues={defaultNumber ? [defaultNumber] : undefined}
        disabled={disabled}
      />
    </div>
  );
}
