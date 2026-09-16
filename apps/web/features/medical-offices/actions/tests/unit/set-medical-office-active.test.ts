import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const setMedicalOfficeActiveMock = vi.fn();
const revalidatePathMock = vi.fn();
const assertSameOriginMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({
  assertSameOrigin: (...args: unknown[]) => assertSameOriginMock(...args)
}));
vi.mock('../../../../../lib/session', () => ({ requireFullSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../services/medical-offices-service', () => ({
  setMedicalOfficeActive: (...args: unknown[]) => setMedicalOfficeActiveMock(...args)
}));

const { setMedicalOfficeActiveAction } = await import('../../set-medical-office-active');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('setMedicalOfficeActiveAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    setMedicalOfficeActiveMock.mockReset();
    revalidatePathMock.mockClear();
    assertSameOriginMock.mockReset().mockResolvedValue(undefined);
  });

  it('does nothing without an active session', async () => {
    getSessionMock.mockResolvedValue(null);

    await setMedicalOfficeActiveAction(formData({ officeId: 'office_1', active: 'false' }));

    expect(setMedicalOfficeActiveMock).not.toHaveBeenCalled();
  });

  it("rejects when the caller's role lacks MEDICAL_OFFICES_CREATE", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'clinician' } });

    await setMedicalOfficeActiveAction(formData({ officeId: 'office_1', active: 'false' }));

    expect(setMedicalOfficeActiveMock).not.toHaveBeenCalled();
  });

  it('does nothing when the office id is missing', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'reviewer' } });

    await setMedicalOfficeActiveAction(formData({ active: 'false' }));

    expect(setMedicalOfficeActiveMock).not.toHaveBeenCalled();
  });

  it('toggles the office active state and revalidates', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'reviewer' } });
    setMedicalOfficeActiveMock.mockResolvedValue({ id: 'office_1', active: false });

    await setMedicalOfficeActiveAction(formData({ officeId: 'office_1', active: 'false' }));

    expect(setMedicalOfficeActiveMock).toHaveBeenCalledWith('office_1', false, 'usr_1');
    expect(revalidatePathMock).toHaveBeenCalledWith('/doctors');
    expect(revalidatePathMock).toHaveBeenCalledWith('/medical-offices/office_1');
  });
});
