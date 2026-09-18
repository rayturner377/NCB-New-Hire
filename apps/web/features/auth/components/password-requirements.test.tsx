import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PasswordRequirements } from './password-requirements';
import { passwordRequirements, validatePasswordAgainstPolicy, type PasswordPolicy } from '../../settings/password-policy';
import { DEFAULT_SETTINGS, publicSettings } from '../../settings/types';

const policy: PasswordPolicy = { minPasswordLength: 16, requireUppercase: true, requireNumber: true, requireSymbol: true };

describe('live password requirements', () => {
  it.each(['', 'abcdefghijklmnop', 'Abcdefghijklmnop', 'Abcdefghijklmno1', 'Abcdefghijklmno1!', 'A1!' + 'a'.repeat(198)])(
    'agrees with server validation for password example %#', (password) => {
      const requirements = passwordRequirements(password, policy);
      expect(requirements.every((requirement) => requirement.met)).toBe(validatePasswordAgainstPolicy(password, policy) === null);
    }
  );

  it('shows the configured minimum and only enabled rules', () => {
    const rules = passwordRequirements('abcdefghijk', { ...policy, minPasswordLength: 8, requireUppercase: false, requireNumber: false, requireSymbol: false });
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ label: '12–200 characters', met: false });
    expect(passwordRequirements('abcdefghijklmnop', policy)[0]?.met).toBe(true);
  });

  it('renders quiet initial guidance and a completion announcement without exposing the password', () => {
    const initial = renderToStaticMarkup(<PasswordRequirements id="rules" policy={policy} password="" />);
    expect(initial).toContain('0 of 4 met');
    expect(initial).toContain('16–200 characters');
    expect(initial).toContain('aria-valuenow="0"');
    const complete = renderToStaticMarkup(<PasswordRequirements id="rules" policy={policy} password="Abcdefghijklmno1!" />);
    expect(complete).toContain('All requirements met');
    expect(complete).toContain('aria-valuenow="100"');
    expect(complete).not.toContain('Abcdefghijklmno1!');
  });

  it('exposes only password requirements from the user policy in public settings', () => {
    const settings = publicSettings({ ...DEFAULT_SETTINGS, userPolicy: { ...DEFAULT_SETTINGS.userPolicy, ...policy } });
    expect(settings.passwordPolicy).toEqual(policy);
    expect(settings).not.toHaveProperty('mail');
    expect(settings.passwordPolicy).not.toHaveProperty('loginMaxAttempts');
  });
});
