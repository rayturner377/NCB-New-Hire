import { beforeEach, describe, expect, it, vi } from 'vitest';

const createMock = vi.fn();
const findLatestActiveMock = vi.fn();
const incrementAttemptsMock = vi.fn();
const markUsedMock = vi.fn();
const invalidateMock = vi.fn();
const findByEmailMock = vi.fn();

vi.mock('@ncb/database', () => ({
  accessCodesRepository: {
    create: (...args: unknown[]) => createMock(...args),
    findLatestActive: (...args: unknown[]) => findLatestActiveMock(...args),
    incrementAttempts: (...args: unknown[]) => incrementAttemptsMock(...args),
    markUsed: (...args: unknown[]) => markUsedMock(...args),
    invalidate: (...args: unknown[]) => invalidateMock(...args)
  },
  usersRepository: {
    findByEmail: (...args: unknown[]) => findByEmailMock(...args)
  }
}));

vi.mock('@ncb/shared', () => ({
  generateAccessCode: () => '482913',
  hashAccessCode: (code: string) => `hash(${code})`,
  verifyAccessCodeHash: (code: string, storedHash: string) => `hash(${code})` === storedHash
}));

const { issueAccessCode, redeemAccessCode, verifyAccessCode, hasLiveAccessCode } = await import('../../access-codes-service');

describe('issueAccessCode', () => {
  beforeEach(() => {
    createMock.mockReset();
    vi.useRealTimers();
  });

  it('generates, hashes, and stores a code, returning the raw code', async () => {
    const code = await issueAccessCode('usr_1', 'account_activation');

    expect(code).toBe('482913');
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'usr_1',
        codeHash: 'hash(482913)',
        purpose: 'account_activation',
        expiresAt: expect.any(Date)
      })
    );
  });

  it('defaults account_activation to a 24-hour window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    await issueAccessCode('usr_1', 'account_activation');

    const { expiresAt } = createMock.mock.calls[0]![0] as { expiresAt: Date };
    expect(expiresAt.toISOString()).toBe('2026-01-02T00:00:00.000Z');
  });

  it('defaults password_reset to a 20-minute window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    await issueAccessCode('usr_1', 'password_reset');

    const { expiresAt } = createMock.mock.calls[0]![0] as { expiresAt: Date };
    expect(expiresAt.toISOString()).toBe('2026-01-01T00:20:00.000Z');
  });

  it('lets a caller override the default TTL (the candidate-creation admin picker)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    await issueAccessCode('usr_1', 'account_activation', 15 * 60 * 1000);

    const { expiresAt } = createMock.mock.calls[0]![0] as { expiresAt: Date };
    expect(expiresAt.toISOString()).toBe('2026-01-01T00:15:00.000Z');
  });
});

