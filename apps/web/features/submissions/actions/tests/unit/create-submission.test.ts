import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const getCaseByIdMock = vi.fn();
const transitionCaseMock = vi.fn();
const setCaseBillingMock = vi.fn();
const getCandidateByIdMock = vi.fn();
const createSubmissionMock = vi.fn();
const clearDoctorAssessmentDraftMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args), requireFullSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../../candidates/services/candidates-service', () => ({
  getCandidateById: (...args: unknown[]) => getCandidateByIdMock(...args)
}));
vi.mock('../../../../cases/services/cases-service', () => ({
  getCaseById: (...args: unknown[]) => getCaseByIdMock(...args),
  transitionCase: (...args: unknown[]) => transitionCaseMock(...args),
  setCaseBilling: (...args: unknown[]) => setCaseBillingMock(...args),
  clearDoctorAssessmentDraft: (...args: unknown[]) => clearDoctorAssessmentDraftMock(...args)
}));
vi.mock('../../../services/submissions-service', () => ({
  createSubmission: (...args: unknown[]) => createSubmissionMock(...args)
}));

const { createSubmissionAction } = await import('../../create-submission');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function validFields(overrides: Record<string, string> = {}) {
  return {
    caseId: 'case_1',
    caseVersion: '2',
    'assessment.facilityName': 'City Medical Centre',
    'assessment.assessmentDate': '2026-01-01',
    'assessment.clinicianName': 'Dr. Example',
    'determination.status': 'fit',
    'attestation.signedBy': 'Dr. Example',
    'attestation.signatureDate': '2026-01-01',
    'attestation.consentConfirmed': 'true',
    ...overrides
  };
}

const sampleCandidate = {
  id: 'cand_1',
  fullName: 'Jane Doe',
  employeeId: 'EMP-1',
  nationalId: '',
  dateOfBirth: '1990-01-01',
  email: '',
  contactNumber: '',
  position: 'Teller',
  medicationInformation: ''
};

