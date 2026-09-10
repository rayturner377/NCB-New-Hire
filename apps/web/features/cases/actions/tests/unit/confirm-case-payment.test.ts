import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const confirmCasePaymentMock = vi.fn();
const getCaseByIdMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../services/cases-service', () => ({
  confirmCasePayment: (...args: unknown[]) => confirmCasePaymentMock(...args),
  getCaseById: (...args: unknown[]) => getCaseByIdMock(...args),
  hasDoctorSubmitted: (status: string) => !['draft', 'sent_to_patient', 'patient_completed', 'sent_to_doctor'].includes(status)
}));

const { confirmCasePaymentAction } = await import('../../confirm-case-payment');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('confirmCasePaymentAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    confirmCasePaymentMock.mockReset();
    getCaseByIdMock.mockReset();
    getCaseByIdMock.mockResolvedValue({ id: 'case_1', status: 'reviewed' });
    revalidatePathMock.mockClear();
  });

  it('rejects without an active session', async () => {
    getSessionMock.mockResolvedValue(null);
    const result = await confirmCasePaymentAction(null, formData({ caseId: 'case_1', paidOn: '2026-01-01' }));
    expect(result.ok).toBe(false);
    expect(confirmCasePaymentMock).not.toHaveBeenCalled();
  });

  it('rejects a role without MEDICAL_CASES_PAYMENT_CONFIRM', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doctor_demo', role: 'clinician' } });
    const result = await confirmCasePaymentAction(null, formData({ caseId: 'case_1', paidOn: '2026-01-01' }));
    expect(result.ok).toBe(false);
    expect(confirmCasePaymentMock).not.toHaveBeenCalled();
  });

  it("rejects while the doctor hasn't submitted an assessment yet", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });
    getCaseByIdMock.mockResolvedValue({ id: 'case_1', status: 'sent_to_doctor' });

    const result = await confirmCasePaymentAction(null, formData({ caseId: 'case_1', paidOn: '2026-01-01' }));

    expect(result.ok).toBe(false);
    expect(confirmCasePaymentMock).not.toHaveBeenCalled();
  });

  it('rejects while the case is awaiting review — payment unlocks only after Complete review', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });
    getCaseByIdMock.mockResolvedValue({ id: 'case_1', status: 'doctor_submitted' });

    const result = await confirmCasePaymentAction(null, formData({ caseId: 'case_1', paidOn: '2026-01-01' }));

    expect(result.ok).toBe(false);
    expect(confirmCasePaymentMock).not.toHaveBeenCalled();
  });

  it('lets a reviewer confirm payment once the case is reviewed, and revalidates', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });

    const result = await confirmCasePaymentAction(null, formData({ caseId: 'case_1', paidOn: '2026-01-01' }));

    expect(result.ok).toBe(true);
    expect(confirmCasePaymentMock).toHaveBeenCalledWith('case_1', '2026-01-01', 'usr_reviewer_demo');
    expect(revalidatePathMock).toHaveBeenCalledWith('/cases/case_1');
    expect(revalidatePathMock).toHaveBeenCalledWith('/cases');
  });
});
