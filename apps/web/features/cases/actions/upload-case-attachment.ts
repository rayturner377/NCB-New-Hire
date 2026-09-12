'use server';

import { revalidatePath } from 'next/cache';
import { auditRepository } from '@ncb/database';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { createActionRateLimiter } from '../../../lib/action-rate-limit';
import { PERMISSIONS, hasPermission } from '../../../lib/permissions';
import { requireFullSession } from '../../../lib/session';
import { ownsCase } from '../case-authorization';
import { InvalidAttachmentError, uploadCaseAttachment } from '../services/case-attachments-service';
import { getCaseById } from '../services/cases-service';

export interface UploadCaseAttachmentResult {
  ok: boolean;
  error?: string;
}

/** 20 uploads per 10 minutes per user — generous for the real workflow (stamping and re-uploading one case's assessment at a time) while still bounding how many times an authenticated user can hit disk/storage in a burst. */
const uploadLimiter = createActionRateLimiter('upload-case-attachment', 20, 10 * 60 * 1000);

/**
 * Documents tab / doctor-form upload target — see features/cases/components/
 * case-documents/case-document-tools.tsx, the one component that renders
 * this in both places. A doctor can only attach to a case actually assigned
 * to them (past or present — this deliberately isn't gated on case status,
 * since the whole point is letting them come back and upload a stamped copy
 * after they've already submitted); reviewer/admin can attach to any case,
 * matching their existing broad case visibility.
 */
export async function uploadCaseAttachmentAction(
  _prevState: UploadCaseAttachmentResult | null,
  formData: FormData
): Promise<UploadCaseAttachmentResult> {
  await assertSameOrigin();

  const session = await requireFullSession();
  if (!session) {
    return { ok: false, error: 'Your session has expired. Please sign in again.' };
  }

  if (!hasPermission(session.user, PERMISSIONS.MEDICAL_CASES_ATTACH)) {
    return { ok: false, error: 'Your account does not have permission to upload documents.' };
  }

  if (await uploadLimiter.isLimited(session.user.id)) {
    return { ok: false, error: 'Too many uploads — please wait a few minutes and try again.' };
  }
  await uploadLimiter.recordAttempt(session.user.id);

  const caseId = String(formData.get('caseId') || '');
  if (!caseId) {
    return { ok: false, error: 'Missing case reference.' };
  }

  const medicalCase = await getCaseById(caseId);
  if (!medicalCase) {
    return { ok: false, error: 'That case could not be found.' };
  }
  if (!ownsCase(session.user, medicalCase)) {
    return { ok: false, error: 'This case is not assigned to you.' };
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose a PDF file to upload.' };
  }

  try {
    const data = Buffer.from(await file.arrayBuffer());
    const attachment = await uploadCaseAttachment({
      caseId,
      uploadedBy: session.user.id,
      originalName: file.name || 'document.pdf',
      contentType: file.type || 'application/octet-stream',
      data
    });

    await auditRepository.append({
      eventType: 'case_attachment_uploaded',
      actorUserId: session.user.id,
      entityType: 'case_attachment',
      entityId: attachment.id,
      details: { caseId, originalName: attachment.originalName }
    });
  } catch (error) {
    if (error instanceof InvalidAttachmentError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
