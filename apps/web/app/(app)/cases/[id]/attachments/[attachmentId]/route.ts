import { NextResponse } from 'next/server';
import { auditRepository } from '@ncb/database';
import { listCandidatesForUser } from '../../../../../../features/candidates/services/candidates-service';
import { matchesClinicianAssignment } from '../../../../../../features/cases/case-authorization';
import { getCaseAttachmentFile } from '../../../../../../features/cases/services/case-attachments-service';
import { getCaseById } from '../../../../../../features/cases/services/cases-service';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../../../../lib/permissions';
import { requireFullSession } from '../../../../../../lib/session';

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
  if (!matchesClinicianAssignment(session.user, medicalCase)) {
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

  // Deliberately unconditional — not gated on whether a scanner is actually configured (see
  // lib/virus-scan.ts). A prior version relaxed this gate whenever scanning was off, on the
  // reasoning that leaving it on would permanently restrict every attachment to its uploader with
  // no scanner ever wired in; the user overrode that tradeoff explicitly, choosing to fail closed
  // instead — an unverified file simply never reaches anyone but its uploader (or an admin, for a
  // known-bad one), full stop, whether or not this deployment has gotten around to configuring a
  // scanner yet. `scanStatus` starts at 'pending' and stays there until scanBuffer() actually
  // reports 'clean', so with no scanner configured this route is uploader-only indefinitely — that
  // is the accepted, intended consequence of this choice, not a bug.
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
