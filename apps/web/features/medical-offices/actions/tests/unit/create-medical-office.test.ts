import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const createMedicalOfficeMock = vi.fn();
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
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../services/medical-offices-service', () => ({
  createMedicalOffice: (...args: unknown[]) => createMedicalOfficeMock(...args)
}));
vi.mock('@ncb/redis', () => ({
  isRateLimited: async () => false,
  recordFailedAttempt: async () => undefined
}));

const { createMedicalOfficeAction } = await import('../../create-medical-office');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('createMedicalOfficeAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    createMedicalOfficeMock.mockReset();
    revalidatePathMock.mockClear();
    redirectMock.mockClear();
  });

  it('rejects without an active session', async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await createMedicalOfficeAction(null, formData({ name: 'NCB Clinic' }));

    expect(result.ok).toBe(false);
    expect(createMedicalOfficeMock).not.toHaveBeenCalled();
  });

  it("rejects when the caller's role lacks MEDICAL_OFFICES_CREATE", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'clinician' } });

    const result = await createMedicalOfficeAction(null, formData({ name: 'NCB Clinic' }));

    expect(result.ok).toBe(false);
    expect(createMedicalOfficeMock).not.toHaveBeenCalled();
  });

  it('rejects invalid form input (no name given) as a field error', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'reviewer' } });

    const result = await createMedicalOfficeAction(null, formData({}));

    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.name).toBeTruthy();
    expect(createMedicalOfficeMock).not.toHaveBeenCalled();
  });

  it('rejects a negative default fee', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'reviewer' } });

    const result = await createMedicalOfficeAction(null, formData({ name: 'NCB Clinic', defaultMedicalFee: '-5' }));

    expect(result.ok).toBe(false);
    expect(createMedicalOfficeMock).not.toHaveBeenCalled();
  });

  it('creates the office, revalidates, and redirects to the offices tab on success', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'reviewer' } });
    createMedicalOfficeMock.mockResolvedValue({ id: 'office_1' });

    await expect(createMedicalOfficeAction(null, formData({ name: 'NCB Clinic' }))).rejects.toThrow('NEXT_REDIRECT');

    expect(createMedicalOfficeMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'NCB Clinic' }));
    expect(revalidatePathMock).toHaveBeenCalledWith('/doctors');
    expect(redirectMock).toHaveBeenCalledWith('/doctors?tab=offices');
  });
});
