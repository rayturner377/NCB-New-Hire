import { beforeEach, describe, expect, it, vi } from 'vitest';

const listCandidatesForUserMock = vi.fn();
const listCasesForPatientMock = vi.fn();

vi.mock('../../../../../candidates/services/candidates-service', () => ({
  listCandidatesForUser: (...args: unknown[]) => listCandidatesForUserMock(...args)
}));
vi.mock('../../../../../cases/services/cases-service', () => ({
  listCasesForPatient: (...args: unknown[]) => listCasesForPatientMock(...args)
}));

const { getPatientDashboardData } = await import('../../patient-dashboard-service');

describe('getPatientDashboardData', () => {
  beforeEach(() => {
    listCandidatesForUserMock.mockReset();
    listCasesForPatientMock.mockReset();
  });

  it('returns an empty case list when the user has no linked candidate profiles', async () => {
    listCandidatesForUserMock.mockResolvedValue([]);

    const result = await getPatientDashboardData('usr_1');

    expect(result).toEqual({ cases: [] });
    expect(listCasesForPatientMock).not.toHaveBeenCalled();
  });

  it('merges cases across every linked candidate profile, filters hidden ones, and sorts newest first', async () => {
    listCandidatesForUserMock.mockResolvedValue([{ id: 'cand_1' }, { id: 'cand_2' }]);
    listCasesForPatientMock.mockImplementation(async (candidateId: string) => {
      if (candidateId === 'cand_1') {
        return [
          { id: 'case_old', updatedAt: new Date('2026-01-01T00:00:00.000Z'), payload: {} },
          { id: 'case_hidden', updatedAt: new Date('2026-01-05T00:00:00.000Z'), payload: { hidden: true } }
        ];
      }
      return [{ id: 'case_new', updatedAt: new Date('2026-01-10T00:00:00.000Z'), payload: {} }];
    });

    const result = await getPatientDashboardData('usr_1');

    expect(result.cases.map((c) => c.id)).toEqual(['case_new', 'case_old']);
  });
});
