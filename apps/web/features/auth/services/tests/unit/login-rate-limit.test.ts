import { describe, expect, it } from 'vitest';
import {
  clearLoginAttempts,
  isLoginRateLimited,
  recordFailedLoginAttempt
} from '../../login-rate-limit';

describe('login rate limit', () => {
  it('does not limit a fresh key', () => {
    expect(isLoginRateLimited('203.0.113.1:fresh@ncb.local')).toBe(false);
  });

  it('limits after 8 failed attempts and clears on success', () => {
    const key = '203.0.113.2:someone@ncb.local';
    for (let i = 0; i < 8; i += 1) recordFailedLoginAttempt(key);

    expect(isLoginRateLimited(key)).toBe(true);

    clearLoginAttempts(key);

    expect(isLoginRateLimited(key)).toBe(false);
  });
});
