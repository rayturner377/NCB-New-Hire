export interface AddressParts {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
}

/** Single-line display of the 5 stored parts — for anywhere that just needs to show "the address," not edit it (e.g. case-form.tsx's candidate summary panel). */
export function formatAddress(parts: AddressParts): string {
  return [parts.addressLine1, parts.addressLine2, parts.city, parts.state, parts.country].filter(Boolean).join(', ');
}
