import { describe, expect, it, vi } from 'vitest';

const listCandidatesForUserMock = vi.fn();

vi.mock('../../services/candidates-service', () => ({
  listCandidatesForUser: (...args: unknown[]) => listCandidatesForUserMock(...args)
}));

const { ownsCandidate } = await import('../../candidate-authorization');

describe('ownsCandidate', () => {
  it('lets a patient view their own linked candidate profile', async () => {
    listCandidatesForUserMock.mockResolvedValue([{ id: 'cand_1' }, { id: 'cand_2' }]);
    expect(await ownsCandidate({ role: 'patient', id: 'usr_patient_1' }, 'cand_2')).toBe(true);
  });

  it('blocks a patient from a candidate profile that is not their own', async () => {
    listCandidatesForUserMock.mockResolvedValue([{ id: 'cand_1' }]);
    expect(await ownsCandidate({ role: 'patient', id: 'usr_patient_1' }, 'cand_999')).toBe(false);
  });

  it('blocks a patient with no linked candidates at all', async () => {
    listCandidatesForUserMock.mockResolvedValue([]);
    expect(await ownsCandidate({ role: 'patient', id: 'usr_patient_1' }, 'cand_1')).toBe(false);
  });

  it('never restricts non-patient roles, and never even queries for them', async () => {
    listCandidatesForUserMock.mockClear();
    expect(await ownsCandidate({ role: 'admin', id: 'usr_admin_1' }, 'cand_1')).toBe(true);
    expect(await ownsCandidate({ role: 'reviewer', id: 'usr_reviewer_1' }, 'cand_2')).toBe(true);
    expect(listCandidatesForUserMock).not.toHaveBeenCalled();
  });
});
