import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const getCaseByIdMock = vi.fn();
const uploadCaseAttachmentMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args), requireFullSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../services/cases-service', () => ({ getCaseById: (...args: unknown[]) => getCaseByIdMock(...args) }));
// upload-case-attachment.ts's own createActionRateLimiter() ultimately
// depends on @ncb/redis's client, which throws at construction if
// REDIS_URL isn't set — not exercised by this test's assertions.
vi.mock('@ncb/redis', () => ({
  isRateLimited: async () => false,
  recordFailedAttempt: async () => undefined
}));

const { InvalidAttachmentError } = await vi.importActual<typeof import('../../../services/case-attachments-service')>(
  '../../../services/case-attachments-service'
);
vi.mock('../../../services/case-attachments-service', async () => {
  const actual = await vi.importActual<typeof import('../../../services/case-attachments-service')>(
    '../../../services/case-attachments-service'
  );
  return { ...actual, uploadCaseAttachment: (...args: unknown[]) => uploadCaseAttachmentMock(...args) };
});

const { uploadCaseAttachmentAction } = await import('../../upload-case-attachment');

function formData(fields: Record<string, string | File>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const pdfFile = new File(['%PDF-1.4 fake content'], 'report.pdf', { type: 'application/pdf' });
const assignedCase = { id: 'case_1', assignedClinicianId: 'usr_doc' };

describe('uploadCaseAttachmentAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getCaseByIdMock.mockReset();
    uploadCaseAttachmentMock.mockReset();
    revalidatePathMock.mockClear();
    getCaseByIdMock.mockResolvedValue(assignedCase);
  });

  it('rejects without an active session', async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await uploadCaseAttachmentAction(null, formData({ caseId: 'case_1', file: pdfFile }));

    expect(result.ok).toBe(false);
    expect(uploadCaseAttachmentMock).not.toHaveBeenCalled();
  });

  it("rejects when the caller's role lacks MEDICAL_CASES_ATTACH", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_patient', role: 'patient' } });

    const result = await uploadCaseAttachmentAction(null, formData({ caseId: 'case_1', file: pdfFile }));

    expect(result.ok).toBe(false);
    expect(uploadCaseAttachmentMock).not.toHaveBeenCalled();
  });

  it('rejects a missing caseId', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doc', role: 'clinician' } });

    const result = await uploadCaseAttachmentAction(null, formData({ file: pdfFile }));

    expect(result.ok).toBe(false);
    expect(getCaseByIdMock).not.toHaveBeenCalled();
  });

  it('rejects when the case does not exist', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doc', role: 'clinician' } });
    getCaseByIdMock.mockResolvedValue(null);

    const result = await uploadCaseAttachmentAction(null, formData({ caseId: 'case_1', file: pdfFile }));

    expect(result.ok).toBe(false);
  });

  it('rejects a doctor not assigned to the case', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_other_doc', role: 'clinician' } });

    const result = await uploadCaseAttachmentAction(null, formData({ caseId: 'case_1', file: pdfFile }));

    expect(result.ok).toBe(false);
    expect(uploadCaseAttachmentMock).not.toHaveBeenCalled();
  });

  it('rejects a missing or empty file', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doc', role: 'clinician' } });

    const result = await uploadCaseAttachmentAction(null, formData({ caseId: 'case_1' }));

    expect(result.ok).toBe(false);
    expect(uploadCaseAttachmentMock).not.toHaveBeenCalled();
  });

  it('surfaces InvalidAttachmentError as a friendly error rather than throwing', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doc', role: 'clinician' } });
    uploadCaseAttachmentMock.mockRejectedValue(new InvalidAttachmentError('Only PDF files are allowed.'));

    const result = await uploadCaseAttachmentAction(null, formData({ caseId: 'case_1', file: pdfFile }));

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Only PDF files are allowed.');
  });

  it('rethrows an unexpected error', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doc', role: 'clinician' } });
    uploadCaseAttachmentMock.mockRejectedValue(new Error('disk full'));

    await expect(uploadCaseAttachmentAction(null, formData({ caseId: 'case_1', file: pdfFile }))).rejects.toThrow('disk full');
  });

  it('uploads and revalidates the case page on success', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doc', role: 'clinician' } });
    uploadCaseAttachmentMock.mockResolvedValue({ id: 'att_1' });

    const result = await uploadCaseAttachmentAction(null, formData({ caseId: 'case_1', file: pdfFile }));

    expect(result.ok).toBe(true);
    expect(uploadCaseAttachmentMock).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: 'case_1', uploadedBy: 'usr_doc', originalName: 'report.pdf', contentType: 'application/pdf' })
    );
    expect(revalidatePathMock).toHaveBeenCalledWith('/cases/case_1');
  });

  it('lets a reviewer (not assigned to any case) upload regardless of assignment', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer', role: 'reviewer' } });
    uploadCaseAttachmentMock.mockResolvedValue({ id: 'att_1' });

    const result = await uploadCaseAttachmentAction(null, formData({ caseId: 'case_1', file: pdfFile }));

    expect(result.ok).toBe(true);
  });
});
