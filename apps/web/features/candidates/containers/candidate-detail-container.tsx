import { redirect } from 'next/navigation';
import { SectionCard } from '../../../components/dashboard/section-card';
import { StatusBadge } from '../../../components/ui/status-badge';
import { logAccessDenied } from '../../../lib/audit-access';
import { PERMISSIONS, hasPermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { listCasesForPatient } from '../../cases/services/cases-service';
import { ownsCandidate } from '../candidate-authorization';
import { CandidateCaseHistory } from '../components/candidate-case-history';
import { CandidateEditForm } from '../components/candidate-edit-form';
import type { CandidateCaseSummary } from '../components/candidates-table';
import { ResetCandidatePasswordDialog } from '../components/reset-candidate-password-dialog';
import { getCandidateById } from '../services/candidates-service';

export interface CandidateDetailContainerProps {
  candidateId: string;
}

/** Candidate profile (editable) plus their medical case history — the two things HR actually needs from a candidate's own page: what's on file for them, and what's happened with their medicals so far. */
export async function CandidateDetailContainer({ candidateId }: CandidateDetailContainerProps) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  if (!hasPermission(session.user, PERMISSIONS.PATIENT_PROFILES_LIST)) {
    await logAccessDenied({
      userId: session.user.id,
      role: session.user.role,
      permission: PERMISSIONS.PATIENT_PROFILES_LIST,
      path: '/candidates',
      entityId: candidateId
    });
    redirect('/');
  }

  // PATIENT_PROFILES_LIST/UPDATE are broad "can see candidate profiles" permissions a patient
  // also holds (for their own profile) — without this, any patient could view or edit another
  // patient's full profile just by guessing/incrementing a candidate id, the same class of bug
  // fixed for /cases/[id] (see case-detail-container.tsx).
  if (!(await ownsCandidate(session.user, candidateId))) {
    await logAccessDenied({
      userId: session.user.id,
      role: session.user.role,
      permission: PERMISSIONS.PATIENT_PROFILES_LIST,
      path: '/candidates',
      entityId: candidateId
    });
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Candidate not found.</p>
      </div>
    );
  }

  const candidate = await getCandidateById(candidateId);
  if (!candidate) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Candidate not found.</p>
      </div>
    );
  }

  const cases = await listCasesForPatient(candidateId);
  const summaries: CandidateCaseSummary[] = [...cases]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((medicalCase, index) => ({
      id: medicalCase.id,
      status: medicalCase.status,
      paymentStatus: medicalCase.paymentStatus,
      positionAppliedFor: medicalCase.payload?.positionAppliedFor || '',
      createdAt: medicalCase.createdAt.toISOString(),
      assignedAt: medicalCase.assignedAt ? medicalCase.assignedAt.toISOString() : null,
      caseNumber: index + 1
    }));

  const canUpdate = hasPermission(session.user, PERMISSIONS.PATIENT_PROFILES_UPDATE);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{candidate.fullName}</h1>
          <StatusBadge status={candidate.status} />
        </div>
        <p className="text-sm text-muted-foreground">{candidate.position}</p>
      </div>

      <SectionCard title="Medical case history" description={`${summaries.length} case${summaries.length === 1 ? '' : 's'} on file`}>
        <CandidateCaseHistory cases={summaries} />
      </SectionCard>

      <SectionCard
        title="Candidate profile"
        description={canUpdate ? 'Editable — changes save immediately.' : 'View only.'}
        action={canUpdate && candidate.linkedUserId ? <ResetCandidatePasswordDialog candidateId={candidate.id} /> : undefined}
      >
        {canUpdate ? (
          <CandidateEditForm candidate={candidate} />
        ) : (
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to edit candidate profiles.</p>
        )}
      </SectionCard>
    </div>
  );
}
