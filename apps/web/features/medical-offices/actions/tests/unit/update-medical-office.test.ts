import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const updateMedicalOfficeMock = vi.fn();
const revalidatePathMock = vi.fn();
const redirectMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    redirectMock(path);
    throw new Error('NEXT_REDIRECT');
  }
}));
vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args), requireFullSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../services/medical-offices-service', () => ({
  updateMedicalOffice: (...args: unknown[]) => updateMedicalOfficeMock(...args)
}));
vi.mock('@ncb/redis', () => ({
  isRateLimited: async () => false,
  recordFailedAttempt: async () => undefined
}));

const { updateMedicalOfficeAction } = await import('../../update-medical-office');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('updateMedicalOfficeAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    updateMedicalOfficeMock.mockReset();
    revalidatePathMock.mockClear();
    redirectMock.mockClear();
  });

  it('rejects without an active session', async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await updateMedicalOfficeAction(null, formData({ officeId: 'office_1', name: 'NCB Clinic' }));

    expect(result.ok).toBe(false);
    expect(updateMedicalOfficeMock).not.toHaveBeenCalled();
  });

  it("rejects when the caller's role lacks MEDICAL_OFFICES_CREATE", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'clinician' } });

    const result = await updateMedicalOfficeAction(null, formData({ officeId: 'office_1', name: 'NCB Clinic' }));

    expect(result.ok).toBe(false);
    expect(updateMedicalOfficeMock).not.toHaveBeenCalled();
  });

  it('rejects when the office id is missing', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'reviewer' } });

    const result = await updateMedicalOfficeAction(null, formData({ name: 'NCB Clinic' }));

    expect(result.ok).toBe(false);
    expect(updateMedicalOfficeMock).not.toHaveBeenCalled();
  });

  it('rejects invalid form input (no name given) as a field error', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'reviewer' } });

    const result = await updateMedicalOfficeAction(null, formData({ officeId: 'office_1' }));

    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.name).toBeTruthy();
    expect(updateMedicalOfficeMock).not.toHaveBeenCalled();
  });

  it('updates the office, revalidates, and redirects to its detail page on success', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'reviewer' } });
    updateMedicalOfficeMock.mockResolvedValue({ id: 'office_1' });

    await expect(
      updateMedicalOfficeAction(null, formData({ officeId: 'office_1', name: 'Renamed Clinic' }))
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(updateMedicalOfficeMock).toHaveBeenCalledWith('office_1', expect.objectContaining({ name: 'Renamed Clinic' }), 'usr_1');
    expect(revalidatePathMock).toHaveBeenCalledWith('/doctors');
    expect(revalidatePathMock).toHaveBeenCalledWith('/medical-offices/office_1');
    expect(redirectMock).toHaveBeenCalledWith('/medical-offices/office_1');
  });
});
