import { describe, expect, it } from 'vitest';
import { initials } from '../../initials';

describe('initials', () => {
  it('returns first + last initial for a two-part name', () => {
    expect(initials('Andrea Campbell')).toBe('AC');
  });

  it('returns just the first initial for a single-word name', () => {
    expect(initials('Cher')).toBe('C');
  });

  it('uses the first and last of a multi-part name, ignoring the middle', () => {
    expect(initials('Mary Jane Watson')).toBe('MW');
  });

  it('falls back to "?" for an empty/whitespace-only name', () => {
    expect(initials('   ')).toBe('?');
  });
});
