import { describe, expect, it } from 'vitest';
import { isRateLimited, recordFailedLogin, type RateLimitStore } from './rate-limiter.js';

describe('rate-limiter', () => {
  it('does not limit under the threshold', () => {
    const store: RateLimitStore = new Map();
    for (let i = 0; i < 7; i += 1) recordFailedLogin(store, 'ip:user@example.com');
    expect(isRateLimited(store, 'ip:user@example.com')).toBe(false);
  });

  it('limits at the threshold', () => {
    const store: RateLimitStore = new Map();
    for (let i = 0; i < 8; i += 1) recordFailedLogin(store, 'ip:user@example.com');
    expect(isRateLimited(store, 'ip:user@example.com')).toBe(true);
  });

  it('clears the counter once the lockout window expires', () => {
    const store: RateLimitStore = new Map();
    const start = Date.now();
    for (let i = 0; i < 8; i += 1) recordFailedLogin(store, 'ip:user@example.com', start);
    expect(isRateLimited(store, 'ip:user@example.com', start + 16 * 60 * 1000)).toBe(false);
  });

  it('tracks keys independently', () => {
    const store: RateLimitStore = new Map();
    for (let i = 0; i < 8; i += 1) recordFailedLogin(store, 'ip:a@example.com');
    expect(isRateLimited(store, 'ip:a@example.com')).toBe(true);
    expect(isRateLimited(store, 'ip:b@example.com')).toBe(false);
  });
});
