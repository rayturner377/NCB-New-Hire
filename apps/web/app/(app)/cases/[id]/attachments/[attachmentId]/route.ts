import { NextResponse } from 'next/server';
import { listCandidatesForUser } from '../../../../../../features/candidates/services/candidates-service';
import { getCaseAttachmentFile } from '../../../../../../features/cases/services/case-attachments-service';
import { getCaseById } from '../../../../../../features/cases/services/cases-service';
import { getSession } from '../../../../../../lib/session';

/**
 * Streams a case attachment (a doctor's stamped assessment copy, today the
 * only thing this feature produces) back for viewing/downloading — a plain
 * server action can't hand back a raw byte stream the way a real
 * navigable URL can, so this is a Route Handler instead. Same viewer rules
 * as the case workspace itself (case-detail-container.tsx): broad staff
 * visibility, a clinician restricted to a case actually assigned to them, a
 * patient restricted to their own case.
 */
export async function GET(_request: Request, { params }: { params: { id: string; attachmentId: string } }) {
  const session = await getSession();
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const medicalCase = await getCaseById(params.id);
  if (!medicalCase) {
    return new NextResponse('Not found', { status: 404 });
  }

  if (session.user.role === 'clinician' && medicalCase.assignedClinicianId !== session.user.id) {
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
