import { describe, expect, it } from 'vitest';
import { hashForAudit } from '../../audit-hash.js';

describe('audit-hash', () => {
  it('is deterministic for the same input', () => {
    expect(hashForAudit('user@example.com')).toBe(hashForAudit('user@example.com'));
  });

  it('differs for different input', () => {
    expect(hashForAudit('a@example.com')).not.toBe(hashForAudit('b@example.com'));
  });

  it('does not throw on null or undefined and treats them the same as empty string', () => {
    expect(() => hashForAudit(null)).not.toThrow();
    expect(() => hashForAudit(undefined)).not.toThrow();
    expect(hashForAudit(null)).toBe(hashForAudit(undefined));
    expect(hashForAudit(null)).toBe(hashForAudit(''));
  });
});
