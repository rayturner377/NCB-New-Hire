import type { AppSettings } from './types';

/**
 * Layered on top of each password schema's own static minimum (12 characters
 * — see changePasswordSchema/createUserSchema) rather than replacing it: that
 * 12-char floor always applies regardless of what an admin configures here,
 * and this only adds the org-configurable rules (a higher minimum,
 * uppercase/number/symbol) on top. Called after a schema's own safeParse
 * already succeeded, from every action that sets a password — createUser,
 * changePassword, resetUserPassword.
 */
export function validatePasswordAgainstPolicy(password: string, policy: AppSettings['userPolicy']): string | null {
  if (password.length < policy.minPasswordLength) {
    return `Password must be at least ${policy.minPasswordLength} characters.`;
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    return 'Password must include at least one uppercase letter.';
  }
  if (policy.requireNumber && !/[0-9]/.test(password)) {
    return 'Password must include at least one number.';
  }
  if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include at least one symbol.';
  }
  return null;
}
