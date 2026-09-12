import { describe, expect, it } from 'vitest';
import { formatAddress } from '../../address';

describe('formatAddress', () => {
  it('joins every part with a comma', () => {
    expect(
      formatAddress({ addressLine1: '12 Main St', addressLine2: 'Apt 3', city: 'Kingston', state: 'St. Andrew', country: 'Jamaica' })
    ).toBe('12 Main St, Apt 3, Kingston, St. Andrew, Jamaica');
  });

  it('skips blank parts rather than leaving stray commas', () => {
    expect(formatAddress({ addressLine1: '12 Main St', addressLine2: '', city: 'Kingston', state: '', country: 'Jamaica' })).toBe(
      '12 Main St, Kingston, Jamaica'
    );
  });
});