describe('createSubmissionAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getCaseByIdMock.mockReset();
    transitionCaseMock.mockReset();
    setCaseBillingMock.mockReset();
    getCandidateByIdMock.mockReset();
    createSubmissionMock.mockReset();
    clearDoctorAssessmentDraftMock.mockReset();
    revalidatePathMock.mockClear();
  });

  it('rejects when there is no active session', async () => {
    getSessionMock.mockResolvedValue(null);
    const result = await createSubmissionAction(null, formData(validFields()));
    expect(result.ok).toBe(false);
    expect(createSubmissionMock).not.toHaveBeenCalled();
  });

  it("rejects when the user's role lacks permission", async () => {
    getSessionMock.mockResolvedValue({ user: { role: 'patient' } });
    const result = await createSubmissionAction(null, formData(validFields()));
    expect(result.ok).toBe(false);
    expect(createSubmissionMock).not.toHaveBeenCalled();
  });

  it('rejects a missing case id', async () => {
    getSessionMock.mockResolvedValue({ user: { role: 'clinician' } });
    const result = await createSubmissionAction(null, formData(validFields({ caseId: '' })));
    expect(result.ok).toBe(false);
    expect(getCaseByIdMock).not.toHaveBeenCalled();
  });

  it('rejects when the case cannot be found', async () => {
    getSessionMock.mockResolvedValue({ user: { role: 'clinician' } });
    getCaseByIdMock.mockResolvedValue(null);
    const result = await createSubmissionAction(null, formData(validFields()));
    expect(result.ok).toBe(false);
  });

  it('rejects when the candidate cannot be found', async () => {
    getSessionMock.mockResolvedValue({ user: { role: 'clinician' } });
    getCaseByIdMock.mockResolvedValue({ id: 'case_1', patientId: 'cand_1', version: 2 });
    getCandidateByIdMock.mockResolvedValue(null);
    const result = await createSubmissionAction(null, formData(validFields()));
    expect(result.ok).toBe(false);
  });

  it('rejects invalid assessment fields without creating anything', async () => {
    getSessionMock.mockResolvedValue({ user: { role: 'clinician' } });
    getCaseByIdMock.mockResolvedValue({ id: 'case_1', patientId: 'cand_1', version: 2 });
    getCandidateByIdMock.mockResolvedValue(sampleCandidate);

    const result = await createSubmissionAction(
      null,
      formData(validFields({ 'determination.status': 'not-a-real-status' }))
    );

    expect(result.ok).toBe(false);
    expect(createSubmissionMock).not.toHaveBeenCalled();
  });

  it('rejects when the case is assigned to a different clinician', async () => {
    getSessionMock.mockResolvedValue({
      user: { id: 'usr_doctor_demo', displayName: 'Demo Doctor', email: 'doctor@ncb.local', role: 'clinician' }
    });
    getCaseByIdMock.mockResolvedValue({ id: 'case_1', patientId: 'cand_1', version: 2, assignedClinicianId: 'usr_other_doctor' });

    const result = await createSubmissionAction(null, formData(validFields()));

    expect(result.ok).toBe(false);
    expect(getCandidateByIdMock).not.toHaveBeenCalled();
    expect(createSubmissionMock).not.toHaveBeenCalled();
  });

  it('creates the submission, transitions the case, and returns ok on success', async () => {
    getSessionMock.mockResolvedValue({
      user: { id: 'usr_doctor_demo', displayName: 'Demo Doctor', email: 'doctor@ncb.local', role: 'clinician' }
    });
    getCaseByIdMock.mockResolvedValue({ id: 'case_1', patientId: 'cand_1', version: 2, assignedClinicianId: 'usr_doctor_demo' });
    getCandidateByIdMock.mockResolvedValue(sampleCandidate);
    createSubmissionMock.mockResolvedValue({ id: 'med_1' });

    const result = await createSubmissionAction(null, formData(validFields()));

    expect(result).toEqual({ ok: true });
    expect(createSubmissionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: 'case_1',
        submittedBy: 'usr_doctor_demo',
        candidate: expect.objectContaining({ fullName: 'Jane Doe' })
      })
    );
    expect(transitionCaseMock).toHaveBeenCalledWith('case_1', 2, 'doctor_submitted', 'usr_doctor_demo');
    expect(revalidatePathMock).toHaveBeenCalledWith('/cases');
    expect(setCaseBillingMock).not.toHaveBeenCalled();
  });

  it("snapshots the doctor's current rate onto the case when they have one set", async () => {
    getSessionMock.mockResolvedValue({
      user: {
        id: 'usr_doctor_demo',
        displayName: 'Demo Doctor',
        email: 'doctor@ncb.local',
        role: 'clinician',
        medicalProfile: { defaultMedicalFee: 150 }
      }
    });
    getCaseByIdMock.mockResolvedValue({ id: 'case_1', patientId: 'cand_1', version: 2, assignedClinicianId: 'usr_doctor_demo' });
    getCandidateByIdMock.mockResolvedValue(sampleCandidate);
    createSubmissionMock.mockResolvedValue({ id: 'med_1' });

    await createSubmissionAction(null, formData(validFields()));

    expect(setCaseBillingMock).toHaveBeenCalledWith('case_1', 150, 'unpaid');
  });

  it("doesn't snapshot a zero/unset rate (leaves payableAmount alone rather than writing $0.00)", async () => {
    getSessionMock.mockResolvedValue({
      user: {
        id: 'usr_doctor_demo',
        displayName: 'Demo Doctor',
        email: 'doctor@ncb.local',
        role: 'clinician',
        medicalProfile: { defaultMedicalFee: 0 }
      }
    });
    getCaseByIdMock.mockResolvedValue({ id: 'case_1', patientId: 'cand_1', version: 2, assignedClinicianId: 'usr_doctor_demo' });
    getCandidateByIdMock.mockResolvedValue(sampleCandidate);
    createSubmissionMock.mockResolvedValue({ id: 'med_1' });

    await createSubmissionAction(null, formData(validFields()));

    expect(setCaseBillingMock).not.toHaveBeenCalled();
  });
});
