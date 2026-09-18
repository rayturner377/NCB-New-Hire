import type { AppSettings } from './types';

export type PasswordPolicy = Pick<AppSettings['userPolicy'], 'minPasswordLength' | 'requireUppercase' | 'requireNumber' | 'requireSymbol'>;

/** Shared rule evaluation keeps live feedback aligned with server validation. */
export function passwordRequirements(password: string, policy: PasswordPolicy) {
  const minimum = Math.max(12, policy.minPasswordLength);
  return [
    {
      id: 'length', label: `${minimum}–200 characters`, met: password.length >= minimum && password.length <= 200,
      error: password.length > 200 ? 'Password must be at most 200 characters.' : `Password must be at least ${minimum} characters.`
    },
    ...(policy.requireUppercase ? [{ id: 'uppercase', label: 'An uppercase letter', met: /[A-Z]/.test(password), error: 'Password must include at least one uppercase letter.' }] : []),
    ...(policy.requireNumber ? [{ id: 'number', label: 'A number', met: /[0-9]/.test(password), error: 'Password must include at least one number.' }] : []),
    ...(policy.requireSymbol ? [{ id: 'symbol', label: 'A symbol', met: /[^A-Za-z0-9]/.test(password), error: 'Password must include at least one symbol.' }] : [])
  ];
}

/**
 * Layered on top of each password schema's own static minimum (12 characters
 * — see changePasswordSchema/createUserSchema) rather than replacing it: that
 * 12-char floor always applies regardless of what an admin configures here,
 * and this only adds the org-configurable rules (a higher minimum,
 * uppercase/number/symbol) on top. Called after a schema's own safeParse
 * already succeeded, from every action that sets a password — createUser,
 * changePassword, resetUserPassword.
 */
export function validatePasswordAgainstPolicy(password: string, policy: PasswordPolicy): string | null {
  return passwordRequirements(password, policy).find((requirement) => !requirement.met)?.error ?? null;
}
