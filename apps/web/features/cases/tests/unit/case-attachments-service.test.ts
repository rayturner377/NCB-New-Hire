import { beforeEach, describe, expect, it, vi } from 'vitest';

const createMock = vi.fn();
const updateScanStatusMock = vi.fn();
const saveAttachmentFileMock = vi.fn();
const scanBufferMock = vi.fn();

vi.mock('@ncb/database', () => ({
  caseAttachmentsRepository: {
    create: (...args: unknown[]) => createMock(...args),
    updateScanStatus: (...args: unknown[]) => updateScanStatusMock(...args)
  }
}));
vi.mock('../../../../lib/attachment-storage', () => ({
  saveAttachmentFile: (...args: unknown[]) => saveAttachmentFileMock(...args),
  readAttachmentFile: vi.fn(),
  deleteAttachmentFile: vi.fn()
}));
vi.mock('../../../../lib/virus-scan', () => ({
  scanBuffer: (...args: unknown[]) => scanBufferMock(...args)
}));

const { uploadCaseAttachment, InvalidAttachmentError } = await import('../../services/case-attachments-service');

/** Lets a test yield to the microtask queue so the detached (non-awaited) background scan gets a chance to run — same idiom as notification-service.test.ts's own flushMicrotasks. */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function realPdfBytes(): Buffer {
  return Buffer.from('%PDF-1.4\n%some pdf content here\n%%EOF\n', 'ascii');
}

describe('uploadCaseAttachment', () => {
  beforeEach(() => {
    createMock.mockReset();
    updateScanStatusMock.mockReset();
    saveAttachmentFileMock.mockReset();
    scanBufferMock.mockReset();
    createMock.mockResolvedValue({ id: 'att_1' });
    scanBufferMock.mockResolvedValue({ verdict: 'clean' });
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

  it('returns before the scan resolves — upload latency is unaffected by the scanner', async () => {
    const scanDeferred = new Promise<{ verdict: 'clean' }>(() => {
      // Deliberately never resolves within this test — if uploadCaseAttachment awaited the scan,
      // this test would hang/time out instead of completing.
    });
    scanBufferMock.mockReturnValue(scanDeferred);

    const attachment = await uploadCaseAttachment({
      caseId: 'case_1',
      uploadedBy: 'usr_1',
      originalName: 'report.pdf',
      contentType: 'application/pdf',
      data: realPdfBytes()
    });

    expect(attachment).toEqual({ id: 'att_1' });
  });

  it('scans the exact bytes just uploaded and marks the row clean once the scanner reports it is', async () => {
    scanBufferMock.mockResolvedValue({ verdict: 'clean' });

    await uploadCaseAttachment({
      caseId: 'case_1',
      uploadedBy: 'usr_1',
      originalName: 'report.pdf',
      contentType: 'application/pdf',
      data: realPdfBytes()
    });
    await flushMicrotasks();

    // The id scanned/updated is the one actually generated for this upload (create()'s own input),
    // not whatever the mocked create() call happens to resolve with.
    const generatedId = createMock.mock.calls[0]![0].id;
    expect(scanBufferMock).toHaveBeenCalledWith(realPdfBytes());
    expect(updateScanStatusMock).toHaveBeenCalledWith(generatedId, 'clean');
  });

  it('marks the row rejected when the scanner reports an infection', async () => {
    scanBufferMock.mockResolvedValue({ verdict: 'infected', reply: 'stream: Eicar-Test-Signature FOUND' });

    await uploadCaseAttachment({
      caseId: 'case_1',
      uploadedBy: 'usr_1',
      originalName: 'report.pdf',
      contentType: 'application/pdf',
      data: realPdfBytes()
    });
    await flushMicrotasks();

    const generatedId = createMock.mock.calls[0]![0].id;
    expect(updateScanStatusMock).toHaveBeenCalledWith(generatedId, 'rejected');
  });

  it('leaves the row at pending — never marks it clean or rejected — when the scanner is unavailable', async () => {
    scanBufferMock.mockResolvedValue({ verdict: 'unavailable' });

    await uploadCaseAttachment({
      caseId: 'case_1',
      uploadedBy: 'usr_1',
      originalName: 'report.pdf',
      contentType: 'application/pdf',
      data: realPdfBytes()
    });
    await flushMicrotasks();

    expect(updateScanStatusMock).not.toHaveBeenCalled();
  });

  it('never lets a scan failure escape as an unhandled rejection', async () => {
    scanBufferMock.mockRejectedValue(new Error('scanner connection reset'));
    const unhandled = vi.fn();
    process.once('unhandledRejection', unhandled);

    await uploadCaseAttachment({
      caseId: 'case_1',
      uploadedBy: 'usr_1',
      originalName: 'report.pdf',
      contentType: 'application/pdf',
      data: realPdfBytes()
    });
    await flushMicrotasks();
    await flushMicrotasks();

    expect(unhandled).not.toHaveBeenCalled();
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
