import { describe, expect, it, vi } from 'vitest';

const headersGet = vi.fn();
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (name: string) => headersGet(name) })
}));

const { getClientIp } = await import('../../client-ip');

describe('getClientIp', () => {
  it('returns the first address in x-forwarded-for', async () => {
    headersGet.mockReturnValue('203.0.113.7, 10.0.0.1');
    expect(await getClientIp()).toBe('203.0.113.7');
  });

  it('trims whitespace around the first address', async () => {
    headersGet.mockReturnValue('  203.0.113.7  , 10.0.0.1');
    expect(await getClientIp()).toBe('203.0.113.7');
  });

  it('falls back to "unknown" when the header is missing', async () => {
    headersGet.mockReturnValue(null);
    expect(await getClientIp()).toBe('unknown');
  });

  it('falls back to "unknown" when the header is blank', async () => {
    headersGet.mockReturnValue('   ');
    expect(await getClientIp()).toBe('unknown');
  });
});