describe('redeemAccessCode and verifyAccessCode', () => {
  beforeEach(() => {
    findByEmailMock.mockReset();
    findLatestActiveMock.mockReset();
    incrementAttemptsMock.mockReset();
    markUsedMock.mockReset();
    invalidateMock.mockReset();
  });

  it('fails generically when no such user exists', async () => {
    findByEmailMock.mockResolvedValue(null);

    const result = await redeemAccessCode('nobody@example.com', '482913');

    expect(result.ok).toBe(false);
    expect(findLatestActiveMock).not.toHaveBeenCalled();
  });

  it('fails generically when the user has no live code', async () => {
    findByEmailMock.mockResolvedValue({ id: 'usr_1' });
    findLatestActiveMock.mockResolvedValue(null);

    const result = await redeemAccessCode('user@example.com', '482913');

    expect(result.ok).toBe(false);
  });

  it('fails and invalidates a code that already hit the attempt limit', async () => {
    findByEmailMock.mockResolvedValue({ id: 'usr_1' });
    findLatestActiveMock.mockResolvedValue({ id: 'code_1', codeHash: 'hash(482913)', attemptCount: 5 });

    const result = await redeemAccessCode('user@example.com', '482913');

    expect(result.ok).toBe(false);
    expect(invalidateMock).toHaveBeenCalledWith('code_1');
  });

  it('rejects a wrong code, increments attempts, and does not mark it used', async () => {
    findByEmailMock.mockResolvedValue({ id: 'usr_1' });
    findLatestActiveMock.mockResolvedValue({ id: 'code_1', codeHash: 'hash(482913)', attemptCount: 0 });
    incrementAttemptsMock.mockResolvedValue({ id: 'code_1', attemptCount: 1 });

    const result = await redeemAccessCode('user@example.com', '000000');

    expect(result.ok).toBe(false);
    expect(incrementAttemptsMock).toHaveBeenCalledWith('code_1');
    expect(markUsedMock).not.toHaveBeenCalled();
    expect(invalidateMock).not.toHaveBeenCalled();
  });

  it('locks the code out once the 5th wrong attempt is reached', async () => {
    findByEmailMock.mockResolvedValue({ id: 'usr_1' });
    findLatestActiveMock.mockResolvedValue({ id: 'code_1', codeHash: 'hash(482913)', attemptCount: 4 });
    incrementAttemptsMock.mockResolvedValue({ id: 'code_1', attemptCount: 5 });

    await redeemAccessCode('user@example.com', '000000');

    expect(invalidateMock).toHaveBeenCalledWith('code_1');
  });

  it('redeemAccessCode succeeds on the correct code, marks it used, and reports which purpose it was', async () => {
    findByEmailMock.mockResolvedValue({ id: 'usr_1' });
    findLatestActiveMock.mockResolvedValue({ id: 'code_1', codeHash: 'hash(482913)', attemptCount: 0, purpose: 'password_reset' });

    const result = await redeemAccessCode('user@example.com', '482913');

    expect(result).toEqual({ ok: true, userId: 'usr_1', purpose: 'password_reset' });
    expect(markUsedMock).toHaveBeenCalledWith('code_1');
  });

  it('verifyAccessCode succeeds on the correct code but leaves it live for the later redeem', async () => {
    findByEmailMock.mockResolvedValue({ id: 'usr_1' });
    findLatestActiveMock.mockResolvedValue({ id: 'code_1', codeHash: 'hash(482913)', attemptCount: 0, purpose: 'password_reset' });

    const result = await verifyAccessCode('user@example.com', '482913');

    expect(result).toEqual({ ok: true, userId: 'usr_1', purpose: 'password_reset' });
    expect(markUsedMock).not.toHaveBeenCalled();
  });

  it('verifyAccessCode still tracks a wrong attempt (brute-force protection applies before consumption too)', async () => {
    findByEmailMock.mockResolvedValue({ id: 'usr_1' });
    findLatestActiveMock.mockResolvedValue({ id: 'code_1', codeHash: 'hash(482913)', attemptCount: 0 });
    incrementAttemptsMock.mockResolvedValue({ id: 'code_1', attemptCount: 1 });

    const result = await verifyAccessCode('user@example.com', '000000');

    expect(result.ok).toBe(false);
    expect(incrementAttemptsMock).toHaveBeenCalledWith('code_1');
  });
});

describe('hasLiveAccessCode', () => {
  beforeEach(() => {
    findByEmailMock.mockReset();
    findLatestActiveMock.mockReset();
  });

  it('returns false for an email with no account', async () => {
    findByEmailMock.mockResolvedValue(null);

    expect(await hasLiveAccessCode('nobody@example.com')).toBe(false);
    expect(findLatestActiveMock).not.toHaveBeenCalled();
  });

  it('returns false for an account with no live code (the ordinary password sign-in case)', async () => {
    findByEmailMock.mockResolvedValue({ id: 'usr_1' });
    findLatestActiveMock.mockResolvedValue(null);

    expect(await hasLiveAccessCode('jane@example.com')).toBe(false);
  });

  it('returns true for an account with a live code (fresh activation or an unredeemed reset)', async () => {
    findByEmailMock.mockResolvedValue({ id: 'usr_1' });
    findLatestActiveMock.mockResolvedValue({ id: 'code_1', purpose: 'account_activation' });

    expect(await hasLiveAccessCode('jane@example.com')).toBe(true);
  });
});
