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

const { assignCandidateAction } = await import('../../assign-candidate');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('assignCandidateAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    updateCandidateMock.mockReset();
    listCandidatesForUserMock.mockReset();
    revalidatePathMock.mockClear();
  });

  it("does nothing when a patient targets another patient's candidateId", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_patient_2', role: 'patient' } });
    listCandidatesForUserMock.mockResolvedValue([{ id: 'cand_2' }]);

    await assignCandidateAction(formData({ candidateId: 'cand_1', assignedClinicianId: 'usr_doctor_demo' }));

    expect(updateCandidateMock).not.toHaveBeenCalled();
  });

  it('does nothing without an active session', async () => {
    getSessionMock.mockResolvedValue(null);
    await assignCandidateAction(formData({ candidateId: 'cand_1', assignedClinicianId: 'usr_doctor_demo' }));
    expect(updateCandidateMock).not.toHaveBeenCalled();
  });

  it("does nothing when the role can't update patient profiles", async () => {
    // Every defined role currently has PATIENT_PROFILES_UPDATE — use an
    // unrecognized role to exercise the "no permissions at all" branch.
    getSessionMock.mockResolvedValue({ user: { role: 'not-a-real-role' } });
    await assignCandidateAction(formData({ candidateId: 'cand_1', assignedClinicianId: 'usr_doctor_demo' }));
    expect(updateCandidateMock).not.toHaveBeenCalled();
  });

  it('does nothing when required fields are missing', async () => {
    getSessionMock.mockResolvedValue({ user: { role: 'reviewer' } });
    await assignCandidateAction(formData({ candidateId: '' }));
    expect(updateCandidateMock).not.toHaveBeenCalled();
  });

  it('assigns the clinician and revalidates the list', async () => {
    getSessionMock.mockResolvedValue({ user: { role: 'reviewer' } });

    await assignCandidateAction(
      formData({ candidateId: 'cand_1', assignedClinicianId: 'usr_doctor_demo', assignedClinicianName: 'Demo Doctor' })
    );

    expect(updateCandidateMock).toHaveBeenCalledWith('cand_1', {
      assignedClinicianId: 'usr_doctor_demo',
      assignedClinicianName: 'Demo Doctor'
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/candidates');
  });
});
