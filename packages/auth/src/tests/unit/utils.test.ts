import { describe, expect, it } from 'vitest';
import { hash } from '../../password.js';
import { setUserPassword } from '../../set-password.js';
import { revokeAllSessionsForUser } from '../../revoke-sessions.js';
import { hashPassword, setUserPassword as setUserPasswordFromUtils, revokeAllSessionsForUser as revokeAllSessionsForUserFromUtils } from '../../utils.js';

/**
 * utils.ts is a pure re-export barrel (see its own docstring: importable
 * without triggering index.ts's betterAuth() construction) — its only
 * "logic" is the export map itself, so this just confirms each re-export
 * really does resolve to the same function as its source module, not a
 * behavioral test of hash/setUserPassword/revokeAllSessionsForUser
 * themselves (covered by password.test.ts/set-password.test.ts/
 * revoke-sessions.test.ts).
 */
describe('utils re-exports', () => {
  it('hashPassword is password.ts\'s hash function', () => {
    expect(hashPassword).toBe(hash);
  });

  it('setUserPassword is set-password.ts\'s setUserPassword function', () => {
    expect(setUserPasswordFromUtils).toBe(setUserPassword);
  });

  it('revokeAllSessionsForUser is revoke-sessions.ts\'s revokeAllSessionsForUser function', () => {
    expect(revokeAllSessionsForUserFromUtils).toBe(revokeAllSessionsForUser);
  });
});
