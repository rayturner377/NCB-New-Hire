import { beforeEach, describe, expect, it, vi } from 'vitest';

const findFirstMock = vi.fn();
const updateMock = vi.fn();
const createMock = vi.fn();
const hashMock = vi.fn(async (password: string) => `hashed:${password}`);

vi.mock('@ncb/database', () => ({
  prisma: {
    account: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
      create: (...args: unknown[]) => createMock(...args)
    }
  }
}));

vi.mock('../../password.js', () => ({
  hash: (...args: [string]) => hashMock(...args)
}));

const { setUserPassword } = await import('../../set-password.js');

describe('setUserPassword', () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    updateMock.mockReset();
    createMock.mockReset();
    hashMock.mockClear();
  });

  it('updates the existing credential Account row when one already exists', async () => {
    findFirstMock.mockResolvedValue({ id: 'acct_1' });

    await setUserPassword('usr_1', 'NewPassword123!');

    expect(findFirstMock).toHaveBeenCalledWith({ where: { userId: 'usr_1', providerId: 'credential' } });
    expect(updateMock).toHaveBeenCalledWith({ where: { id: 'acct_1' }, data: { password: 'hashed:NewPassword123!' } });
    expect(createMock).not.toHaveBeenCalled();
  });

  it('creates a new credential Account row when none exists yet', async () => {
    findFirstMock.mockResolvedValue(null);

    await setUserPassword('usr_2', 'AnotherPassword123!');

    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: 'usr_2',
        providerId: 'credential',
        userId: 'usr_2',
        password: 'hashed:AnotherPassword123!'
      })
    });
    expect(updateMock).not.toHaveBeenCalled();
  });
});
