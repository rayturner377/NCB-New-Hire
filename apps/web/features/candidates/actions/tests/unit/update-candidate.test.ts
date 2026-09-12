import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const updateCandidateMock = vi.fn();
const listCandidatesForUserMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args), requireFullSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../services/candidates-service', () => ({
  updateCandidate: (...args: unknown[]) => updateCandidateMock(...args),
  listCandidatesForUser: (...args: unknown[]) => listCandidatesForUserMock(...args)
}));

const { updateCandidateAction } = await import('../../update-candidate');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('updateCandidateAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    updateCandidateMock.mockReset();
    listCandidatesForUserMock.mockReset();
    revalidatePathMock.mockClear();
  });

  it('rejects without an active session', async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await updateCandidateAction(null, formData({ candidateId: 'cand_1' }));

    expect(result.ok).toBe(false);
    expect(updateCandidateMock).not.toHaveBeenCalled();
  });

  it("rejects when the caller's role lacks PATIENT_PROFILES_UPDATE", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'clinician' } });

    const result = await updateCandidateAction(null, formData({ candidateId: 'cand_1' }));

    expect(result.ok).toBe(false);
    expect(updateCandidateMock).not.toHaveBeenCalled();
  });

  it("rejects a patient targeting another patient's candidateId", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_patient_2', role: 'patient' } });
    listCandidatesForUserMock.mockResolvedValue([{ id: 'cand_2' }]);

    const result = await updateCandidateAction(null, formData({ candidateId: 'cand_1', city: 'Kingston' }));

    expect(result.ok).toBe(false);
    expect(updateCandidateMock).not.toHaveBeenCalled();
  });

  it('allows a patient to update their own candidateId', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_patient_1', role: 'patient' } });
    listCandidatesForUserMock.mockResolvedValue([{ id: 'cand_1' }]);
    updateCandidateMock.mockResolvedValue(undefined);

    const result = await updateCandidateAction(null, formData({ candidateId: 'cand_1', city: 'Kingston' }));

    expect(result.ok).toBe(true);
    expect(updateCandidateMock).toHaveBeenCalledWith('cand_1', expect.objectContaining({ city: 'Kingston' }));
  });

  it('rejects a missing candidateId', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'reviewer' } });

    const result = await updateCandidateAction(null, formData({}));

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/candidate id/i);
    expect(updateCandidateMock).not.toHaveBeenCalled();
  });

  it('rejects invalid form input as a field error', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'reviewer' } });

    const result = await updateCandidateAction(null, formData({ candidateId: 'cand_1', dateOfBirth: 'not-a-date' }));

    expect(result.ok).toBe(false);
    expect(updateCandidateMock).not.toHaveBeenCalled();
  });

  it('updates the candidate and revalidates both list and detail pages on success', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'reviewer' } });
    updateCandidateMock.mockResolvedValue(undefined);

    const result = await updateCandidateAction(null, formData({ candidateId: 'cand_1', city: 'Kingston' }));

    expect(result.ok).toBe(true);
    expect(updateCandidateMock).toHaveBeenCalledWith('cand_1', expect.objectContaining({ city: 'Kingston' }));
    expect(revalidatePathMock).toHaveBeenCalledWith('/candidates/cand_1');
    expect(revalidatePathMock).toHaveBeenCalledWith('/candidates');
  });
});
