import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const save = vi.fn();
const saveAndTransition = vi.fn();
const listAll = vi.fn();
const listForCase = vi.fn();
const findById = vi.fn();
const decrypt = vi.fn((row: { payload: unknown }) => row.payload);
const finalizeCaseTransitionMock = vi.fn();

vi.mock('@ncb/database', () => ({
  submissionsRepository: {
    save: (...args: unknown[]) => save(...args),
    saveAndTransition: (...args: unknown[]) => saveAndTransition(...args),
    listAll: (...args: unknown[]) => listAll(...args),
    listForCase: (...args: unknown[]) => listForCase(...args),
    findById: (...args: unknown[]) => findById(...args),
    decrypt: (...args: unknown[]) => decrypt(...(args as [{ payload: unknown }]))
  }
}));

const masterKey = randomBytes(32);
vi.mock('../../../../../lib/master-key', () => ({ loadMasterKey: () => masterKey }));

vi.mock('../../../../cases/services/cases-service', () => ({
  finalizeCaseTransition: (...args: unknown[]) => finalizeCaseTransitionMock(...args)
}));

const { createSubmission, createSubmissionAndTransitionCase, getSubmissionById, listSubmissions, listSubmissionsForCase } =
  await import('../../submissions-service');

function baseInput() {
  return {
    caseId: 'case_1',
    submittedBy: 'usr_doctor_demo',
    submittedByName: 'Demo Doctor',
    submittedByEmail: 'doctor@ncb.local',
    candidate: {
      candidateId: '',
      caseId: '',
      patientId: 'cand_1',
      fullName: 'Jane Doe',
      employeeId: 'EMP-1',
      nationalId: '',
      dateOfBirth: '1990-01-01',
      email: '',
      contactNumber: '',
      position: 'Teller',
      medicationInformation: ''
    },
    assessment: {
      facilityName: 'City Medical Centre',
      facilityAddress: '',
      assessmentDate: '2026-01-01',
      clinicianName: 'Dr. Example',
      clinicianRegistrationNumber: '',
      telephoneNumber: '',
      faxNumber: '',
      emailAddress: ''
    },
    vitals: {},
    medicalHistory: {},
    familyHistory: {},
    physicalExam: {},
    labResults: {},
    customFields: {},
    determination: { status: 'fit' as const, conclusions: '', restrictions: '', recommendation: '', followUpDate: '' },
    attestation: { signedBy: 'Dr. Example', signatureDate: '2026-01-01', consentConfirmed: true, signatureDataUrl: '' },
    consent: { accepted: false, signedBy: '', signedAt: '', signatureDataUrl: '' }
  };
}

describe('submissions service', () => {
  beforeEach(() => {
    save.mockReset();
    saveAndTransition.mockReset();
    listAll.mockReset();
    listForCase.mockReset();
    findById.mockReset();
    decrypt.mockClear();
    finalizeCaseTransitionMock.mockReset();
  });

  it('createSubmission builds the full payload, defaults review to pending, and persists against the real case id', async () => {
    save.mockResolvedValue(undefined);
    listForCase.mockResolvedValue([]);

    const submission = await createSubmission(baseInput());

    expect(submission.review).toEqual({
      status: 'pending',
      notes: '',
      reviewedAt: '',
      reviewedBy: '',
      reviewedByName: ''
    });
    expect(submission.caseId).toBe('case_1');
    expect(submission.version).toBe(1);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: 'case_1', submittedBy: 'usr_doctor_demo', submissionVersion: 1 }),
      masterKey
    );
  });

  it('a resubmission (case sent back to the doctor) gets the next version, not another 1 — otherwise it ties with the earlier row and a reviewer can end up seeing stale answers', async () => {
    save.mockResolvedValue(undefined);
    listForCase.mockResolvedValue([{ submissionVersion: 1 }]);

    const submission = await createSubmission(baseInput());

    expect(submission.version).toBe(2);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ submissionVersion: 2 }), masterKey);
  });

  it('listSubmissions decrypts every row', async () => {
    listAll.mockResolvedValue([{ payload: { id: 'med_1' } }]);
    const result = await listSubmissions();
    expect(result).toEqual([{ id: 'med_1' }]);
  });

  it('listSubmissionsForCase scopes to the given case', async () => {
    listForCase.mockResolvedValue([]);
    await listSubmissionsForCase('case_1');
    expect(listForCase).toHaveBeenCalledWith('case_1');
  });

  it('getSubmissionById returns null when nothing is found', async () => {
    findById.mockResolvedValue(null);
    expect(await getSubmissionById('missing')).toBeNull();
  });

  it('getSubmissionById decrypts the row when found', async () => {
    findById.mockResolvedValue({ payload: { id: 'med_1' } });
    expect(await getSubmissionById('med_1')).toEqual({ id: 'med_1' });
  });
});

describe('createSubmissionAndTransitionCase', () => {
  beforeEach(() => {
    saveAndTransition.mockReset();
    finalizeCaseTransitionMock.mockReset();
  });

  it('delegates the atomic write to saveAndTransition with the expected version and billing', async () => {
    saveAndTransition.mockResolvedValue({
      payload: { id: 'med_1', version: 1 },
      submissionVersion: 1,
      newCaseVersion: 3,
      previousStatus: 'sent_to_doctor'
    });

    await createSubmissionAndTransitionCase(baseInput(), 2, { payableAmount: 150, paymentStatus: 'unpaid' });

    expect(saveAndTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: 'case_1',
        submittedBy: 'usr_doctor_demo',
        expectedVersion: 2,
        newStatus: 'doctor_submitted',
        actorId: 'usr_doctor_demo',
        billing: { payableAmount: 150, paymentStatus: 'unpaid' }
      }),
      masterKey,
      expect.any(Function)
    );
  });

  it("the buildPayload callback produces the full submission shape using the transaction-computed version", async () => {
    saveAndTransition.mockImplementation(async (_input, _masterKey, buildPayload) => ({
      payload: buildPayload(2),
      submissionVersion: 2,
      newCaseVersion: 3,
      previousStatus: 'sent_to_doctor'
    }));

    const result = await createSubmissionAndTransitionCase(baseInput(), 2);

    expect(result.payload.version).toBe(2);
    expect(result.payload.review).toEqual({ status: 'pending', notes: '', reviewedAt: '', reviewedBy: '', reviewedByName: '' });
    expect(result.newCaseVersion).toBe(3);
  });

  it('finalizes the case transition (audit + notify) only after the transaction resolves, using its reported previousStatus', async () => {
    saveAndTransition.mockResolvedValue({
      payload: { id: 'med_1' },
      submissionVersion: 1,
      newCaseVersion: 3,
      previousStatus: 'sent_to_doctor'
    });

    await createSubmissionAndTransitionCase(baseInput(), 2);

    expect(finalizeCaseTransitionMock).toHaveBeenCalledWith('case_1', 'usr_doctor_demo', 'sent_to_doctor', 'doctor_submitted');
  });
});
