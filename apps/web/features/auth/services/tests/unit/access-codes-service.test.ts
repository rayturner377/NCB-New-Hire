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

const { issueAccessCode, redeemAccessCode } = await import('../../access-codes-service');

describe('issueAccessCode', () => {
  beforeEach(() => {
    createMock.mockReset();
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
});

describe('redeemAccessCode', () => {
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

  it('succeeds on the correct code, marks it used, and reports which purpose it was', async () => {
    findByEmailMock.mockResolvedValue({ id: 'usr_1' });
    findLatestActiveMock.mockResolvedValue({ id: 'code_1', codeHash: 'hash(482913)', attemptCount: 0, purpose: 'password_reset' });

    const result = await redeemAccessCode('user@example.com', '482913');

    expect(result).toEqual({ ok: true, userId: 'usr_1', purpose: 'password_reset' });
    expect(markUsedMock).toHaveBeenCalledWith('code_1');
  });
});
