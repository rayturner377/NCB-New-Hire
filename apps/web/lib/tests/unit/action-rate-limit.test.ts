import { describe, expect, it } from 'vitest';
import { createActionRateLimiter } from '../../action-rate-limit';

describe('createActionRateLimiter', () => {
  it('is not limited before any attempts are recorded', () => {
    const limiter = createActionRateLimiter(3, 60_000);
    expect(limiter.isLimited('usr_1')).toBe(false);
  });

  it('becomes limited once attempts reach the max', () => {
    const limiter = createActionRateLimiter(3, 60_000);
    limiter.recordAttempt('usr_1');
    limiter.recordAttempt('usr_1');
    expect(limiter.isLimited('usr_1')).toBe(false);
    limiter.recordAttempt('usr_1');
    expect(limiter.isLimited('usr_1')).toBe(true);
  });

  it('tracks each user independently', () => {
    const limiter = createActionRateLimiter(1, 60_000);
    limiter.recordAttempt('usr_1');
    expect(limiter.isLimited('usr_1')).toBe(true);
    expect(limiter.isLimited('usr_2')).toBe(false);
  });

  it('tracks each limiter instance independently — one action being limited does not affect another', () => {
    const limiterA = createActionRateLimiter(1, 60_000);
    const limiterB = createActionRateLimiter(1, 60_000);
    limiterA.recordAttempt('usr_1');
    expect(limiterA.isLimited('usr_1')).toBe(true);
    expect(limiterB.isLimited('usr_1')).toBe(false);
  });
});
