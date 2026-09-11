import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { caseAttachmentsRepository, type CaseAttachment } from '@ncb/database';
import { deleteAttachmentFile, readAttachmentFile, saveAttachmentFile } from '../../../lib/attachment-storage';

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

  return caseAttachmentsRepository.create({
    id,
    caseId: input.caseId,
    uploadedBy: input.uploadedBy,
    storageKey,
    originalName: input.originalName.slice(0, 255),
    contentType: input.contentType,
    byteSize: input.data.byteLength,
    sha256
  });
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
