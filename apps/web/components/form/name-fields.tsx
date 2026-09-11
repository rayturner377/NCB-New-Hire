import { FormField } from '../ui/form-field';
import { Input } from '../ui/input';

export interface NameFieldsProps {
  firstNameDefault?: string;
  lastNameDefault?: string;
  required?: boolean;
  firstNameError?: string;
  lastNameError?: string;
}

/**
 * First/last name pair, submitted separately and combined into the single
 * `fullName` field the schema/storage actually uses (see lib/full-name.ts's
 * combineFullName) — the old app only ever had one "Full name" input, but a
 * split pair reads better and gives cleaner data going forward. Reusable
 * wherever a person record is created.
 */
export function NameFields({ firstNameDefault = '', lastNameDefault = '', required = true, firstNameError, lastNameError }: NameFieldsProps) {
  return (
    <>
      <FormField label="First name" name="firstName" required={required} error={firstNameError}>
        <Input
          id="firstName"
          name="firstName"
          type="text"
          autoComplete="given-name"
          maxLength={70}
          defaultValue={firstNameDefault}
          required={required}
        />
      </FormField>
      <FormField label="Last name" name="lastName" required={required} error={lastNameError}>
        <Input
          id="lastName"
          name="lastName"
          type="text"
          autoComplete="family-name"
          maxLength={70}
          defaultValue={lastNameDefault}
          required={required}
        />
      </FormField>
    </>
  );
}
