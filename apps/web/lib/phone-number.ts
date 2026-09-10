/** Combines however many phone-number entries a form submitted under one field name (see components/form/phone-numbers-field.tsx) into a single stored string. Each entry is already a full E.164 number by the time it's submitted, courtesy of react-phone-number-input's country picker. */
export function combineContactNumbers(formData: FormData, name = 'contactNumber'): string {
  return formData
    .getAll(name)
    .map((value) => String(value).trim())
    .filter(Boolean)
    .join(', ');
}
