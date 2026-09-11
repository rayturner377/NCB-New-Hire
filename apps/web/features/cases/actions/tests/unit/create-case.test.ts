import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const createCaseMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../services/cases-service', () => ({
  createCase: (...args: unknown[]) => createCaseMock(...args)
}));
// create-case.ts's own createActionRateLimiter() ultimately depends on
// @ncb/redis's client, which throws at construction if REDIS_URL isn't set
// — not exercised by this test's assertions, so the stub just needs to load.
vi.mock('@ncb/redis', () => ({
  isRateLimited: async () => false,
  recordFailedAttempt: async () => undefined
}));

const { createCaseAction } = await import('../../create-case');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('createCaseAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    createCaseMock.mockReset();
    revalidatePathMock.mockClear();
  });

  it('rejects when there is no active session', async () => {
    getSessionMock.mockResolvedValue(null);
    const result = await createCaseAction(null, formData({ patientId: 'cand_1' }));
    expect(result.ok).toBe(false);
    expect(createCaseMock).not.toHaveBeenCalled();
  });

  it("rejects when the user's role lacks permission", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'user_1', role: 'clinician' } });
    const result = await createCaseAction(null, formData({ patientId: 'cand_1' }));
    expect(result.ok).toBe(false);
    expect(createCaseMock).not.toHaveBeenCalled();
  });

  it('rejects a missing candidate', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'user_1', role: 'reviewer' } });
    const result = await createCaseAction(null, formData({ patientId: '' }));
    expect(result.ok).toBe(false);
    expect(createCaseMock).not.toHaveBeenCalled();
  });

  it('rejects a missing or unrecognized case type', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });
    const result = await createCaseAction(null, formData({ patientId: 'cand_1', positionAppliedFor: 'Teller' }));
    expect(result.ok).toBe(false);
    expect(createCaseMock).not.toHaveBeenCalled();
  });

  it('creates the case, revalidates the list, and returns the new case id on success', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });
    createCaseMock.mockResolvedValue({ id: 'case_1' });

    const result = await createCaseAction(
      null,
      formData({ patientId: 'cand_1', caseType: 'pre_employment', positionAppliedFor: 'Teller' })
    );

    expect(result).toEqual({ ok: true, caseId: 'case_1' });
    expect(createCaseMock).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: 'cand_1', caseType: 'pre_employment', positionAppliedFor: 'Teller', createdBy: 'usr_reviewer_demo' })
    );
    expect(revalidatePathMock).toHaveBeenCalledWith('/cases');
  });

  it('creates a case with a doctor assigned (doctor presence, not a separate route field, drives routing)', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });
    createCaseMock.mockResolvedValue({ id: 'case_2' });

    const result = await createCaseAction(
      null,
      formData({
        patientId: 'cand_1',
        assignedClinicianId: 'usr_doctor_demo',
        caseType: 'required_medical',
        positionAppliedFor: 'Branch supervisor'
      })
    );

    expect(result).toEqual({ ok: true, caseId: 'case_2' });
    expect(createCaseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'cand_1',
        assignedClinicianId: 'usr_doctor_demo',
        caseType: 'required_medical',
        positionAppliedFor: 'Branch supervisor'
      })
    );
  });
});
