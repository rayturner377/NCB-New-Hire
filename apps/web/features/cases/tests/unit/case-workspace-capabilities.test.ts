import { describe, expect, it } from 'vitest';
import { deriveCaseWorkspaceCapabilities } from '../../case-workspace-capabilities';

const baseCase = { status: 'sent_to_doctor', assignedClinicianId: 'usr_doctor_1', paymentStatus: null };

describe('deriveCaseWorkspaceCapabilities', () => {
  it('grants an admin the full set of controls and never hides the position from them', () => {
    const capabilities = deriveCaseWorkspaceCapabilities({ role: 'admin', id: 'usr_admin_1' } as never, baseCase);

    expect(capabilities.canUpdateBilling).toBe(true);
    expect(capabilities.canViewBilling).toBe(true);
    expect(capabilities.canConfirmPayment).toBe(true);
    expect(capabilities.canTransition).toBe(true);
    expect(capabilities.canReassign).toBe(true);
    expect(capabilities.canHide).toBe(true);
    expect(capabilities.canUploadDocuments).toBe(true);
    expect(capabilities.canViewHistory).toBe(true);
    expect(capabilities.hidePositionFromViewer).toBe(false);
  });

  it('lets an assigned clinician upload documents but hides the position and the history tab from them', () => {
    const capabilities = deriveCaseWorkspaceCapabilities({ role: 'clinician', id: 'usr_doctor_1' } as never, baseCase);

    expect(capabilities.canUploadDocuments).toBe(true);
    expect(capabilities.canViewHistory).toBe(false);
    expect(capabilities.hidePositionFromViewer).toBe(true);
  });

  it('blocks a clinician not assigned to the case from uploading documents', () => {
    const capabilities = deriveCaseWorkspaceCapabilities({ role: 'clinician', id: 'usr_doctor_2' } as never, baseCase);

    expect(capabilities.canUploadDocuments).toBe(false);
  });

  it("lets a delegate act on the case assigned to the doctor they support, scoped the same way as their doctor", () => {
    const capabilities = deriveCaseWorkspaceCapabilities(
      { role: 'delegate', id: 'usr_delegate_1', delegateForClinicianId: 'usr_doctor_1' } as never,
      baseCase
    );

    expect(capabilities.canUploadDocuments).toBe(true);
    expect(capabilities.canViewHistory).toBe(false);
    expect(capabilities.hidePositionFromViewer).toBe(true);
  });

  it('marks a case as not yet doctor-submitted while pre-doctor, and locks billing/export/upload accordingly', () => {
    const capabilities = deriveCaseWorkspaceCapabilities({ role: 'admin', id: 'usr_admin_1' } as never, {
      ...baseCase,
      status: 'sent_to_patient'
    });

    expect(capabilities.doctorHasSubmitted).toBe(false);
    expect(capabilities.awaitingReview).toBe(false);
    expect(capabilities.billingLocked).toBe(true);
    expect(capabilities.billingLockedMessage).toMatch(/nothing to pay/);
    expect(capabilities.exportLockedMessage).toMatch(/nothing to export/);
    expect(capabilities.uploadLockedMessage).toMatch(/nothing to stamp/);
  });

  it('locks billing/export for review, but not upload, while a doctor_submitted case awaits HR review', () => {
    const capabilities = deriveCaseWorkspaceCapabilities({ role: 'admin', id: 'usr_admin_1' } as never, {
      ...baseCase,
      status: 'doctor_submitted'
    });

    expect(capabilities.doctorHasSubmitted).toBe(true);
    expect(capabilities.awaitingReview).toBe(true);
    expect(capabilities.billingLocked).toBe(true);
    expect(capabilities.billingLockedMessage).toMatch(/Complete review/);
    expect(capabilities.exportLockedMessage).toMatch(/Complete review/);
    expect(capabilities.uploadLockedMessage).toBeUndefined();
  });

  it('unlocks billing/export once a case has been reviewed', () => {
    const capabilities = deriveCaseWorkspaceCapabilities({ role: 'admin', id: 'usr_admin_1' } as never, {
      ...baseCase,
      status: 'reviewed'
    });

    expect(capabilities.billingLocked).toBe(false);
    expect(capabilities.billingLockedMessage).toBeUndefined();
    expect(capabilities.exportLockedMessage).toBeUndefined();
  });

  it('reports isPaid straight from paymentStatus', () => {
    expect(deriveCaseWorkspaceCapabilities({ role: 'admin', id: 'usr_admin_1' } as never, { ...baseCase, paymentStatus: 'paid' }).isPaid).toBe(
      true
    );
    expect(
      deriveCaseWorkspaceCapabilities({ role: 'admin', id: 'usr_admin_1' } as never, { ...baseCase, paymentStatus: 'unpaid' }).isPaid
    ).toBe(false);
  });
});
