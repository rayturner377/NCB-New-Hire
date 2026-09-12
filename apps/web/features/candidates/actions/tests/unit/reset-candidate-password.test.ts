import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const getCandidateByIdMock = vi.fn();
const resetUserPasswordMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../services/candidates-service', () => ({
  getCandidateById: (...args: unknown[]) => getCandidateByIdMock(...args)
}));
vi.mock('../../../../users/services/users-service', () => ({
  resetUserPassword: (...args: unknown[]) => resetUserPasswordMock(...args)
}));
// reset-candidate-password.ts's own createActionRateLimiter() ultimately
// depends on @ncb/redis's client, which throws at construction if
// REDIS_URL isn't set — not exercised by this test's assertions, so the
// stub just needs to load.
vi.mock('@ncb/redis', () => ({
  isRateLimited: async () => false,
  recordFailedAttempt: async () => undefined
}));

const { resetCandidatePasswordAction } = await import('../../reset-candidate-password');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('resetCandidatePasswordAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getCandidateByIdMock.mockReset();
    resetUserPasswordMock.mockReset();
    revalidatePathMock.mockClear();
    getCandidateByIdMock.mockResolvedValue({ id: 'cand_1', linkedUserId: 'usr_patient_demo' });
  });

  it('rejects without an active session', async () => {
    getSessionMock.mockResolvedValue(null);
    const result = await resetCandidatePasswordAction(null, formData({ candidateId: 'cand_1' }));
    expect(result.ok).toBe(false);
    expect(resetUserPasswordMock).not.toHaveBeenCalled();
  });

  it('rejects a role without PATIENT_PROFILES_RESET_PASSWORD', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doctor_demo', role: 'clinician' } });
    const result = await resetCandidatePasswordAction(null, formData({ candidateId: 'cand_1' }));
    expect(result.ok).toBe(false);
    expect(resetUserPasswordMock).not.toHaveBeenCalled();
  });

  it('rejects a patient — this action is staff-only, even against their own account', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_patient_demo', role: 'patient' } });
    const result = await resetCandidatePasswordAction(null, formData({ candidateId: 'cand_1' }));
    expect(result.ok).toBe(false);
    expect(resetUserPasswordMock).not.toHaveBeenCalled();
  });

  it('rejects a missing candidateId', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });
    const result = await resetCandidatePasswordAction(null, formData({}));
    expect(result.ok).toBe(false);
    expect(resetUserPasswordMock).not.toHaveBeenCalled();
  });

  it('rejects a candidate with no portal account yet', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });
    getCandidateByIdMock.mockResolvedValue({ id: 'cand_1', linkedUserId: '' });

    const result = await resetCandidatePasswordAction(null, formData({ candidateId: 'cand_1' }));

    expect(result.ok).toBe(false);
    expect(resetUserPasswordMock).not.toHaveBeenCalled();
  });

  it("triggers a reset code on the linked account and revalidates", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });

    const result = await resetCandidatePasswordAction(null, formData({ candidateId: 'cand_1' }));

    expect(result.ok).toBe(true);
    expect(resetUserPasswordMock).toHaveBeenCalledWith('usr_patient_demo', 'usr_reviewer_demo');
    expect(revalidatePathMock).toHaveBeenCalledWith('/candidates/cand_1');
  });
});
