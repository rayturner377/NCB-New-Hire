/** Combines a form's separate firstName/lastName inputs into the single `fullName` string the schema/storage actually uses. */
export function combineFullName(formData: FormData): string {
  const firstName = String(formData.get('firstName') || '').trim();
  const lastName = String(formData.get('lastName') || '').trim();
  return [firstName, lastName].filter(Boolean).join(' ');
}

/** The reverse, for pre-filling an edit form from a stored fullName. */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const [firstName = '', ...rest] = fullName.trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') };
}
