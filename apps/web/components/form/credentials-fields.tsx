import { FormField } from '../ui/form-field';
import { Input } from '../ui/input';

export interface CredentialsFieldsProps {
  emailLabel?: string;
  emailDefaultValue?: string;
  emailRequired?: boolean;
  emailError?: string;
  /** Only needed by a caller that reacts to what's typed (e.g. UserForm's delegate activation-code-duration picker, which only appears once an email is entered) — the field stays uncontrolled (defaultValue) otherwise. */
  onEmailChange?: (value: string) => void;
}

/**
 * The login-email field — reused wherever a form creates an account capable
 * of signing in: the Users page (admin/reviewer/doctor/patient) and the
 * Candidates "grant portal access" section. No password field here anymore —
 * accounts are activated by emailed code (see AccessCode's doc comment in
 * schema.prisma), not an admin-chosen password.
 */
export function CredentialsFields({
  emailLabel = 'Email',
  emailDefaultValue = '',
  emailRequired = false,
  emailError,
  onEmailChange
}: CredentialsFieldsProps) {
  return (
    <FormField label={emailLabel} name="email" required={emailRequired} error={emailError}>
      <Input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        maxLength={254}
        defaultValue={emailDefaultValue}
        required={emailRequired}
        onChange={onEmailChange ? (event) => onEmailChange(event.target.value) : undefined}
      />
    </FormField>
  );
}
