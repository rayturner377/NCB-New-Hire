import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '../../permissions';
import { DEFAULT_ROLE_PERMISSIONS } from '../../permission-groups';

describe('DEFAULT_ROLE_PERMISSIONS (BFS group resolution)', () => {
  it('auditor is exactly reviewer_view — a strict subset of reviewer, with no write permissions', () => {
    const auditor = new Set(DEFAULT_ROLE_PERMISSIONS.auditor);
    const reviewer = new Set(DEFAULT_ROLE_PERMISSIONS.reviewer);

    for (const permission of auditor) expect(reviewer.has(permission)).toBe(true);
    expect(auditor.has(PERMISSIONS.MEDICAL_CASES_UPDATE)).toBe(false);
    expect(auditor.has(PERMISSIONS.STAFF_ACCOUNTS_MANAGE)).toBe(false);
  });

  it('reviewer includes the shared base group (auth/session) via inheritance, not duplication', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.reviewer).toContain(PERMISSIONS.AUTH_READ);
    expect(DEFAULT_ROLE_PERMISSIONS.reviewer).toContain(PERMISSIONS.SESSION_LOGOUT);
  });

  it('every permission in each default set is deduplicated', () => {
    for (const permissions of Object.values(DEFAULT_ROLE_PERMISSIONS)) {
      expect(new Set(permissions).size).toBe(permissions.length);
    }
  });
});
