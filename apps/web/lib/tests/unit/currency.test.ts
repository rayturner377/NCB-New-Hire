import { describe, expect, it } from 'vitest';
import { formatCurrency } from '../../currency';

describe('formatCurrency', () => {
  it('formats a positive amount as JMD with no decimal places', () => {
    expect(formatCurrency(1500)).toBe('$1,500');
  });

  it('treats a falsy value as zero', () => {
    expect(formatCurrency(0)).toBe('$0');
  });
});
