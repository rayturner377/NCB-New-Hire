import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { caseAttachmentsRepository, type CaseAttachment } from '@ncb/database';
import { deleteAttachmentFile, readAttachmentFile, saveAttachmentFile } from '../../../lib/attachment-storage';
import { scanBuffer } from '../../../lib/virus-scan';

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set(['application/pdf']);

const PDF_HEADER = Buffer.from('%PDF-', 'ascii');
const PDF_TRAILER = Buffer.from('%%EOF', 'ascii');
/** How far into the tail of the file to look for the trailer marker — real PDFs always have one within the last kilobyte or so (trailing whitespace/newlines aside), even for large files. */
const PDF_TRAILER_SEARCH_WINDOW = 2048;

/**
 * Real content verification rather than trusting the browser-supplied
 * Content-Type/filename — a file renamed or relabeled to claim
 * `application/pdf` would otherwise sail straight through. Checks both ends
 * of the file (the `%PDF-` header every PDF must open with, and a `%%EOF`
 * marker within the trailer) rather than just the header alone, since a
 * header-only check would still accept a truncated or entirely different
 * file with four bytes of PDF magic prepended to it.
 *
 * This is a structural check only — it says nothing about whether the PDF is malicious (an embedded
 * exploit, a malicious JavaScript action, etc.). That's lib/virus-scan.ts's job, run asynchronously
 * after upload (see uploadCaseAttachment's own doc comment) — confirmed via external security
 * review that this function's name was previously the ONLY gate a file passed through before being
 * downloadable, with no actual antivirus scanning anywhere in the path.
 */
function looksLikePdf(data: Buffer): boolean {
  if (!data.subarray(0, PDF_HEADER.length).equals(PDF_HEADER)) return false;
  const tail = data.subarray(Math.max(0, data.byteLength - PDF_TRAILER_SEARCH_WINDOW));
  return tail.includes(PDF_TRAILER);
}

export interface UploadCaseAttachmentInput {
  caseId: string;
  uploadedBy: string;
  originalName: string;
  contentType: string;
  data: Buffer;
}

export class InvalidAttachmentError extends Error {}

/**
 * The case workspace's Documents tab — currently the only thing feeding
 * case_attachments is a doctor's stamped/scanned copy of their printed
 * assessment (see the "Export as PDF" side of this same feature,
 * lib/pdf/medical-assessment-pdf.ts), so uploads are restricted to PDF only
 * rather than the generic "any file type" a broader attachments feature
 * might eventually want.
 *
 * Returns as soon as the row is created — the row's `scanStatus` starts at 'pending' (the column
 * default) — and kicks the actual virus scan off detached (`void scanAttachmentInBackground(...)`,
 * same "don't block the caller on slow external I/O" shape as notification-service.ts's own
 * dispatchNotification), rather than making the uploader wait on a (possibly deployment-specific,
 * possibly not even configured — see lib/virus-scan.ts) scanner before the upload can even complete.
 * See the attachment route's own gating for what 'pending' means for who can view it in the
 * meantime — including that it means nothing extra at all when no scanner is configured.
 */
export async function uploadCaseAttachment(input: UploadCaseAttachmentInput): Promise<CaseAttachment> {
  if (!ALLOWED_CONTENT_TYPES.has(input.contentType)) {
    throw new InvalidAttachmentError('Only PDF files can be uploaded here.');
  }
  if (input.data.byteLength === 0) {
    throw new InvalidAttachmentError('That file is empty.');
  }
  if (input.data.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new InvalidAttachmentError('That file is larger than the 15 MB limit.');
  }
  if (!looksLikePdf(input.data)) {
    throw new InvalidAttachmentError('That file does not appear to be a valid PDF.');
  }

  const id = `att_${randomUUID()}`;
  const storageKey = randomUUID();
  const sha256 = createHash('sha256').update(input.data).digest('hex');

  await saveAttachmentFile(storageKey, input.data);

  const attachment = await caseAttachmentsRepository.create({
    id,
    caseId: input.caseId,
    uploadedBy: input.uploadedBy,
    storageKey,
    originalName: input.originalName.slice(0, 255),
    contentType: input.contentType,
    byteSize: input.data.byteLength,
    sha256
  });

  // Scans the exact bytes already in memory from this request, rather than reading the file back
  // (and decrypting it — see attachment-storage.ts) a second time moments later.
  void scanAttachmentInBackground(id, input.data);

  return attachment;
}

/**
 * The other half of uploadCaseAttachment's async scan — never awaited by its caller, never throws
 * out to one either. `unavailable` (no scanner configured at all — see lib/virus-scan.ts's
 * isScanningEnabled — or one that's configured but unreachable/erroring for this attempt)
 * deliberately leaves scanStatus at 'pending' rather than either extreme: not 'clean' (that would be
 * exactly the false assurance this whole fix exists to remove) and not 'rejected' (a transient
 * scanner outage, or scanning simply being off, shouldn't quarantine a legitimate file forever) —
 * the attachment route's own gating decides what 'pending' actually means for who can view it
 * meanwhile, and only restricts anyone when scanning is actually turned on.
 */
async function scanAttachmentInBackground(attachmentId: string, data: Buffer): Promise<void> {
  try {
    const result = await scanBuffer(data);
    if (result.verdict === 'clean') {
      await caseAttachmentsRepository.updateScanStatus(attachmentId, 'clean');
    } else if (result.verdict === 'infected') {
      await caseAttachmentsRepository.updateScanStatus(attachmentId, 'rejected');
    }
    // 'unavailable' — leave scanStatus at 'pending', see this function's own doc comment.
  } catch (error) {
    console.error(`Failed to record scan result for attachment ${attachmentId}:`, error);
  }
}

export function listCaseAttachments(caseId: string): Promise<CaseAttachment[]> {
  return caseAttachmentsRepository.listForCase(caseId);
}

export async function getCaseAttachmentFile(id: string): Promise<{ attachment: CaseAttachment; data: Buffer } | null> {
  const attachment = await caseAttachmentsRepository.findById(id);
  if (!attachment) return null;
  const data = await readAttachmentFile(attachment.storageKey);
  return { attachment, data };
}

export async function deleteCaseAttachment(id: string): Promise<void> {
  const attachment = await caseAttachmentsRepository.findById(id);
  if (!attachment) return;
  await caseAttachmentsRepository.softDelete(id);
  await deleteAttachmentFile(attachment.storageKey);
}
