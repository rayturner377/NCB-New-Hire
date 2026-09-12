import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const getCaseByIdMock = vi.fn();
const setCaseHiddenMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args), requireFullSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../services/cases-service', () => ({
  getCaseById: (...args: unknown[]) => getCaseByIdMock(...args),
  setCaseHidden: (...args: unknown[]) => setCaseHiddenMock(...args)
}));

const { setCaseHiddenAction } = await import('../../set-case-hidden');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('setCaseHiddenAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getCaseByIdMock.mockReset();
    setCaseHiddenMock.mockReset();
    revalidatePathMock.mockClear();
    getCaseByIdMock.mockResolvedValue({ id: 'case_1', payload: { caseType: 'pre_employment' } });
  });

  it('rejects without an active session', async () => {
    getSessionMock.mockResolvedValue(null);
    const result = await setCaseHiddenAction(null, formData({ caseId: 'case_1', hidden: 'true' }));
    expect(result.ok).toBe(false);
    expect(setCaseHiddenMock).not.toHaveBeenCalled();
  });

  it('rejects a doctor — hiding is a reviewer/admin action', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doctor_demo', role: 'clinician' } });
    const result = await setCaseHiddenAction(null, formData({ caseId: 'case_1', hidden: 'true' }));
    expect(result.ok).toBe(false);
    expect(setCaseHiddenMock).not.toHaveBeenCalled();
  });

  it('rejects when the case cannot be found', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });
    getCaseByIdMock.mockResolvedValue(null);

    const result = await setCaseHiddenAction(null, formData({ caseId: 'case_1', hidden: 'true' }));

    expect(result.ok).toBe(false);
    expect(setCaseHiddenMock).not.toHaveBeenCalled();
  });

  it('lets a reviewer hide a case, forwarding its current payload and revalidating', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });

    const result = await setCaseHiddenAction(null, formData({ caseId: 'case_1', hidden: 'true' }));

    expect(result.ok).toBe(true);
    expect(setCaseHiddenMock).toHaveBeenCalledWith('case_1', true, 'usr_reviewer_demo', { caseType: 'pre_employment' });
    expect(revalidatePathMock).toHaveBeenCalledWith('/cases/case_1');
    expect(revalidatePathMock).toHaveBeenCalledWith('/cases');
  });

  it('lets a reviewer unhide a case', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });

    await setCaseHiddenAction(null, formData({ caseId: 'case_1', hidden: 'false' }));

    expect(setCaseHiddenMock).toHaveBeenCalledWith('case_1', false, 'usr_reviewer_demo', { caseType: 'pre_employment' });
  });
});
