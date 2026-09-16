import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const deleteMedicalOfficeMock = vi.fn();
const revalidatePathMock = vi.fn();
const redirectMock = vi.fn();
const assertSameOriginMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    redirectMock(path);
    throw new Error('NEXT_REDIRECT');
  }
}));
vi.mock('../../../../../lib/assert-same-origin', () => ({
  assertSameOrigin: (...args: unknown[]) => assertSameOriginMock(...args)
}));
vi.mock('../../../../../lib/session', () => ({ requireFullSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../services/medical-offices-service', () => ({
  deleteMedicalOffice: (...args: unknown[]) => deleteMedicalOfficeMock(...args)
}));

const { deleteMedicalOfficeAction } = await import('../../delete-medical-office');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('deleteMedicalOfficeAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    deleteMedicalOfficeMock.mockReset();
    revalidatePathMock.mockClear();
    redirectMock.mockClear();
    assertSameOriginMock.mockReset().mockResolvedValue(undefined);
  });

  it('does nothing without an active session', async () => {
    getSessionMock.mockResolvedValue(null);

    await deleteMedicalOfficeAction(formData({ officeId: 'office_1' }));

    expect(deleteMedicalOfficeMock).not.toHaveBeenCalled();
  });

  it("rejects when the caller's role lacks MEDICAL_OFFICES_CREATE", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'clinician' } });

    await deleteMedicalOfficeAction(formData({ officeId: 'office_1' }));

    expect(deleteMedicalOfficeMock).not.toHaveBeenCalled();
  });

  it('does nothing when the office id is missing', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'reviewer' } });

    await deleteMedicalOfficeAction(formData({}));

    expect(deleteMedicalOfficeMock).not.toHaveBeenCalled();
  });

  it('deletes the office, revalidates, and redirects to the offices tab', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'reviewer' } });
    deleteMedicalOfficeMock.mockResolvedValue(undefined);

    await expect(deleteMedicalOfficeAction(formData({ officeId: 'office_1' }))).rejects.toThrow('NEXT_REDIRECT');

    expect(deleteMedicalOfficeMock).toHaveBeenCalledWith('office_1', 'usr_1');
    expect(revalidatePathMock).toHaveBeenCalledWith('/doctors');
    expect(redirectMock).toHaveBeenCalledWith('/doctors?tab=offices');
  });
});
