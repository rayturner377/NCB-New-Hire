import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const setCaseBillingMock = vi.fn();
const getCaseByIdMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args), requireFullSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../services/cases-service', () => ({
  setCaseBilling: (...args: unknown[]) => setCaseBillingMock(...args),
  getCaseById: (...args: unknown[]) => getCaseByIdMock(...args),
  hasDoctorSubmitted: (status: string) => !['draft', 'sent_to_patient', 'patient_completed', 'sent_to_doctor'].includes(status)
}));

const { updateCaseBillingAction } = await import('../../update-case-billing');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('updateCaseBillingAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    setCaseBillingMock.mockReset();
    getCaseByIdMock.mockReset();
    getCaseByIdMock.mockResolvedValue({ id: 'case_1', status: 'reviewed' });
    revalidatePathMock.mockClear();
  });

  it('does nothing without an active session', async () => {
    getSessionMock.mockResolvedValue(null);
    await updateCaseBillingAction(formData({ caseId: 'case_1', payableAmount: '100', paymentStatus: 'paid' }));
    expect(setCaseBillingMock).not.toHaveBeenCalled();
  });

  it('rejects a doctor — billing adjustment is admin/reviewer-only, unlike MEDICAL_CASES_UPDATE', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doctor_demo', role: 'clinician' } });
    await updateCaseBillingAction(formData({ caseId: 'case_1', payableAmount: '100', paymentStatus: 'paid' }));
    expect(setCaseBillingMock).not.toHaveBeenCalled();
  });

  it('lets a reviewer set the billed amount and status', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });

    await updateCaseBillingAction(formData({ caseId: 'case_1', payableAmount: '100', paymentStatus: 'paid' }));

    expect(setCaseBillingMock).toHaveBeenCalledWith('case_1', 100, 'paid', 'usr_reviewer_demo');
  });

  it('rejects an unrecognized payment status', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_admin_demo', role: 'admin' } });
    await updateCaseBillingAction(formData({ caseId: 'case_1', payableAmount: '100', paymentStatus: 'not-a-status' }));
    expect(setCaseBillingMock).not.toHaveBeenCalled();
  });

  it('rejects a negative payable amount', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_admin_demo', role: 'admin' } });
    await updateCaseBillingAction(formData({ caseId: 'case_1', payableAmount: '-5', paymentStatus: 'paid' }));
    expect(setCaseBillingMock).not.toHaveBeenCalled();
  });

  it('lets an admin set the billed amount and status, and revalidates the case', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_admin_demo', role: 'admin' } });

    await updateCaseBillingAction(formData({ caseId: 'case_1', payableAmount: '200', paymentStatus: 'paid' }));

    expect(setCaseBillingMock).toHaveBeenCalledWith('case_1', 200, 'paid', 'usr_admin_demo');
    expect(revalidatePathMock).toHaveBeenCalledWith('/cases/case_1');
    expect(revalidatePathMock).toHaveBeenCalledWith('/cases');
  });

  it("rejects an admin's edit while the doctor hasn't submitted an assessment yet — nothing to bill before then", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_admin_demo', role: 'admin' } });
    getCaseByIdMock.mockResolvedValue({ id: 'case_1', status: 'sent_to_doctor' });

    await updateCaseBillingAction(formData({ caseId: 'case_1', payableAmount: '200', paymentStatus: 'paid' }));

    expect(setCaseBillingMock).not.toHaveBeenCalled();
  });

  it("rejects an admin's edit while the case is awaiting review — billing unlocks only after Complete review", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_admin_demo', role: 'admin' } });
    getCaseByIdMock.mockResolvedValue({ id: 'case_1', status: 'doctor_submitted' });

    await updateCaseBillingAction(formData({ caseId: 'case_1', payableAmount: '200', paymentStatus: 'paid' }));

    expect(setCaseBillingMock).not.toHaveBeenCalled();
  });

  it('rejects an edit once the case is already paid — that would silently flip payment_status back to unpaid outside the reason-required reopen/correction flows', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_admin_demo', role: 'admin' } });
    getCaseByIdMock.mockResolvedValue({ id: 'case_1', status: 'reviewed', paymentStatus: 'paid' });

    await updateCaseBillingAction(formData({ caseId: 'case_1', payableAmount: '200', paymentStatus: 'unpaid' }));

    expect(setCaseBillingMock).not.toHaveBeenCalled();
  });

  it('lets an admin clear the payable amount by leaving it blank', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_admin_demo', role: 'admin' } });

    await updateCaseBillingAction(formData({ caseId: 'case_1', payableAmount: '', paymentStatus: 'not_payable' }));

    expect(setCaseBillingMock).toHaveBeenCalledWith('case_1', null, 'not_payable', 'usr_admin_demo');
  });
});
