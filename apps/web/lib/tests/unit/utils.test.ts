import { describe, expect, it } from 'vitest';
import { cn } from '../../utils';

describe('cn', () => {
  it('merges class names, letting a later Tailwind utility win over an earlier conflicting one', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('drops falsy values', () => {
    expect(cn('text-sm', false, undefined, null, 'font-bold')).toBe('text-sm font-bold');
  });
});
