import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const listCandidatesForUserMock = vi.fn();
const updateCandidateMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../services/candidates-service', () => ({
  listCandidatesForUser: (...args: unknown[]) => listCandidatesForUserMock(...args),
  updateCandidate: (...args: unknown[]) => updateCandidateMock(...args)
}));
// update-own-profile.ts's own createActionRateLimiter() ultimately depends
// on @ncb/redis's client, which throws at construction if REDIS_URL isn't
// set — not exercised by this test's assertions, so the stub just needs to
// load, matching the same pattern used for the other rate-limited actions.
vi.mock('@ncb/redis', () => ({
  isRateLimited: async () => false,
  recordFailedAttempt: async () => undefined
}));

const { updateOwnProfileAction } = await import('../../update-own-profile');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('updateOwnProfileAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    listCandidatesForUserMock.mockReset();
    updateCandidateMock.mockReset();
    revalidatePathMock.mockClear();
    listCandidatesForUserMock.mockResolvedValue([{ id: 'cand_1', linkedUserId: 'usr_patient_demo' }]);
  });

  it('rejects without an active session', async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await updateOwnProfileAction(null, formData({}));

    expect(result.ok).toBe(false);
    expect(updateCandidateMock).not.toHaveBeenCalled();
  });

  it("rejects when the caller's role lacks PATIENT_PROFILES_UPDATE", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'auditor' } });

    const result = await updateOwnProfileAction(null, formData({}));

    expect(result.ok).toBe(false);
    expect(updateCandidateMock).not.toHaveBeenCalled();
  });

  it('rejects when the caller has no linked candidate profile at all', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_patient_demo', role: 'patient' } });
    listCandidatesForUserMock.mockResolvedValue([]);

    const result = await updateOwnProfileAction(null, formData({}));

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no candidate profile/i);
    expect(updateCandidateMock).not.toHaveBeenCalled();
  });

  it('rejects invalid form input as a field error', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_patient_demo', role: 'patient' } });

    const result = await updateOwnProfileAction(null, formData({ dateOfBirth: 'not-a-date' }));

    expect(result.ok).toBe(false);
    expect(updateCandidateMock).not.toHaveBeenCalled();
  });

  it("updates the caller's own linked candidate (never one passed in the form) and revalidates /profile", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_patient_demo', role: 'patient' } });

    const result = await updateOwnProfileAction(null, formData({ city: 'Kingston', candidateId: 'someone-elses-id' }));

    expect(result.ok).toBe(true);
    expect(updateCandidateMock).toHaveBeenCalledWith('cand_1', expect.objectContaining({ city: 'Kingston' }));
    expect(revalidatePathMock).toHaveBeenCalledWith('/profile');
  });
});
