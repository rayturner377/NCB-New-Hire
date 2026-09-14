/**
 * Admin-facing presets for how long a candidate's initial activation code
 * stays redeemable, offered on the candidate-creation form (see
 * candidate-form.tsx's "Portal access" section) — not used for
 * password-reset codes, which always get access-codes-service.ts's own
 * fixed default regardless of who triggers them. Plain values (no server-
 * only imports) so this can be shared by both the client form and the
 * server action that validates the submitted choice.
 */
export interface ActivationCodeTtlPreset {
  value: string;
  label: string;
  minutes: number;
}

export const ACTIVATION_CODE_TTL_PRESETS: ActivationCodeTtlPreset[] = [
  { value: '15m', label: '15 minutes', minutes: 15 },
  { value: '1h', label: '1 hour', minutes: 60 },
  { value: '24h', label: '24 hours', minutes: 24 * 60 },
  { value: '48h', label: '48 hours', minutes: 48 * 60 }
];

export const DEFAULT_ACTIVATION_CODE_TTL_VALUE = '24h';

export function activationCodeTtlMinutesFor(value: string | null | undefined): number | undefined {
  return ACTIVATION_CODE_TTL_PRESETS.find((preset) => preset.value === value)?.minutes;
}
