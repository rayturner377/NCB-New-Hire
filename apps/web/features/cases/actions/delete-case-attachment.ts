'use server';

import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { ROLES } from '../../../lib/permissions';
import { requireFullSession } from '../../../lib/session';
import { auditRepository, caseAttachmentsRepository } from '@ncb/database';
import { matchesClinicianAssignment } from '../case-authorization';
import { deleteCaseAttachment } from '../services/case-attachments-service';
import { getCaseById } from '../services/cases-service';

export interface DeleteCaseAttachmentResult {
  ok: boolean;
  error?: string;
}

/** Removing a mistaken upload — restricted to whoever uploaded it, or an admin, so a doctor can't pull another doctor's document off a case they're not even assigned to. */
export async function deleteCaseAttachmentAction(
  _prevState: DeleteCaseAttachmentResult | null,
  formData: FormData
): Promise<DeleteCaseAttachmentResult> {
  await assertSameOrigin();

  const session = await requireFullSession();
  if (!session) {
    return { ok: false, error: 'Your session has expired. Please sign in again.' };
  }

  const attachmentId = String(formData.get('attachmentId') || '');
  const caseId = String(formData.get('caseId') || '');
  if (!attachmentId || !caseId) {
    return { ok: false, error: 'Missing attachment reference.' };
  }

  const attachment = await caseAttachmentsRepository.findById(attachmentId);
  if (!attachment || attachment.caseId !== caseId) {
    return { ok: false, error: 'That document could not be found.' };
  }

  if (attachment.uploadedBy !== session.user.id && session.user.role !== ROLES.ADMIN) {
    return { ok: false, error: 'Only the person who uploaded this document (or an admin) can remove it.' };
  }

  const medicalCase = await getCaseById(caseId);
  if (medicalCase && !matchesClinicianAssignment(session.user, medicalCase)) {
    return { ok: false, error: 'This case is not assigned to you.' };
  }

  await deleteCaseAttachment(attachmentId);

  await auditRepository.append({
    eventType: 'case_attachment_deleted',
    actorUserId: session.user.id,
    entityType: 'case_attachment',
    entityId: attachmentId,
    details: { caseId, originalName: attachment.originalName }
  });

  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
