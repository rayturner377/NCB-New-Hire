import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const save = vi.fn();
const listAll = vi.fn();
const listForCase = vi.fn();
const findById = vi.fn();
const decrypt = vi.fn((row: { payload: unknown }) => row.payload);

vi.mock('@ncb/database', () => ({
  submissionsRepository: {
    save: (...args: unknown[]) => save(...args),
    listAll: (...args: unknown[]) => listAll(...args),
    listForCase: (...args: unknown[]) => listForCase(...args),
    findById: (...args: unknown[]) => findById(...args),
    decrypt: (...args: unknown[]) => decrypt(...(args as [{ payload: unknown }]))
  }
}));

const masterKey = randomBytes(32);
vi.mock('../../../../../lib/master-key', () => ({ loadMasterKey: () => masterKey }));

const { createSubmission, getSubmissionById, listSubmissions, listSubmissionsForCase } = await import(
  '../../submissions-service'
);

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
    listAll.mockReset();
    listForCase.mockReset();
    findById.mockReset();
    decrypt.mockClear();
  });

  it('createSubmission builds the full payload, defaults review to pending, and persists against the real case id', async () => {
    save.mockResolvedValue(undefined);

    const submission = await createSubmission(baseInput());

    expect(submission.review).toEqual({
      status: 'pending',
      notes: '',
      reviewedAt: '',
      reviewedBy: '',
      reviewedByName: ''
    });
    expect(submission.caseId).toBe('case_1');
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: 'case_1', submittedBy: 'usr_doctor_demo' }),
      masterKey
    );
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
