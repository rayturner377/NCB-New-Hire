import { describe, expect, it } from 'vitest';
import { isDatabaseNameSafeForDestructiveTests } from '../../assert-safe-test-database';

describe('isDatabaseNameSafeForDestructiveTests', () => {
  it('rejects the real dev database name', () => {
    expect(isDatabaseNameSafeForDestructiveTests('postgresql://user:pw@localhost:5432/ncb_medical?schema=public')).toBe(false);
  });

  it('accepts a database name containing "test"', () => {
    expect(isDatabaseNameSafeForDestructiveTests('postgresql://user:pw@localhost:5432/ncb_medical_test?schema=public')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isDatabaseNameSafeForDestructiveTests('postgresql://user:pw@localhost:5432/NCB_MEDICAL_TEST')).toBe(true);
  });

  it('rejects an unset DATABASE_URL', () => {
    expect(isDatabaseNameSafeForDestructiveTests(undefined)).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isDatabaseNameSafeForDestructiveTests('')).toBe(false);
  });
});
