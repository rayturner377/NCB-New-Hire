import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const createCandidateMock = vi.fn();
const revalidatePathMock = vi.fn();
const assertSameOriginMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({
  assertSameOrigin: (...args: unknown[]) => assertSameOriginMock(...args)
}));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../services/candidates-service', () => ({
  createCandidate: (...args: unknown[]) => createCandidateMock(...args)
}));

const { createCandidateAction } = await import('../../create-candidate');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('createCandidateAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    createCandidateMock.mockReset();
    revalidatePathMock.mockClear();
    assertSameOriginMock.mockReset().mockResolvedValue(undefined);
  });

  it('rejects when there is no active session', async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await createCandidateAction(null, formData({ fullName: 'Jane', position: 'Teller' }));

    expect(result.ok).toBe(false);
    expect(createCandidateMock).not.toHaveBeenCalled();
  });

  it("rejects when the user's role lacks permission", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'user_1', role: 'clinician' } });

    const result = await createCandidateAction(
      null,
      formData({ fullName: 'Jane', position: 'Teller', dateOfBirth: '1990-01-01' })
    );

    expect(result.ok).toBe(false);
    expect(createCandidateMock).not.toHaveBeenCalled();
  });

  it('rejects invalid form input without creating anything', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'user_1', role: 'reviewer' } });

    const result = await createCandidateAction(null, formData({ fullName: '', position: 'Teller' }));

    expect(result.ok).toBe(false);
    expect(createCandidateMock).not.toHaveBeenCalled();
  });

  it('creates the candidate and revalidates the list on success', async () => {
    getSessionMock.mockResolvedValue({
      user: { id: 'usr_reviewer_demo', displayName: 'Demo Reviewer', role: 'reviewer' }
    });
    createCandidateMock.mockResolvedValue({ id: 'cand_1' });

    const result = await createCandidateAction(
      null,
      formData({ fullName: 'Jane Doe', position: 'Teller', dateOfBirth: '1990-01-01' })
    );

    expect(result.ok).toBe(true);
    expect(createCandidateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: 'Jane Doe',
        createdBy: 'usr_reviewer_demo',
        createdByName: 'Demo Reviewer'
      })
    );
    expect(revalidatePathMock).toHaveBeenCalledWith('/candidates');
  });
});
