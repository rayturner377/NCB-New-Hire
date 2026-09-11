import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const createCandidateMock = vi.fn();
const revalidatePathMock = vi.fn();
const assertSameOriginMock = vi.fn();
const redirectMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    redirectMock(path);
    throw new Error('NEXT_REDIRECT');
  }
}));
vi.mock('../../../../../lib/assert-same-origin', () => ({
  assertSameOrigin: (...args: unknown[]) => assertSameOriginMock(...args)
}));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../services/candidates-service', () => ({
  createCandidate: (...args: unknown[]) => createCandidateMock(...args)
}));
// create-candidate.ts's own createActionRateLimiter() ultimately depends on
// @ncb/redis's client, which throws at construction if REDIS_URL isn't set
// — not exercised by this test's assertions, so the stub just needs to load.
vi.mock('@ncb/redis', () => ({
  isRateLimited: async () => false,
  recordFailedAttempt: async () => undefined
}));

const { createCandidateAction } = await import('../../create-candidate');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('createCandidateAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    createCandidateMock.mockReset();
    revalidatePathMock.mockClear();
    redirectMock.mockClear();
    assertSameOriginMock.mockReset().mockResolvedValue(undefined);
  });

  it('rejects when there is no active session', async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await createCandidateAction(null, formData({ firstName: 'Jane', position: 'Teller' }));

    expect(result.ok).toBe(false);
    expect(createCandidateMock).not.toHaveBeenCalled();
  });

  it("rejects when the user's role lacks permission", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'user_1', role: 'clinician' } });

    const result = await createCandidateAction(
      null,
      formData({ firstName: 'Jane', lastName: 'Doe', position: 'Teller', dateOfBirth: '1990-01-01' })
    );

    expect(result.ok).toBe(false);
    expect(createCandidateMock).not.toHaveBeenCalled();
  });

  it('rejects invalid form input (no name given) and reports it as a field error', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'user_1', role: 'reviewer' } });

    const result = await createCandidateAction(null, formData({ position: 'Teller', dateOfBirth: '1990-01-01' }));

    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.fullName).toBeTruthy();
    expect(createCandidateMock).not.toHaveBeenCalled();
  });

  it('rejects a password with no email (portal access needs a login email)', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'user_1', role: 'reviewer' } });

    const result = await createCandidateAction(
      null,
      formData({
        firstName: 'Jane',
        lastName: 'Doe',
        position: 'Teller',
        dateOfBirth: '1990-01-01',
        password: 'a-very-long-password'
      })
    );

    expect(result.ok).toBe(false);
    expect(createCandidateMock).not.toHaveBeenCalled();
  });

  it('creates the candidate, revalidates the list, and redirects to the new candidate on success', async () => {
    getSessionMock.mockResolvedValue({
      user: { id: 'usr_reviewer_demo', displayName: 'Demo Reviewer', role: 'reviewer' }
    });
    createCandidateMock.mockResolvedValue({ id: 'cand_1' });

    await expect(
      createCandidateAction(
        null,
        formData({ firstName: 'Jane', lastName: 'Doe', position: 'Teller', dateOfBirth: '1990-01-01' })
      )
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(createCandidateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: 'Jane Doe',
        createdBy: 'usr_reviewer_demo',
        createdByName: 'Demo Reviewer'
      })
    );
    expect(revalidatePathMock).toHaveBeenCalledWith('/candidates');
    expect(redirectMock).toHaveBeenCalledWith('/candidates/cand_1');
  });
});
