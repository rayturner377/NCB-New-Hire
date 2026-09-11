import { FormField } from '../ui/form-field';
import { Input } from '../ui/input';

export interface AddressFieldsProps {
  /** Namespaces every field's name, e.g. "personalInfo." for the patient case form — default '' keeps the candidate form's flat names. */
  namePrefix?: string;
  line1Error?: string;
  defaultLine1?: string;
  defaultLine2?: string;
  defaultCity?: string;
  defaultState?: string;
  defaultCountry?: string;
  disabled?: boolean;
}

/**
 * Address split into line 1/2 (side by side once there's room), city,
 * parish/state, and country. On the candidate form this combines into the
 * single `address` string the schema/storage uses (see lib/address.ts's
 * combineAddress); the patient case form (features/cases) uses the same
 * component but keeps the parts separate, matching the old app's own
 * patientCaseData shape — same fields, same look, different `namePrefix`.
 */
export function AddressFields({
  namePrefix = '',
  line1Error,
  defaultLine1,
  defaultLine2,
  defaultCity,
  defaultState,
  defaultCountry,
  disabled
}: AddressFieldsProps) {
  const line1 = `${namePrefix}addressLine1`;
  const line2 = `${namePrefix}addressLine2`;
  const city = `${namePrefix}city`;
  const state = `${namePrefix}state`;
  const country = `${namePrefix}country`;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        <FormField label="Address line 1" name={line1} error={line1Error}>
          <Input
            id={line1}
            name={line1}
            type="text"
            autoComplete="address-line1"
            maxLength={120}
            placeholder="Street address"
            defaultValue={defaultLine1}
            disabled={disabled}
          />
        </FormField>
        <FormField label="Address line 2" name={line2}>
          <Input
            id={line2}
            name={line2}
            type="text"
            autoComplete="address-line2"
            maxLength={120}
            placeholder="Apartment, suite, etc. (optional)"
            defaultValue={defaultLine2}
            disabled={disabled}
          />
        </FormField>
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-3">
        <FormField label="City / Town" name={city}>
          <Input
            id={city}
            name={city}
            type="text"
            autoComplete="address-level2"
            maxLength={80}
            placeholder="e.g. Kingston"
            defaultValue={defaultCity}
            disabled={disabled}
          />
        </FormField>
        <FormField label="Parish / State" name={state}>
          <Input
            id={state}
            name={state}
            type="text"
            autoComplete="address-level1"
            maxLength={80}
            placeholder="e.g. St. Andrew"
            defaultValue={defaultState}
            disabled={disabled}
          />
        </FormField>
        <FormField label="Country" name={country}>
          <Input
            id={country}
            name={country}
            type="text"
            autoComplete="country-name"
            maxLength={80}
            placeholder="e.g. Jamaica"
            defaultValue={defaultCountry ?? 'Jamaica'}
            disabled={disabled}
          />
        </FormField>
      </div>
    </div>
  );
}
