import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const { scanBuffer, isScanningEnabled } = await import('../../virus-scan');

describe('virus-scan', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.VIRUS_SCAN_ENABLED;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('isScanningEnabled', () => {
    it('is false by default — scanning is opt-in, not opt-out', () => {
      expect(isScanningEnabled()).toBe(false);
    });

    it('is true only when VIRUS_SCAN_ENABLED is exactly "true"', () => {
      process.env.VIRUS_SCAN_ENABLED = 'true';
      expect(isScanningEnabled()).toBe(true);

      process.env.VIRUS_SCAN_ENABLED = 'yes';
      expect(isScanningEnabled()).toBe(false);
    });
  });

  describe('scanBuffer', () => {
    it('reports unavailable, safely, when no scanner is configured — never falls open to "clean"', async () => {
      const result = await scanBuffer(Buffer.from('anything'));
      expect(result).toEqual({ verdict: 'unavailable' });
    });

    it('throws (a loud, caught-by-the-caller failure, not a silent false "clean") when enabled but no real scanner is implemented yet', async () => {
      process.env.VIRUS_SCAN_ENABLED = 'true';
      await expect(scanBuffer(Buffer.from('anything'))).rejects.toThrow(/no real scanner implementation/i);
    });
  });
});
