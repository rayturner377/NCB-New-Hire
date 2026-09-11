import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const getCaseByIdMock = vi.fn();
const reassignClinicianMock = vi.fn();
const listActiveDoctorsMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../../users/services/users-service', () => ({
  listActiveDoctors: (...args: unknown[]) => listActiveDoctorsMock(...args)
}));
vi.mock('../../../services/cases-service', () => ({
  getCaseById: (...args: unknown[]) => getCaseByIdMock(...args),
  reassignClinician: (...args: unknown[]) => reassignClinicianMock(...args)
}));

const { reassignClinicianAction } = await import('../../reassign-clinician');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('reassignClinicianAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getCaseByIdMock.mockReset();
    reassignClinicianMock.mockReset();
    listActiveDoctorsMock.mockReset();
    revalidatePathMock.mockClear();
    listActiveDoctorsMock.mockResolvedValue([{ id: 'doc_2' }]);
  });

  it('rejects without an active session', async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await reassignClinicianAction(null, formData({ caseId: 'case_1', clinicianId: 'doc_2' }));

    expect(result.ok).toBe(false);
    expect(reassignClinicianMock).not.toHaveBeenCalled();
  });

  it("rejects when the caller's role lacks MEDICAL_CASES_REASSIGN", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'clinician' } });

    const result = await reassignClinicianAction(null, formData({ caseId: 'case_1', clinicianId: 'doc_2' }));

    expect(result.ok).toBe(false);
    expect(reassignClinicianMock).not.toHaveBeenCalled();
  });

  it('rejects a missing caseId or clinicianId', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'reviewer' } });

    const result = await reassignClinicianAction(null, formData({ caseId: 'case_1' }));

    expect(result.ok).toBe(false);
    expect(getCaseByIdMock).not.toHaveBeenCalled();
  });

  it('rejects when the case does not exist', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'reviewer' } });
    getCaseByIdMock.mockResolvedValue(null);

    const result = await reassignClinicianAction(null, formData({ caseId: 'case_1', clinicianId: 'doc_2' }));

    expect(result.ok).toBe(false);
    expect(reassignClinicianMock).not.toHaveBeenCalled();
  });

  it('rejects reassignment once the case has moved past sent_to_doctor', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'reviewer' } });
    getCaseByIdMock.mockResolvedValue({ id: 'case_1', status: 'reviewed' });

    const result = await reassignClinicianAction(null, formData({ caseId: 'case_1', clinicianId: 'doc_2' }));

    expect(result.ok).toBe(false);
    expect(reassignClinicianMock).not.toHaveBeenCalled();
  });

  it('rejects a clinicianId that is not an active doctor', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'reviewer' } });
    getCaseByIdMock.mockResolvedValue({ id: 'case_1', status: 'sent_to_doctor' });
    listActiveDoctorsMock.mockResolvedValue([{ id: 'someone-else' }]);

    const result = await reassignClinicianAction(null, formData({ caseId: 'case_1', clinicianId: 'doc_2' }));

    expect(result.ok).toBe(false);
    expect(reassignClinicianMock).not.toHaveBeenCalled();
  });

  it('reassigns and revalidates both the case and list pages on success', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'reviewer' } });
    getCaseByIdMock.mockResolvedValue({ id: 'case_1', status: 'sent_to_doctor' });

    const result = await reassignClinicianAction(null, formData({ caseId: 'case_1', clinicianId: 'doc_2' }));

    expect(result.ok).toBe(true);
    expect(reassignClinicianMock).toHaveBeenCalledWith('case_1', 'doc_2', 'usr_1');
    expect(revalidatePathMock).toHaveBeenCalledWith('/cases/case_1');
    expect(revalidatePathMock).toHaveBeenCalledWith('/cases');
  });
});
