import { beforeEach, describe, expect, it, vi } from 'vitest';

const createMock = vi.fn();
const saveAttachmentFileMock = vi.fn();

vi.mock('@ncb/database', () => ({
  caseAttachmentsRepository: {
    create: (...args: unknown[]) => createMock(...args)
  }
}));
vi.mock('../../../../lib/attachment-storage', () => ({
  saveAttachmentFile: (...args: unknown[]) => saveAttachmentFileMock(...args),
  readAttachmentFile: vi.fn(),
  deleteAttachmentFile: vi.fn()
}));

const { uploadCaseAttachment, InvalidAttachmentError } = await import('../../services/case-attachments-service');

function realPdfBytes(): Buffer {
  return Buffer.from('%PDF-1.4\n%some pdf content here\n%%EOF\n', 'ascii');
}

describe('uploadCaseAttachment', () => {
  beforeEach(() => {
    createMock.mockReset();
    saveAttachmentFileMock.mockReset();
    createMock.mockResolvedValue({ id: 'att_1' });
  });

  it('accepts a real PDF (valid header and trailer)', async () => {
    await uploadCaseAttachment({
      caseId: 'case_1',
      uploadedBy: 'usr_1',
      originalName: 'report.pdf',
      contentType: 'application/pdf',
      data: realPdfBytes()
    });
    expect(saveAttachmentFileMock).toHaveBeenCalled();
    expect(createMock).toHaveBeenCalled();
  });

  it('rejects a file claiming application/pdf whose content is not actually a PDF', async () => {
    const notActuallyPdf = Buffer.from('this is just plain text, not a pdf at all', 'ascii');
    await expect(
      uploadCaseAttachment({ caseId: 'case_1', uploadedBy: 'usr_1', originalName: 'fake.pdf', contentType: 'application/pdf', data: notActuallyPdf })
    ).rejects.toThrow(InvalidAttachmentError);
    expect(saveAttachmentFileMock).not.toHaveBeenCalled();
  });

  it('rejects a PNG file renamed/relabeled as a PDF', async () => {
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    await expect(
      uploadCaseAttachment({ caseId: 'case_1', uploadedBy: 'usr_1', originalName: 'image.pdf', contentType: 'application/pdf', data: pngBytes })
    ).rejects.toThrow(InvalidAttachmentError);
  });

  it('rejects a truncated file that has a PDF header but no trailer', async () => {
    const truncated = Buffer.from('%PDF-1.4\nsome partial content that got cut off mid-stream', 'ascii');
    await expect(
      uploadCaseAttachment({ caseId: 'case_1', uploadedBy: 'usr_1', originalName: 'broken.pdf', contentType: 'application/pdf', data: truncated })
    ).rejects.toThrow(InvalidAttachmentError);
  });

  it('rejects a non-whitelisted content type before even checking content', async () => {
    await expect(
      uploadCaseAttachment({ caseId: 'case_1', uploadedBy: 'usr_1', originalName: 'report.docx', contentType: 'application/msword', data: realPdfBytes() })
    ).rejects.toThrow(InvalidAttachmentError);
  });

  it('rejects an empty file', async () => {
    await expect(
      uploadCaseAttachment({ caseId: 'case_1', uploadedBy: 'usr_1', originalName: 'empty.pdf', contentType: 'application/pdf', data: Buffer.alloc(0) })
    ).rejects.toThrow(InvalidAttachmentError);
  });

  it('rejects a file over the size limit', async () => {
    const oversized = Buffer.concat([PDF_HEADER_BYTES(), Buffer.alloc(15 * 1024 * 1024 + 1), Buffer.from('%%EOF')]);
    await expect(
      uploadCaseAttachment({ caseId: 'case_1', uploadedBy: 'usr_1', originalName: 'huge.pdf', contentType: 'application/pdf', data: oversized })
    ).rejects.toThrow(InvalidAttachmentError);
  });
});

function PDF_HEADER_BYTES(): Buffer {
  return Buffer.from('%PDF-1.4\n', 'ascii');
}
