import { FormField } from '../ui/form-field';
import { Input } from '../ui/input';
import { PasswordInput } from '../ui/password-input';
import { cn } from '../../lib/utils';

export interface CredentialsFieldsProps {
  /** Users need their own email input; candidates already collect one earlier in the form, so this section reuses it instead of duplicating the field. */
  showEmail?: boolean;
  emailLabel?: string;
  emailDefaultValue?: string;
  emailError?: string;
  passwordLabel?: string;
  passwordRequired?: boolean;
  passwordHelp?: string;
  passwordError?: string;
}

/**
 * Login-credentials field pair — reused wherever a form creates an account
 * capable of signing in: the Users page (admin/reviewer/doctor/patient) and
 * the Candidates "grant portal access" section. Rendered side by side (one
 * associated unit, not two stray fields) so the relationship between "the
 * email" and "the password for that email" reads at a glance. Keeping this
 * in one place also means the password rule (12-char minimum) only has to
 * be right once.
 */
export function CredentialsFields({
  showEmail = true,
  emailLabel = 'Email',
  emailDefaultValue = '',
  emailError,
  passwordLabel = 'Temporary password',
  passwordRequired = false,
  passwordHelp,
  passwordError
}: CredentialsFieldsProps) {
  return (
    <div className={cn('grid grid-cols-1 gap-4', showEmail && 'sm:grid-cols-2')}>
      {showEmail ? (
        <FormField label={emailLabel} name="email" required={passwordRequired} error={emailError}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            defaultValue={emailDefaultValue}
            required={passwordRequired}
          />
        </FormField>
      ) : null}

      <FormField label={passwordLabel} name="password" required={passwordRequired} description={passwordHelp} error={passwordError}>
        <PasswordInput id="password" name="password" autoComplete="new-password" minLength={12} maxLength={200} required={passwordRequired} />
      </FormField>
    </div>
  );
}
