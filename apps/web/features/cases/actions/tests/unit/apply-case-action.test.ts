import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const getCaseByIdMock = vi.fn();
const reassignClinicianMock = vi.fn();
const transitionCaseMock = vi.fn();
const listActiveDoctorsMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args), requireFullSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../services/cases-service', () => ({
  getCaseById: (...args: unknown[]) => getCaseByIdMock(...args),
  reassignClinician: (...args: unknown[]) => reassignClinicianMock(...args),
  transitionCase: (...args: unknown[]) => transitionCaseMock(...args)
}));
vi.mock('../../../../users/services/users-service', () => ({
  listActiveDoctors: (...args: unknown[]) => listActiveDoctorsMock(...args)
}));

const { applyCaseActionAction } = await import('../../apply-case-action');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('applyCaseActionAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getCaseByIdMock.mockReset();
    reassignClinicianMock.mockReset();
    transitionCaseMock.mockReset();
    listActiveDoctorsMock.mockReset();
    revalidatePathMock.mockClear();
  });

  it('rejects without an active session', async () => {
    getSessionMock.mockResolvedValue(null);
    const result = await applyCaseActionAction(null, formData({ caseId: 'case_1', version: '1', actionId: 'send_to_patient' }));
    expect(result.ok).toBe(false);
    expect(transitionCaseMock).not.toHaveBeenCalled();
  });

  it('rejects a role without MEDICAL_CASES_TRANSITION (auditor)', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_auditor', role: 'auditor' } });
    const result = await applyCaseActionAction(null, formData({ caseId: 'case_1', version: '1', actionId: 'send_to_patient' }));
    expect(result.ok).toBe(false);
    expect(transitionCaseMock).not.toHaveBeenCalled();
  });

  it('rejects a doctor role by default — MEDICAL_CASES_TRANSITION is not yet granted to clinicians', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doctor_demo', role: 'clinician' } });
    const result = await applyCaseActionAction(null, formData({ caseId: 'case_1', version: '1', actionId: 'send_to_patient' }));
    expect(result.ok).toBe(false);
    expect(transitionCaseMock).not.toHaveBeenCalled();
  });

  it('rejects an action id that is not legal for the case\'s current status', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });
    getCaseByIdMock.mockResolvedValue({ id: 'case_1', status: 'sent_to_patient', version: 1 });

    const result = await applyCaseActionAction(null, formData({ caseId: 'case_1', version: '1', actionId: 'complete_review' }));

    expect(result.ok).toBe(false);
    expect(transitionCaseMock).not.toHaveBeenCalled();
  });

  it('rejects a doctor-requiring action with no doctor chosen', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });
    getCaseByIdMock.mockResolvedValue({ id: 'case_1', status: 'sent_to_patient', version: 1 });

    const result = await applyCaseActionAction(null, formData({ caseId: 'case_1', version: '1', actionId: 'send_to_doctor' }));

    expect(result.ok).toBe(false);
    expect(reassignClinicianMock).not.toHaveBeenCalled();
  });

  it('reassigns then transitions for a doctor-requiring action, in that order', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });
    getCaseByIdMock.mockResolvedValue({ id: 'case_1', status: 'sent_to_patient', version: 1 });
    listActiveDoctorsMock.mockResolvedValue([{ id: 'usr_doctor_demo' }]);

    const calls: string[] = [];
    reassignClinicianMock.mockImplementation(() => calls.push('reassign'));
    transitionCaseMock.mockImplementation(() => calls.push('transition'));

    const result = await applyCaseActionAction(
      null,
      formData({ caseId: 'case_1', version: '1', actionId: 'send_to_doctor', clinicianId: 'usr_doctor_demo' })
    );

    expect(result.ok).toBe(true);
    expect(reassignClinicianMock).toHaveBeenCalledWith('case_1', 'usr_doctor_demo', 'usr_reviewer_demo');
    expect(transitionCaseMock).toHaveBeenCalledWith('case_1', 1, 'sent_to_doctor', 'usr_reviewer_demo');
    expect(calls).toEqual(['reassign', 'transition']);
  });

  it('applies a no-picker action (send back to patient) without touching the assigned clinician', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });
    getCaseByIdMock.mockResolvedValue({ id: 'case_1', status: 'doctor_submitted', version: 3 });

    const result = await applyCaseActionAction(null, formData({ caseId: 'case_1', version: '3', actionId: 'send_to_patient' }));

    expect(result.ok).toBe(true);
    expect(reassignClinicianMock).not.toHaveBeenCalled();
    expect(transitionCaseMock).toHaveBeenCalledWith('case_1', 3, 'sent_to_patient', 'usr_reviewer_demo');
    expect(revalidatePathMock).toHaveBeenCalledWith('/cases/case_1');
  });
});
