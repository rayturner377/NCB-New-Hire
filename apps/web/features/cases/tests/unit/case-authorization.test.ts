import { describe, expect, it, vi } from 'vitest';

const listCandidatesForUserMock = vi.fn();

vi.mock('../../../candidates/services/candidates-service', () => ({
  listCandidatesForUser: (...args: unknown[]) => listCandidatesForUserMock(...args)
}));

const { ownsCase, patientOwnsCase } = await import('../../case-authorization');

describe('ownsCase', () => {
  it('lets a clinician act on a case assigned to them', () => {
    expect(ownsCase({ role: 'clinician', id: 'usr_doctor_1' }, { assignedClinicianId: 'usr_doctor_1' })).toBe(true);
  });

  it('blocks a clinician from a case assigned to a different doctor', () => {
    expect(ownsCase({ role: 'clinician', id: 'usr_doctor_1' }, { assignedClinicianId: 'usr_doctor_2' })).toBe(false);
  });

  it('blocks a clinician from an unassigned case', () => {
    expect(ownsCase({ role: 'clinician', id: 'usr_doctor_1' }, { assignedClinicianId: null })).toBe(false);
  });

  it('never restricts non-clinician roles', () => {
    expect(ownsCase({ role: 'admin', id: 'usr_admin_1' }, { assignedClinicianId: 'usr_doctor_2' })).toBe(true);
    expect(ownsCase({ role: 'reviewer', id: 'usr_reviewer_1' }, { assignedClinicianId: null })).toBe(true);
    expect(ownsCase({ role: 'auditor', id: 'usr_auditor_1' }, { assignedClinicianId: 'usr_doctor_2' })).toBe(true);
  });

  it('lets a delegate act on a case assigned to the doctor they support', () => {
    expect(
      ownsCase(
        { role: 'delegate', id: 'usr_delegate_1', delegateForClinicianId: 'usr_doctor_1' },
        { assignedClinicianId: 'usr_doctor_1' }
      )
    ).toBe(true);
  });

  it('blocks a delegate from a case assigned to a different doctor than the one they support', () => {
    expect(
      ownsCase(
        { role: 'delegate', id: 'usr_delegate_1', delegateForClinicianId: 'usr_doctor_1' },
        { assignedClinicianId: 'usr_doctor_2' }
      )
    ).toBe(false);
  });

  it('blocks a delegate with no doctor linked yet from every case, even an unassigned one', () => {
    expect(ownsCase({ role: 'delegate', id: 'usr_delegate_1', delegateForClinicianId: null }, { assignedClinicianId: null })).toBe(
      false
    );
  });
});

describe('patientOwnsCase', () => {
  it('is true when the case patientId matches one of the user’s own candidates', async () => {
    listCandidatesForUserMock.mockResolvedValue([{ id: 'cand_1' }, { id: 'cand_2' }]);
    expect(await patientOwnsCase('usr_patient_1', { patientId: 'cand_2' })).toBe(true);
  });

  it('is false when the case belongs to someone else’s candidate', async () => {
    listCandidatesForUserMock.mockResolvedValue([{ id: 'cand_1' }]);
    expect(await patientOwnsCase('usr_patient_1', { patientId: 'cand_999' })).toBe(false);
  });

  it('is false when the user has no linked candidates', async () => {
    listCandidatesForUserMock.mockResolvedValue([]);
    expect(await patientOwnsCase('usr_patient_1', { patientId: 'cand_1' })).toBe(false);
  });
});
