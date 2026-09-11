import { describe, expect, it, vi } from 'vitest';

const headerMap = new Map<string, string>();
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (name: string) => headerMap.get(name) ?? null })
}));

const { OriginMismatchError, assertSameOrigin } = await import('../../assert-same-origin');

describe('assertSameOrigin', () => {
  it('allows a request whose Origin matches Host', async () => {
    headerMap.set('origin', 'https://ncb-medical.internal');
    headerMap.set('host', 'ncb-medical.internal');

    await expect(assertSameOrigin()).resolves.toBeUndefined();
  });

  it('allows a request with no Origin header (same-origin navigation)', async () => {
    headerMap.delete('origin');
    headerMap.set('host', 'ncb-medical.internal');

    await expect(assertSameOrigin()).resolves.toBeUndefined();
  });

  it('rejects a mismatched Origin', async () => {
    headerMap.set('origin', 'https://attacker.example');
    headerMap.set('host', 'ncb-medical.internal');

    await expect(assertSameOrigin()).rejects.toThrow(OriginMismatchError);
  });

  it('rejects an unparseable Origin header', async () => {
    headerMap.set('origin', 'not-a-url');
    headerMap.set('host', 'ncb-medical.internal');

    await expect(assertSameOrigin()).rejects.toThrow(OriginMismatchError);
  });
});
