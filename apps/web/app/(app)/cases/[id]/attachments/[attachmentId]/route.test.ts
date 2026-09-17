import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const getCaseByIdMock = vi.fn();
const getCaseAttachmentFileMock = vi.fn();
const listCandidatesForUserMock = vi.fn();
const auditAppendMock = vi.fn();

vi.mock('../../../../../../lib/session', () => ({
  getSession: (...args: unknown[]) => getSessionMock(...args),
  requireFullSession: (...args: unknown[]) => getSessionMock(...args)
}));
vi.mock('../../../../../../features/cases/services/cases-service', () => ({
  getCaseById: (...args: unknown[]) => getCaseByIdMock(...args)
}));
vi.mock('../../../../../../features/cases/services/case-attachments-service', () => ({
  getCaseAttachmentFile: (...args: unknown[]) => getCaseAttachmentFileMock(...args)
}));
vi.mock('../../../../../../features/candidates/services/candidates-service', () => ({
  listCandidatesForUser: (...args: unknown[]) => listCandidatesForUserMock(...args)
}));
vi.mock('@ncb/database', () => ({
  auditRepository: { append: (...args: unknown[]) => auditAppendMock(...args) }
}));

const { GET } = await import('./route');

function makeParams(id: string, attachmentId: string) {
  return { params: Promise.resolve({ id, attachmentId }) };
}

const sampleCase = { id: 'case_1', patientId: 'cand_1', assignedClinicianId: 'usr_doctor_demo' };
const sampleAttachment = {
  attachment: {
    id: 'att_1',
    caseId: 'case_1',
    contentType: 'application/pdf',
    originalName: 'report.pdf',
    scanStatus: 'clean',
    uploadedBy: 'usr_doctor_demo'
  },
  data: Buffer.from('pdf-bytes')
};

