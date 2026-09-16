import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const getCaseByIdMock = vi.fn();
const saveDoctorAssessmentDraftMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args), requireFullSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../../cases/case-authorization', async () => {
  const actual = await vi.importActual<typeof import('../../../../cases/case-authorization')>('../../../../cases/case-authorization');
  return actual;
});
vi.mock('../../../../cases/services/cases-service', () => ({
  getCaseById: (...args: unknown[]) => getCaseByIdMock(...args),
  saveDoctorAssessmentDraft: (...args: unknown[]) => saveDoctorAssessmentDraftMock(...args)
}));

const { saveSubmissionDraftAction } = await import('../../save-submission-draft');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const assignedCase = { id: 'case_1', status: 'sent_to_doctor', assignedClinicianId: 'usr_doc', payload: {} };

describe('saveSubmissionDraftAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getCaseByIdMock.mockReset();
    saveDoctorAssessmentDraftMock.mockReset();
    revalidatePathMock.mockClear();
    getCaseByIdMock.mockResolvedValue(assignedCase);
  });

  it('rejects without an active session', async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await saveSubmissionDraftAction(null, formData({ caseId: 'case_1' }));

    expect(result.ok).toBe(false);
    expect(saveDoctorAssessmentDraftMock).not.toHaveBeenCalled();
  });

  it("rejects when the caller's role lacks SUBMISSIONS_CREATE", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'patient' } });

    const result = await saveSubmissionDraftAction(null, formData({ caseId: 'case_1' }));

    expect(result.ok).toBe(false);
    expect(saveDoctorAssessmentDraftMock).not.toHaveBeenCalled();
  });

  it('rejects a missing caseId', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doc', role: 'clinician' } });

    const result = await saveSubmissionDraftAction(null, formData({}));

    expect(result.ok).toBe(false);
    expect(getCaseByIdMock).not.toHaveBeenCalled();
  });

  it('rejects when the case does not exist', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doc', role: 'clinician' } });
    getCaseByIdMock.mockResolvedValue(null);

    const result = await saveSubmissionDraftAction(null, formData({ caseId: 'case_1' }));

    expect(result.ok).toBe(false);
  });

  it('rejects a doctor not assigned to the case', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_other_doc', role: 'clinician' } });

    const result = await saveSubmissionDraftAction(null, formData({ caseId: 'case_1' }));

    expect(result.ok).toBe(false);
    expect(saveDoctorAssessmentDraftMock).not.toHaveBeenCalled();
  });

  it('rejects once the case has moved past sent_to_doctor', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doc', role: 'clinician' } });
    getCaseByIdMock.mockResolvedValue({ ...assignedCase, status: 'reviewed' });

    const result = await saveSubmissionDraftAction(null, formData({ caseId: 'case_1' }));

    expect(result.ok).toBe(false);
  });

  it('saves the draft, stripping caseId/caseVersion, stamps the actor, and revalidates the case page', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doc', role: 'clinician' } });

    const result = await saveSubmissionDraftAction(null, formData({ caseId: 'case_1', caseVersion: '3', 'exam.height': '170' }));

    expect(result).toEqual({ ok: true });
    expect(saveDoctorAssessmentDraftMock).toHaveBeenCalledWith(
      'case_1',
      expect.not.objectContaining({ caseId: expect.anything(), caseVersion: expect.anything() }),
      assignedCase.payload,
      'usr_doc'
    );
    expect(revalidatePathMock).toHaveBeenCalledWith('/cases/case_1');
  });

  it('lets a delegate save a draft on the case assigned to the doctor they support', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_delegate', role: 'delegate', delegateForClinicianId: 'usr_doc' } });

    const result = await saveSubmissionDraftAction(null, formData({ caseId: 'case_1', 'exam.height': '170' }));

    expect(result).toEqual({ ok: true });
    expect(saveDoctorAssessmentDraftMock).toHaveBeenCalledWith('case_1', expect.anything(), assignedCase.payload, 'usr_delegate');
  });

  it('rejects a delegate whose linked doctor is not the one this case is assigned to', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_delegate', role: 'delegate', delegateForClinicianId: 'usr_other_doc' } });

    const result = await saveSubmissionDraftAction(null, formData({ caseId: 'case_1' }));

    expect(result.ok).toBe(false);
    expect(saveDoctorAssessmentDraftMock).not.toHaveBeenCalled();
  });

  it("strips determination/attestation fields from a delegate's draft even if a raw request includes them", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_delegate', role: 'delegate', delegateForClinicianId: 'usr_doc' } });

    await saveSubmissionDraftAction(
      null,
      formData({ caseId: 'case_1', 'exam.height': '170', 'determination.status': 'fit', 'attestation.signedBy': 'Dr. Example' })
    );

    const savedDraft = saveDoctorAssessmentDraftMock.mock.calls[0]![1];
    expect(savedDraft).not.toHaveProperty('determination');
    expect(savedDraft).not.toHaveProperty('attestation');
    expect(savedDraft).toHaveProperty('exam');
  });

  it("does not strip determination/attestation from the doctor's own draft", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doc', role: 'clinician' } });

    await saveSubmissionDraftAction(null, formData({ caseId: 'case_1', 'determination.status': 'fit' }));

    const savedDraft = saveDoctorAssessmentDraftMock.mock.calls[0]![1];
    expect(savedDraft).toHaveProperty('determination');
  });
});
