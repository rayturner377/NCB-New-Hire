import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '../../../../../lib/permissions';

const getSessionMock = vi.fn();
const listDelegatesForClinicianMock = vi.fn();
const updateUserMock = vi.fn();
const revalidatePathMock = vi.fn();
const assertSameOriginMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({
  assertSameOrigin: (...args: unknown[]) => assertSameOriginMock(...args)
}));
vi.mock('../../../../../lib/session', () => ({ requireFullSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../services/users-service', () => ({
  listDelegatesForClinician: (...args: unknown[]) => listDelegatesForClinicianMock(...args),
  updateUser: (...args: unknown[]) => updateUserMock(...args)
}));

const { toggleDelegateBillingViewAction } = await import('../../toggle-delegate-billing-view');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function delegate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'usr_delegate_1',
    email: 'assistant@ncb.local',
    displayName: 'Demo Delegate',
    role: 'delegate',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    medicalProfile: {},
    permissionOverrides: { grant: [], revoke: [] },
    delegateForClinicianId: 'usr_doctor_demo',
    ...overrides
  };
}

describe('toggleDelegateBillingViewAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    listDelegatesForClinicianMock.mockReset();
    updateUserMock.mockReset();
    revalidatePathMock.mockClear();
    assertSameOriginMock.mockReset().mockResolvedValue(undefined);
  });

  it('does nothing without an active session', async () => {
    getSessionMock.mockResolvedValue(null);

    await toggleDelegateBillingViewAction(formData({ delegateId: 'usr_delegate_1', enabled: 'true' }));

    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it('refuses a non-doctor caller', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });

    await toggleDelegateBillingViewAction(formData({ delegateId: 'usr_delegate_1', enabled: 'true' }));

    expect(listDelegatesForClinicianMock).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it('refuses a delegate not linked to this doctor', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doctor_demo', role: 'clinician' } });
    listDelegatesForClinicianMock.mockResolvedValue([]);

    await toggleDelegateBillingViewAction(formData({ delegateId: 'usr_someone_elses_delegate', enabled: 'true' }));

    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("grants only MEDICAL_CASES_BILLING_VIEW for the doctor's own delegate", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doctor_demo', role: 'clinician' } });
    listDelegatesForClinicianMock.mockResolvedValue([delegate()]);
    updateUserMock.mockResolvedValue(delegate());

    await toggleDelegateBillingViewAction(formData({ delegateId: 'usr_delegate_1', enabled: 'true' }));

    expect(updateUserMock).toHaveBeenCalledWith(
      'usr_delegate_1',
      { permissionOverrides: { grant: [PERMISSIONS.MEDICAL_CASES_BILLING_VIEW], revoke: [] } },
      'usr_doctor_demo',
      expect.objectContaining({ eventType: 'user_permission_overrides_updated' })
    );
    expect(revalidatePathMock).toHaveBeenCalledWith('/delegates');
  });

  it('revokes MEDICAL_CASES_BILLING_VIEW when turning it off, preserving other overrides', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doctor_demo', role: 'clinician' } });
    listDelegatesForClinicianMock.mockResolvedValue([
      delegate({ permissionOverrides: { grant: [PERMISSIONS.MEDICAL_CASES_BILLING_VIEW, 'other:permission'], revoke: [] } })
    ]);
    updateUserMock.mockResolvedValue(delegate());

    await toggleDelegateBillingViewAction(formData({ delegateId: 'usr_delegate_1', enabled: 'false' }));

    expect(updateUserMock).toHaveBeenCalledWith(
      'usr_delegate_1',
      { permissionOverrides: { grant: ['other:permission'], revoke: [PERMISSIONS.MEDICAL_CASES_BILLING_VIEW] } },
      'usr_doctor_demo',
      expect.anything()
    );
  });
});
