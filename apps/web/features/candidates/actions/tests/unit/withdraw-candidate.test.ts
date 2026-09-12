import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const updateCandidateMock = vi.fn();
const listCandidatesForUserMock = vi.fn();
const revalidatePathMock = vi.fn();
const auditAppendMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args), requireFullSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../services/candidates-service', () => ({
  updateCandidate: (...args: unknown[]) => updateCandidateMock(...args),
  listCandidatesForUser: (...args: unknown[]) => listCandidatesForUserMock(...args)
}));
vi.mock('@ncb/database', () => ({ auditRepository: { append: (...args: unknown[]) => auditAppendMock(...args) } }));

const { withdrawCandidateAction } = await import('../../withdraw-candidate');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('withdrawCandidateAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    updateCandidateMock.mockReset();
    listCandidatesForUserMock.mockReset();
    revalidatePathMock.mockClear();
    auditAppendMock.mockReset();
  });

  it('does nothing without an active session', async () => {
    getSessionMock.mockResolvedValue(null);
    await withdrawCandidateAction(formData({ candidateId: 'cand_1', withdrawalReason: 'No longer needed' }));
    expect(updateCandidateMock).not.toHaveBeenCalled();
  });

  it("does nothing when a patient targets another patient's candidateId", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_patient_2', role: 'patient' } });
    listCandidatesForUserMock.mockResolvedValue([{ id: 'cand_2' }]);

    await withdrawCandidateAction(formData({ candidateId: 'cand_1', withdrawalReason: 'No longer needed' }));

    expect(updateCandidateMock).not.toHaveBeenCalled();
  });

  it('withdraws the candidate, audits it, and revalidates the list', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'reviewer' } });

    await withdrawCandidateAction(formData({ candidateId: 'cand_1', withdrawalReason: 'No longer needed' }));

    expect(updateCandidateMock).toHaveBeenCalledWith('cand_1', {
      status: 'withdrawn',
      withdrawalReason: 'No longer needed'
    });
    expect(auditAppendMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'candidate_withdrawn', actorUserId: 'usr_1', entityId: 'cand_1' })
    );
    expect(revalidatePathMock).toHaveBeenCalledWith('/candidates');
  });

  it('does nothing when candidateId is missing', async () => {
    getSessionMock.mockResolvedValue({ user: { role: 'reviewer' } });
    await withdrawCandidateAction(formData({ withdrawalReason: 'oops' }));
    expect(updateCandidateMock).not.toHaveBeenCalled();
  });
});
