import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const findByIdMock = vi.fn();
const getCaseByIdMock = vi.fn();
const deleteCaseAttachmentMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('@ncb/database', () => ({ caseAttachmentsRepository: { findById: (...args: unknown[]) => findByIdMock(...args) } }));
vi.mock('../../../services/case-attachments-service', () => ({
  deleteCaseAttachment: (...args: unknown[]) => deleteCaseAttachmentMock(...args)
}));
vi.mock('../../../services/cases-service', () => ({ getCaseById: (...args: unknown[]) => getCaseByIdMock(...args) }));

const { deleteCaseAttachmentAction } = await import('../../delete-case-attachment');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('deleteCaseAttachmentAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    findByIdMock.mockReset();
    getCaseByIdMock.mockReset();
    deleteCaseAttachmentMock.mockReset();
    revalidatePathMock.mockClear();
  });

  it('rejects without an active session', async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await deleteCaseAttachmentAction(null, formData({ attachmentId: 'att_1', caseId: 'case_1' }));

    expect(result.ok).toBe(false);
    expect(deleteCaseAttachmentMock).not.toHaveBeenCalled();
  });

  it('rejects when attachmentId or caseId is missing', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'reviewer' } });

    const result = await deleteCaseAttachmentAction(null, formData({ attachmentId: 'att_1' }));

    expect(result.ok).toBe(false);
    expect(findByIdMock).not.toHaveBeenCalled();
  });

  it('rejects when the attachment does not exist or belongs to a different case', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'reviewer' } });
    findByIdMock.mockResolvedValue({ id: 'att_1', caseId: 'a-different-case', uploadedBy: 'usr_1' });

    const result = await deleteCaseAttachmentAction(null, formData({ attachmentId: 'att_1', caseId: 'case_1' }));

    expect(result.ok).toBe(false);
    expect(deleteCaseAttachmentMock).not.toHaveBeenCalled();
  });

  it('rejects a caller who neither uploaded the document nor is an admin', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_2', role: 'clinician' } });
    findByIdMock.mockResolvedValue({ id: 'att_1', caseId: 'case_1', uploadedBy: 'usr_1' });

    const result = await deleteCaseAttachmentAction(null, formData({ attachmentId: 'att_1', caseId: 'case_1' }));

    expect(result.ok).toBe(false);
    expect(deleteCaseAttachmentMock).not.toHaveBeenCalled();
  });

  it('lets an admin remove a document they did not upload', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_admin', role: 'admin' } });
    findByIdMock.mockResolvedValue({ id: 'att_1', caseId: 'case_1', uploadedBy: 'usr_1' });
    getCaseByIdMock.mockResolvedValue(null);

    const result = await deleteCaseAttachmentAction(null, formData({ attachmentId: 'att_1', caseId: 'case_1' }));

    expect(result.ok).toBe(true);
    expect(deleteCaseAttachmentMock).toHaveBeenCalledWith('att_1');
  });

  it('rejects a doctor who uploaded the document but is no longer assigned to the case', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doc', role: 'clinician' } });
    findByIdMock.mockResolvedValue({ id: 'att_1', caseId: 'case_1', uploadedBy: 'usr_doc' });
    getCaseByIdMock.mockResolvedValue({ id: 'case_1', assignedClinicianId: 'a-different-doctor' });

    const result = await deleteCaseAttachmentAction(null, formData({ attachmentId: 'att_1', caseId: 'case_1' }));

    expect(result.ok).toBe(false);
    expect(deleteCaseAttachmentMock).not.toHaveBeenCalled();
  });

  it('deletes the attachment and revalidates the case page on success', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doc', role: 'clinician' } });
    findByIdMock.mockResolvedValue({ id: 'att_1', caseId: 'case_1', uploadedBy: 'usr_doc' });
    getCaseByIdMock.mockResolvedValue({ id: 'case_1', assignedClinicianId: 'usr_doc' });

    const result = await deleteCaseAttachmentAction(null, formData({ attachmentId: 'att_1', caseId: 'case_1' }));

    expect(result.ok).toBe(true);
    expect(deleteCaseAttachmentMock).toHaveBeenCalledWith('att_1');
    expect(revalidatePathMock).toHaveBeenCalledWith('/cases/case_1');
  });
});
