import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMock = vi.fn();
const delMock = vi.fn();

vi.mock('@ncb/redis', () => ({
  redis: {
    get: (...args: [string]) => getMock(...args),
    del: (...args: string[]) => delMock(...args)
  }
}));

const { revokeAllSessionsForUser } = await import('../../revoke-sessions.js');

describe('revokeAllSessionsForUser', () => {
  beforeEach(() => {
    getMock.mockReset();
    delMock.mockReset();
  });

  it('deletes every session token plus the list key when sessions exist', async () => {
    getMock.mockResolvedValue(JSON.stringify([{ token: 'tok_1' }, { token: 'tok_2' }]));

    await revokeAllSessionsForUser('usr_1');

    expect(getMock).toHaveBeenCalledWith('ncb-auth:active-sessions-usr_1');
    expect(delMock).toHaveBeenCalledWith('ncb-auth:tok_1', 'ncb-auth:tok_2');
    expect(delMock).toHaveBeenCalledWith('ncb-auth:active-sessions-usr_1');
    expect(delMock).toHaveBeenCalledTimes(2);
  });

  it('still deletes the list key when it exists but is an empty array', async () => {
    getMock.mockResolvedValue(JSON.stringify([]));

    await revokeAllSessionsForUser('usr_1');

    expect(delMock).toHaveBeenCalledTimes(1);
    expect(delMock).toHaveBeenCalledWith('ncb-auth:active-sessions-usr_1');
  });

  it('deletes only the list key when the user has no session list at all', async () => {
    getMock.mockResolvedValue(null);

    await revokeAllSessionsForUser('usr_1');

    expect(delMock).toHaveBeenCalledTimes(1);
    expect(delMock).toHaveBeenCalledWith('ncb-auth:active-sessions-usr_1');
  });
});
