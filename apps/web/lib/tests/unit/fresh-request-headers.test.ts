import { describe, expect, it, vi } from 'vitest';

const getAll = vi.fn();
vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => getAll() })
}));

const { freshRequestHeaders } = await import('../../fresh-request-headers');

describe('freshRequestHeaders', () => {
  it('serializes every current cookie into a single Cookie header', async () => {
    getAll.mockReturnValue([
      { name: 'session_token', value: 'abc123' },
      { name: 'two_factor', value: 'xyz789' }
    ]);

    const result = await freshRequestHeaders();

    expect(result.get('cookie')).toBe('session_token=abc123; two_factor=xyz789');
  });

  it('produces an empty Cookie header when there are no cookies yet', async () => {
    getAll.mockReturnValue([]);

    const result = await freshRequestHeaders();

    expect(result.get('cookie')).toBe('');
  });
});
