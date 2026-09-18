import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const correctCasePaymentDateMock = vi.fn();
const getCaseByIdMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args), requireFullSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../services/cases-service', () => ({
  correctCasePaymentDate: (...args: unknown[]) => correctCasePaymentDateMock(...args),
  getCaseById: (...args: unknown[]) => getCaseByIdMock(...args)
}));

const { correctCasePaymentDateAction } = await import('../../correct-case-payment-date');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('correctCasePaymentDateAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    correctCasePaymentDateMock.mockReset();
    getCaseByIdMock.mockReset();
    getCaseByIdMock.mockResolvedValue({ id: 'case_1', status: 'reviewed', paymentStatus: 'paid' });
    revalidatePathMock.mockClear();
  });

  it('rejects without an active session', async () => {
    getSessionMock.mockResolvedValue(null);
    const result = await correctCasePaymentDateAction(null, formData({ caseId: 'case_1', paidOn: '2026-01-01', reason: 'typo' }));
    expect(result.ok).toBe(false);
    expect(correctCasePaymentDateMock).not.toHaveBeenCalled();
  });

  it('rejects a role without MEDICAL_CASES_PAYMENT_CONFIRM', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doctor_demo', role: 'clinician' } });
    const result = await correctCasePaymentDateAction(null, formData({ caseId: 'case_1', paidOn: '2026-01-01', reason: 'typo' }));
    expect(result.ok).toBe(false);
    expect(correctCasePaymentDateMock).not.toHaveBeenCalled();
  });

  it('rejects with no reason given', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });
    const result = await correctCasePaymentDateAction(null, formData({ caseId: 'case_1', paidOn: '2026-01-01' }));
    expect(result.ok).toBe(false);
    expect(correctCasePaymentDateMock).not.toHaveBeenCalled();
  });

  it('rejects with no date given', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });
    const result = await correctCasePaymentDateAction(null, formData({ caseId: 'case_1', reason: 'typo' }));
    expect(result.ok).toBe(false);
    expect(correctCasePaymentDateMock).not.toHaveBeenCalled();
  });

  it('rejects correcting a case that has not actually been paid yet', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });
    getCaseByIdMock.mockResolvedValue({ id: 'case_1', status: 'reviewed', paymentStatus: 'unpaid' });

    const result = await correctCasePaymentDateAction(null, formData({ caseId: 'case_1', paidOn: '2026-01-01', reason: 'typo' }));

    expect(result.ok).toBe(false);
    expect(correctCasePaymentDateMock).not.toHaveBeenCalled();
  });

  it('lets a reviewer correct a paid case\'s date, and revalidates', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });

    const result = await correctCasePaymentDateAction(
      null,
      formData({ caseId: 'case_1', paidOn: '2026-01-05', reason: 'Original date was a typo' })
    );

    expect(result.ok).toBe(true);
    expect(correctCasePaymentDateMock).toHaveBeenCalledWith('case_1', '2026-01-05', 'Original date was a typo', 'usr_reviewer_demo');
    expect(revalidatePathMock).toHaveBeenCalledWith('/cases/case_1');
    expect(revalidatePathMock).toHaveBeenCalledWith('/cases');
  });
});
