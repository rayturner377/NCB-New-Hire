import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const getCandidateByIdMock = vi.fn();
const resetUserPasswordMock = vi.fn();
const revalidatePathMock = vi.fn();
const getSettingsMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../services/candidates-service', () => ({
  getCandidateById: (...args: unknown[]) => getCandidateByIdMock(...args)
}));
vi.mock('../../../../users/services/users-service', () => ({
  resetUserPassword: (...args: unknown[]) => resetUserPasswordMock(...args)
}));
vi.mock('../../../../settings/services/settings-service', () => ({ getSettings: (...args: unknown[]) => getSettingsMock(...args) }));
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

const validPassword = 'a-very-long-temp-password';

describe('resetCandidatePasswordAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getCandidateByIdMock.mockReset();
    resetUserPasswordMock.mockReset();
    revalidatePathMock.mockClear();
    getCandidateByIdMock.mockResolvedValue({ id: 'cand_1', linkedUserId: 'usr_patient_demo' });
    getSettingsMock.mockReset();
    getSettingsMock.mockResolvedValue({ userPolicy: { minPasswordLength: 12, requireUppercase: false, requireNumber: false, requireSymbol: false } });
  });

  it('rejects without an active session', async () => {
    getSessionMock.mockResolvedValue(null);
    const result = await resetCandidatePasswordAction(
      null,
      formData({ candidateId: 'cand_1', password: validPassword, confirmPassword: validPassword })
    );
    expect(result.ok).toBe(false);
    expect(resetUserPasswordMock).not.toHaveBeenCalled();
  });

  it('rejects a role without PATIENT_PROFILES_UPDATE', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doctor_demo', role: 'clinician' } });
    const result = await resetCandidatePasswordAction(
      null,
      formData({ candidateId: 'cand_1', password: validPassword, confirmPassword: validPassword })
    );
    expect(result.ok).toBe(false);
    expect(resetUserPasswordMock).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });
    const result = await resetCandidatePasswordAction(
      null,
      formData({ candidateId: 'cand_1', password: validPassword, confirmPassword: 'does-not-match-1234' })
    );
    expect(result.ok).toBe(false);
    expect(resetUserPasswordMock).not.toHaveBeenCalled();
  });

  it('rejects a candidate with no portal account yet', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });
    getCandidateByIdMock.mockResolvedValue({ id: 'cand_1', linkedUserId: '' });

    const result = await resetCandidatePasswordAction(
      null,
      formData({ candidateId: 'cand_1', password: validPassword, confirmPassword: validPassword })
    );

    expect(result.ok).toBe(false);
    expect(resetUserPasswordMock).not.toHaveBeenCalled();
  });

  it("resets the linked account's password, defaulting to forcing a change on next login, and revalidates", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });

    const result = await resetCandidatePasswordAction(
      null,
      formData({ candidateId: 'cand_1', password: validPassword, confirmPassword: validPassword, forcePasswordChange: 'on' })
    );

    expect(result.ok).toBe(true);
    expect(resetUserPasswordMock).toHaveBeenCalledWith('usr_patient_demo', validPassword, true, 'usr_reviewer_demo');
    expect(revalidatePathMock).toHaveBeenCalledWith('/candidates/cand_1');
  });

  it('does not force a password change when the checkbox is unchecked', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });

    await resetCandidatePasswordAction(null, formData({ candidateId: 'cand_1', password: validPassword, confirmPassword: validPassword }));

    expect(resetUserPasswordMock).toHaveBeenCalledWith('usr_patient_demo', validPassword, false, 'usr_reviewer_demo');
  });
});
