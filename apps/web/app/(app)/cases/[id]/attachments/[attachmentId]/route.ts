import { NextResponse } from 'next/server';
import { auditRepository } from '@ncb/database';
import { listCandidatesForUser } from '../../../../../../features/candidates/services/candidates-service';
import { ownsCase } from '../../../../../../features/cases/case-authorization';
import { getCaseAttachmentFile } from '../../../../../../features/cases/services/case-attachments-service';
import { getCaseById } from '../../../../../../features/cases/services/cases-service';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../../../../lib/permissions';
import { requireFullSession } from '../../../../../../lib/session';
import { isScanningEnabled } from '../../../../../../lib/virus-scan';

/**
 * Streams a case attachment (a doctor's stamped assessment copy, today the
 * only thing this feature produces) back for viewing/downloading — a plain
 * server action can't hand back a raw byte stream the way a real
 * navigable URL can, so this is a Route Handler instead. Same viewer rules
 * as the case workspace itself (case-detail-container.tsx): broad staff
 * visibility, a clinician restricted to a case actually assigned to them, a
 * patient restricted to their own case.
 */
export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const params = await props.params;
  const session = await requireFullSession();
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // The role-based branches below scope clinician/patient to their own case, but say
  // nothing about whether the caller can see cases at all — without this, a reviewer/
  // auditor/admin whose MEDICAL_CASES_LIST was revoked via a per-user permission override
  // could still retrieve a known attachment URL, since neither branch below applies to them.
  try {
    requirePermission(session.user, PERMISSIONS.MEDICAL_CASES_LIST);
  } catch (error) {
    if (error instanceof ForbiddenError) return new NextResponse('Not found', { status: 404 });
    throw error;
  }

  const medicalCase = await getCaseById(params.id);
  if (!medicalCase) {
    return new NextResponse('Not found', { status: 404 });
  }

  // Was a hand-rolled `role === 'clinician' && assignedClinicianId !== id` check that predated the
  // delegate role and never accounted for it — falling through unrestricted for a delegate actor,
  // since neither this branch nor the patient one below applied to them. Now shares the exact same
  // ownership check as save-submission-draft.ts/case-detail-container.tsx instead of a second,
  // independently-maintained copy of it.
  if (!ownsCase(session.user, medicalCase)) {
    return new NextResponse('Not found', { status: 404 });
  }
  if (session.user.role === 'patient') {
    const ownCandidates = await listCandidatesForUser(session.user.id);
    if (!ownCandidates.some((candidate) => candidate.id === medicalCase.patientId)) {
      return new NextResponse('Not found', { status: 404 });
    }
  }

  const result = await getCaseAttachmentFile(params.attachmentId);
  if (!result || result.attachment.caseId !== params.id) {
    return new NextResponse('Not found', { status: 404 });
  }

  // Malware scanning is optional (see lib/virus-scan.ts's own doc comment) — when no scanner is
  // configured at all, 'pending' just means "never scanned", not "a verdict is imminent", so normal
  // case-access rules apply exactly as they did before this feature existed; gating on it here too
  // would permanently lock every attachment to its uploader forever the moment scanning is left off,
  // which is precisely the "optional feature makes things worse when unused" failure this app must
  // not have. Only once a real scan is actually running does 'pending' mean "wait for it, a few
  // seconds, uploader-only in the meantime" — and only then do 'rejected'/'failed' (a real
  // infection, or the scanner itself erroring) mean anything either, relaxed to uploader-or-admin
  // since an admin may need to investigate a flagged file.
  if (isScanningEnabled()) {
    if (result.attachment.scanStatus === 'pending' && result.attachment.uploadedBy !== session.user.id) {
      return new NextResponse('Not found', { status: 404 });
    }
    if (
      (result.attachment.scanStatus === 'rejected' || result.attachment.scanStatus === 'failed') &&
      result.attachment.uploadedBy !== session.user.id &&
      session.user.role !== 'admin'
    ) {
      return new NextResponse('Not found', { status: 404 });
    }
  }

  // Downloading a medical document is exactly the kind of access an investigator would need
  // to reconstruct later — the read side was previously unaudited even though every mutation
  // (upload, delete) already went through auditRepository.append elsewhere.
  await auditRepository.append({
    eventType: 'case_attachment_downloaded',
    actorUserId: session.user.id,
    entityType: 'case_attachment',
    entityId: params.attachmentId,
    details: { caseId: params.id }
  });

  const body = new Uint8Array(result.data);
  return new NextResponse(body, {
    headers: {
      'Content-Type': result.attachment.contentType,
      'Content-Disposition': `inline; filename="${result.attachment.originalName.replace(/"/g, '')}"`,
      'Content-Length': String(result.data.byteLength),
      'Cache-Control': 'private, no-store'
    }
  });
}
