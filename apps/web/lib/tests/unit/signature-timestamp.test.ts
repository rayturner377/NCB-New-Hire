import { describe, expect, it } from 'vitest';
import { captureSignatureTimestamp } from '../../signature-timestamp';

describe('captureSignatureTimestamp', () => {
  it('produces a string that round-trips through Date.parse', () => {
    const captured = captureSignatureTimestamp();
    expect(typeof captured).toBe('string');
    expect(Number.isNaN(Date.parse(captured))).toBe(false);
  });
});
