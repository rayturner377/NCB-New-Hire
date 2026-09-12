import { describe, expect, it } from 'vitest';
import { substituteVariables, substituteBodyVariables } from '../../template-rendering';

describe('substituteVariables', () => {
  it('replaces every {{variable}} occurrence with its value', () => {
    expect(substituteVariables('Hello {{name}}, your case {{caseId}} is ready.', { name: 'Jane', caseId: 'C-1' })).toBe(
      'Hello Jane, your case C-1 is ready.'
    );
  });

  it('leaves an unresolved placeholder as-is rather than blanking it', () => {
    expect(substituteVariables('Hello {{name}}', {})).toBe('Hello {{name}}');
  });
});

describe('substituteBodyVariables', () => {
  it('substitutes plain text values normally', () => {
    expect(substituteBodyVariables('Hi {{name}}', { name: 'Jane' })).toBe('Hi Jane');
  });

  it('leaves an unresolved placeholder as-is', () => {
    expect(substituteBodyVariables('Hi {{name}}', {})).toBe('Hi {{name}}');
  });

  it('de-activates a URL-like substituted value per the email style guide', () => {
    const result = substituteBodyVariables('Visit {{loginUrl}}', { loginUrl: 'https://portal.ncb.local/login' });
    expect(result).not.toContain('https://portal.ncb.local/login');
    expect(result).toContain('letter-spacing');
  });
});
