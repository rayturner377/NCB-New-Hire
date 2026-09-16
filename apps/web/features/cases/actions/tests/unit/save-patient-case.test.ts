import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CaseVersionConflictError } from '@ncb/database';
import { FAMILY_DISORDER_CATALOG, MEDICAL_DISEASE_CATALOG } from '../../../patient-case-data';

const getSessionMock = vi.fn();
const patientOwnsCaseMock = vi.fn();
const parsePatientCaseDataMock = vi.fn();
const parseAndValidateImageDataUrlMock = vi.fn();
const getCaseWithPatientByIdMock = vi.fn();
const savePatientCaseProgressMock = vi.fn();
const submitPatientCaseMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args), requireFullSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../../../lib/image-data-url', () => ({
  parseAndValidateImageDataUrl: (...args: unknown[]) => parseAndValidateImageDataUrlMock(...args)
}));
vi.mock('../../../case-authorization', () => ({ patientOwnsCase: (...args: unknown[]) => patientOwnsCaseMock(...args) }));
vi.mock('../../../parse-patient-case-data', () => ({
  parsePatientCaseData: (...args: unknown[]) => parsePatientCaseDataMock(...args)
}));
vi.mock('../../../services/cases-service', () => ({
  getCaseWithPatientById: (...args: unknown[]) => getCaseWithPatientByIdMock(...args),
  savePatientCaseProgress: (...args: unknown[]) => savePatientCaseProgressMock(...args),
  submitPatientCase: (...args: unknown[]) => submitPatientCaseMock(...args)
}));

const { savePatientCaseAction } = await import('../../save-patient-case');

function formData(fields: Record<string, string> = {}): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function completePatientCaseData(overrides: Record<string, unknown> = {}) {
  const disorders = Object.fromEntries(FAMILY_DISORDER_CATALOG.map((item) => [item.key, { answer: 'no' }]));
  const diseases = Object.fromEntries(MEDICAL_DISEASE_CATALOG.map((item) => [item.key, { answer: 'no' }]));
  return {
    familyHistory: { disorders, notes: '' },
    medicalHistory: { diseases, notes: '' },
    consent: { accepted: true, signedBy: 'Jane Doe', signedAt: '2026-01-01', signatureDataUrl: 'data:image/png;base64,abc' },
    assignedClinicianId: 'doc_1',
    ...overrides
  };
}

const pendingCase = { id: 'case_1', status: 'sent_to_patient', version: 3, payload: {} };