describe('GET /cases/[id]/attachments/[attachmentId]', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getCaseByIdMock.mockReset();
    getCaseAttachmentFileMock.mockReset();
    listCandidatesForUserMock.mockReset();
    auditAppendMock.mockReset();
    getCaseByIdMock.mockResolvedValue(sampleCase);
    getCaseAttachmentFileMock.mockResolvedValue(sampleAttachment);
  });

  it('rejects without an active session', async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await GET(new Request('http://x'), makeParams('case_1', 'att_1'));

    expect(response.status).toBe(401);
  });

  it("rejects a role lacking MEDICAL_CASES_LIST (e.g. permission revoked via override)", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'reviewer', permissions: [] } });

    const response = await GET(new Request('http://x'), makeParams('case_1', 'att_1'));

    expect(response.status).toBe(404);
    expect(getCaseByIdMock).not.toHaveBeenCalled();
  });

  it('lets the doctor assigned to the case download its attachment', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doctor_demo', role: 'clinician' } });

    const response = await GET(new Request('http://x'), makeParams('case_1', 'att_1'));

    expect(response.status).toBe(200);
    expect(auditAppendMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'case_attachment_downloaded', actorUserId: 'usr_doctor_demo' })
    );
  });

  it('rejects a doctor NOT assigned to the case', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_other_doctor', role: 'clinician' } });

    const response = await GET(new Request('http://x'), makeParams('case_1', 'att_1'));

    expect(response.status).toBe(404);
    expect(getCaseAttachmentFileMock).not.toHaveBeenCalled();
  });

  it("lets a delegate download an attachment on the case assigned to the doctor they support", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: 'usr_delegate', role: 'delegate', delegateForClinicianId: 'usr_doctor_demo' }
    });

    const response = await GET(new Request('http://x'), makeParams('case_1', 'att_1'));

    expect(response.status).toBe(200);
  });

  it(
    'rejects a delegate whose linked doctor is not the one this case is assigned to — the exact gap ' +
      'this route used to have before it shared matchesClinicianAssignment() with the rest of the app',
    async () => {
      getSessionMock.mockResolvedValue({
        user: { id: 'usr_delegate', role: 'delegate', delegateForClinicianId: 'usr_a_different_doctor' }
      });

      const response = await GET(new Request('http://x'), makeParams('case_1', 'att_1'));

      expect(response.status).toBe(404);
      expect(getCaseAttachmentFileMock).not.toHaveBeenCalled();
    }
  );

  it('rejects a delegate with no doctor linked yet', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_delegate', role: 'delegate', delegateForClinicianId: null } });

    const response = await GET(new Request('http://x'), makeParams('case_1', 'att_1'));

    expect(response.status).toBe(404);
  });

  it("lets a patient download an attachment on their own case", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_patient', role: 'patient' } });
    listCandidatesForUserMock.mockResolvedValue([{ id: 'cand_1' }]);

    const response = await GET(new Request('http://x'), makeParams('case_1', 'att_1'));

    expect(response.status).toBe(200);
  });

  it("rejects a patient trying to download another patient's case attachment", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_patient', role: 'patient' } });
    listCandidatesForUserMock.mockResolvedValue([{ id: 'cand_someone_else' }]);

    const response = await GET(new Request('http://x'), makeParams('case_1', 'att_1'));

    expect(response.status).toBe(404);
  });

  it('rejects when the case cannot be found', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_admin', role: 'admin' } });
    getCaseByIdMock.mockResolvedValue(null);

    const response = await GET(new Request('http://x'), makeParams('case_1', 'att_1'));

    expect(response.status).toBe(404);
  });

  it("rejects when the attachment belongs to a different case than the URL names", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_admin', role: 'admin' } });
    getCaseAttachmentFileMock.mockResolvedValue({ ...sampleAttachment, attachment: { ...sampleAttachment.attachment, caseId: 'case_2' } });

    const response = await GET(new Request('http://x'), makeParams('case_1', 'att_1'));

    expect(response.status).toBe(404);
  });

  it('rejects a rejected/failed scan for anyone other than the uploader or an admin', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_other_reviewer', role: 'reviewer' } });
    getCaseAttachmentFileMock.mockResolvedValue({
      ...sampleAttachment,
      attachment: { ...sampleAttachment.attachment, scanStatus: 'rejected', uploadedBy: 'usr_someone_else' }
    });

    const response = await GET(new Request('http://x'), makeParams('case_1', 'att_1'));

    expect(response.status).toBe(404);
  });

  it('still lets an admin through a rejected/failed scan', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_admin', role: 'admin' } });
    getCaseAttachmentFileMock.mockResolvedValue({
      ...sampleAttachment,
      attachment: { ...sampleAttachment.attachment, scanStatus: 'rejected', uploadedBy: 'usr_someone_else' }
    });

    const response = await GET(new Request('http://x'), makeParams('case_1', 'att_1'));

    expect(response.status).toBe(200);
  });

  it('rejects a pending (not-yet-scanned) attachment for anyone other than the uploader — admin included', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_admin', role: 'admin' } });
    getCaseAttachmentFileMock.mockResolvedValue({
      ...sampleAttachment,
      attachment: { ...sampleAttachment.attachment, scanStatus: 'pending', uploadedBy: 'usr_someone_else' }
    });

    const response = await GET(new Request('http://x'), makeParams('case_1', 'att_1'));

    expect(response.status).toBe(404);
  });

  it('lets the uploader themselves view their own attachment while it is still pending', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doctor_demo', role: 'clinician' } });
    getCaseAttachmentFileMock.mockResolvedValue({
      ...sampleAttachment,
      attachment: { ...sampleAttachment.attachment, scanStatus: 'pending', uploadedBy: 'usr_doctor_demo' }
    });

    const response = await GET(new Request('http://x'), makeParams('case_1', 'att_1'));

    expect(response.status).toBe(200);
  });

  it(
    'rejects a pending attachment for anyone but its uploader even with no scanner configured at all — ' +
      'the gate is deliberately unconditional, not relaxed just because scanning is off',
    async () => {
      getSessionMock.mockResolvedValue({ user: { id: 'usr_other_reviewer', role: 'reviewer' } });
      getCaseAttachmentFileMock.mockResolvedValue({
        ...sampleAttachment,
        attachment: { ...sampleAttachment.attachment, scanStatus: 'pending', uploadedBy: 'usr_someone_else' }
      });

      const response = await GET(new Request('http://x'), makeParams('case_1', 'att_1'));

      expect(response.status).toBe(404);
    }
  );
});
