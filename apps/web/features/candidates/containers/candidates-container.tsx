import { Plus } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SectionCard } from '../../../components/dashboard/section-card';
import { Button } from '../../../components/ui/button';
import { listCasesWithPatient } from '../../cases/services/cases-service';
import { logAccessDenied } from '../../../lib/audit-access';
import { PERMISSIONS, hasPermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { CandidatesStats } from '../components/candidates-stats';
import { CandidatesTable, type CandidateCaseSummary } from '../components/candidates-table';
import { listCandidates, listCandidatesForUser } from '../services/candidates-service';

/**
 * Real data throughout — the earlier wireframe pass (MOCK_CANDIDATES) is
 * gone. Cases are fetched separately (they live in their own table) and
 * grouped by patientId so the table's expand panel can show each
 * candidate's real medicals without a per-row query.
 */
export async function CandidatesContainer() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  if (!hasPermission(session.user, PERMISSIONS.PATIENT_PROFILES_LIST)) {
    await logAccessDenied({
      userId: session.user.id,
      role: session.user.role,
      permission: PERMISSIONS.PATIENT_PROFILES_LIST,
      path: '/candidates'
    });
    redirect('/');
  }

  const canCreate = hasPermission(session.user, PERMISSIONS.PATIENT_PROFILES_CREATE);
  const canUpdate = hasPermission(session.user, PERMISSIONS.PATIENT_PROFILES_UPDATE);

  // A patient holds PATIENT_PROFILES_LIST too (to see their own record), but
  // that must not mean "every candidate in the system" — scope it down to
  // just theirs, the way listCandidatesForUser is built for.
  const candidates = session.user.role === 'patient' ? await listCandidatesForUser(session.user.id) : await listCandidates();

  const cases = await listCasesWithPatient();
  const casesByPatientId: Record<string, CandidateCaseSummary[]> = {};
  for (const medicalCase of cases) {
    const list = (casesByPatientId[medicalCase.patientId] ??= []);
    list.push({
      id: medicalCase.id,
      status: medicalCase.status,
      paymentStatus: medicalCase.paymentStatus,
      positionAppliedFor: medicalCase.payload?.positionAppliedFor || '',
      createdAt: medicalCase.createdAt.toISOString(),
      assignedAt: medicalCase.assignedAt ? medicalCase.assignedAt.toISOString() : null
    });
  }
  // Case numbers ("Case #1", "Case #2"...) reflect creation order, not display order —
  // assigned once here so they stay stable regardless of how the table sorts/filters.
  for (const list of Object.values(casesByPatientId)) {
    list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    list.forEach((item, index) => {
      item.caseNumber = index + 1;
    });
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <CandidatesStats candidates={candidates} casesByPatientId={casesByPatientId} />

      {canCreate ? (
        <div className="flex justify-end">
          <Button variant="link" size="sm" className="h-auto p-0" asChild>
            <Link href="/candidates/new">
              <Plus className="mr-1.5 h-4 w-4" /> New candidate
            </Link>
          </Button>
        </div>
      ) : null}

      <SectionCard title="All candidates">
        <CandidatesTable candidates={candidates} casesByPatientId={casesByPatientId} canUpdate={canUpdate} />
      </SectionCard>
    </div>
  );
}