describe('savePatientCaseAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    patientOwnsCaseMock.mockReset();
    parsePatientCaseDataMock.mockReset();
    parseAndValidateImageDataUrlMock.mockReset();
    getCaseWithPatientByIdMock.mockReset();
    savePatientCaseProgressMock.mockReset();
    submitPatientCaseMock.mockReset();
    revalidatePathMock.mockClear();

    getSessionMock.mockResolvedValue({ user: { id: 'usr_patient', role: 'patient' } });
    patientOwnsCaseMock.mockResolvedValue(true);
    getCaseWithPatientByIdMock.mockResolvedValue(pendingCase);
    parsePatientCaseDataMock.mockReturnValue(completePatientCaseData());
  });

  it('rejects without an active session', async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await savePatientCaseAction(null, formData({ caseId: 'case_1' }));

    expect(result.ok).toBe(false);
  });

  it('rejects a non-patient caller', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'reviewer' } });

    const result = await savePatientCaseAction(null, formData({ caseId: 'case_1' }));

    expect(result.ok).toBe(false);
  });

  it('rejects a missing caseId', async () => {
    const result = await savePatientCaseAction(null, formData({}));
    expect(result.ok).toBe(false);
    expect(getCaseWithPatientByIdMock).not.toHaveBeenCalled();
  });

  it('rejects when the case does not exist', async () => {
    getCaseWithPatientByIdMock.mockResolvedValue(null);

    const result = await savePatientCaseAction(null, formData({ caseId: 'case_1' }));

    expect(result.ok).toBe(false);
  });

  it('rejects (as "not found", not revealing ownership) when the case belongs to a different patient', async () => {
    patientOwnsCaseMock.mockResolvedValue(false);

    const result = await savePatientCaseAction(null, formData({ caseId: 'case_1' }));

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('rejects when the case is not currently waiting on the patient', async () => {
    getCaseWithPatientByIdMock.mockResolvedValue({ ...pendingCase, status: 'reviewed' });

    const result = await savePatientCaseAction(null, formData({ caseId: 'case_1' }));

    expect(result.ok).toBe(false);
  });

  it('saves a draft without validating completeness when intent is not "submit"', async () => {
    parsePatientCaseDataMock.mockReturnValue(completePatientCaseData({ consent: { accepted: false } }));

    const result = await savePatientCaseAction(null, formData({ caseId: 'case_1', intent: 'draft' }));

    expect(result).toEqual({ ok: true, message: 'Draft saved.' });
    expect(savePatientCaseProgressMock).toHaveBeenCalledWith('case_1', expect.any(Object), pendingCase.payload, pendingCase.version);
    expect(submitPatientCaseMock).not.toHaveBeenCalled();
  });

  it('reports a friendly error, not a thrown exception, when the draft save loses a version race', async () => {
    savePatientCaseProgressMock.mockRejectedValue(new CaseVersionConflictError());

    const result = await savePatientCaseAction(null, formData({ caseId: 'case_1', intent: 'draft' }));

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/changed since you loaded it/i);
  });

  it('rejects submission without full consent', async () => {
    parsePatientCaseDataMock.mockReturnValue(completePatientCaseData({ consent: { accepted: false } }));

    const result = await savePatientCaseAction(null, formData({ caseId: 'case_1', intent: 'submit' }));

    expect(result.ok).toBe(false);
    expect(submitPatientCaseMock).not.toHaveBeenCalled();
  });

  it('rejects submission with an unreadable signature', async () => {
    parseAndValidateImageDataUrlMock.mockImplementation(() => {
      throw new Error('bad image');
    });

    const result = await savePatientCaseAction(null, formData({ caseId: 'case_1', intent: 'submit' }));

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/signature/i);
  });

  it('rejects submission with no doctor chosen', async () => {
    parsePatientCaseDataMock.mockReturnValue(completePatientCaseData({ assignedClinicianId: '' }));

    const result = await savePatientCaseAction(null, formData({ caseId: 'case_1', intent: 'submit' }));

    expect(result.ok).toBe(false);
  });

  it('rejects submission with an incomplete family history section', async () => {
    const data = completePatientCaseData();
    delete (data.familyHistory.disorders as Record<string, unknown>)[FAMILY_DISORDER_CATALOG[0]!.key];
    parsePatientCaseDataMock.mockReturnValue(data);

    const result = await savePatientCaseAction(null, formData({ caseId: 'case_1', intent: 'submit' }));

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/family/i);
  });

  it('rejects submission with an incomplete medical history section', async () => {
    const data = completePatientCaseData();
    delete (data.medicalHistory.diseases as Record<string, unknown>)[MEDICAL_DISEASE_CATALOG[0]!.key];
    parsePatientCaseDataMock.mockReturnValue(data);

    const result = await savePatientCaseAction(null, formData({ caseId: 'case_1', intent: 'submit' }));

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/medical history/i);
  });

  it('rejects a "yes" medical history answer with no year given', async () => {
    const data = completePatientCaseData();
    (data.medicalHistory.diseases as Record<string, { answer: string; year?: string }>)[MEDICAL_DISEASE_CATALOG[0]!.key] = {
      answer: 'yes'
    };
    parsePatientCaseDataMock.mockReturnValue(data);

    const result = await savePatientCaseAction(null, formData({ caseId: 'case_1', intent: 'submit' }));

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/year/i);
  });

  it('submits successfully once every section is complete', async () => {
    const result = await savePatientCaseAction(null, formData({ caseId: 'case_1', intent: 'submit' }));

    expect(result).toEqual({ ok: true, submitted: true, message: expect.stringContaining('Submitted') });
    expect(submitPatientCaseMock).toHaveBeenCalledWith(
      'case_1',
      expect.any(Object),
      pendingCase.version,
      'usr_patient',
      pendingCase.payload
    );
    expect(revalidatePathMock).toHaveBeenCalledWith('/cases/case_1');
    expect(revalidatePathMock).toHaveBeenCalledWith('/');
  });
});
