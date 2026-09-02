import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const transitionCaseMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../services/cases-service', () => ({
  transitionCase: (...args: unknown[]) => transitionCaseMock(...args)
}));

const { transitionCaseAction } = await import('../../transition-case');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('transitionCaseAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    transitionCaseMock.mockReset();
    revalidatePathMock.mockClear();
  });

  it('does nothing without an active session', async () => {
    getSessionMock.mockResolvedValue(null);
    await transitionCaseAction(formData({ caseId: 'case_1', version: '1', newStatus: 'reviewed' }));
    expect(transitionCaseMock).not.toHaveBeenCalled();
  });

  it('does nothing with an unrecognized status', async () => {
    getSessionMock.mockResolvedValue({ user: { role: 'reviewer' } });
    await transitionCaseAction(formData({ caseId: 'case_1', version: '1', newStatus: 'not-a-status' }));
    expect(transitionCaseMock).not.toHaveBeenCalled();
  });

  it('does nothing with a non-numeric version', async () => {
    getSessionMock.mockResolvedValue({ user: { role: 'reviewer' } });
    await transitionCaseAction(formData({ caseId: 'case_1', version: 'oops', newStatus: 'reviewed' }));
    expect(transitionCaseMock).not.toHaveBeenCalled();
  });

  it('transitions the case and revalidates the list', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });
    transitionCaseMock.mockResolvedValue(2);

    await transitionCaseAction(formData({ caseId: 'case_1', version: '1', newStatus: 'reviewed' }));

    expect(transitionCaseMock).toHaveBeenCalledWith('case_1', 1, 'reviewed', 'usr_reviewer_demo');
    expect(revalidatePathMock).toHaveBeenCalledWith('/cases');
  });
});
