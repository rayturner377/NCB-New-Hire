import { Plus } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { CandidateSearchFilters } from '@ncb/database';
import { SectionCard } from '../../../components/dashboard/section-card';
import { Button } from '../../../components/ui/button';
import { derivedPaymentStatus } from '../../cases/billing-status';
import { listCasesForPatient, listCasesForPatients } from '../../cases/services/cases-service';
import { logAccessDenied } from '../../../lib/audit-access';
import { parsePageNumber } from '../../../lib/pagination';
import { PERMISSIONS, hasPermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { CandidatesStats } from '../components/candidates-stats';
import { CandidatesTable, type CandidateCaseSummary } from '../components/candidates-table';
import type { CandidateListRow } from '../services/candidates-service';
import { getCandidateStats, listCandidatePositions, listCandidatesForUser, searchCandidates } from '../services/candidates-service';

const PAGE_SIZE = 8;

export interface CandidatesContainerProps {
  searchParams?: { query?: string; position?: string; stage?: string; billing?: string; page?: string };
}

function buildCasesByPatientId(cases: Awaited<ReturnType<typeof listCasesForPatients>>): Record<string, CandidateCaseSummary[]> {
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
  // Case numbers ("Case #1", "Case #2"...) reflect creation order, not display order — assigned
  // once here so they stay stable regardless of how the table sorts/filters.
  for (const list of Object.values(casesByPatientId)) {
    list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    list.forEach((item, index) => {
      item.caseNumber = index + 1;
    });
  }
  return casesByPatientId;
}

/**
 * Real data throughout — the earlier wireframe pass (MOCK_CANDIDATES) is
 * gone. Query/status/position/stage/billing filtering and pagination happen
 * server-side for the staff view (see searchCandidates) — only the current
 * page's candidates get decrypted, and cases are fetched separately, scoped
 * to just that page's candidates, not every case in the system.
 *
 * A patient's own view stays a small, bounded, entirely-in-memory filter
 * over their own candidate record(s) (usually exactly one) — the same
 * client-side predicate this whole page used to run over every candidate in
 * the system, just now scoped to a set that was always tiny to begin with,
 * so there's no scaling concern here to fix.
 */
export async function CandidatesContainer({ searchParams = {} }: CandidatesContainerProps) {
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
  const isPatient = session.user.role === 'patient';

  const query = searchParams.query?.trim() ?? '';
  const position = searchParams.position ?? '';
  const stage = searchParams.stage ?? '';
  const billing = searchParams.billing ?? '';
  const requestedPage = parsePageNumber(searchParams.page);

  function buildHref(next: { query: string; position: string; stage: string; billing: string; page: number }): string {
    const params = new URLSearchParams();
    if (next.query) params.set('query', next.query);
    if (next.position) params.set('position', next.position);
    if (next.stage) params.set('stage', next.stage);
    if (next.billing) params.set('billing', next.billing);
    if (next.page > 1) params.set('page', String(next.page));
    const qs = params.toString();
    return qs ? `/candidates?${qs}` : '/candidates';
  }

  let candidates: CandidateListRow[];
  let total: number;
  let casesByPatientId: Record<string, CandidateCaseSummary[]>;

  if (isPatient) {
    const own = await listCandidatesForUser(session.user.id);
    const cases = (await Promise.all(own.map((candidate) => listCasesForPatient(candidate.id)))).flat();
    casesByPatientId = buildCasesByPatientId(cases);

    const filtered = own.filter((candidate) => {
      const candidateCases = casesByPatientId[candidate.id] ?? [];
      const matchesQuery = !query || candidate.fullName.toLowerCase().includes(query.toLowerCase());
      const matchesPosition = !position || candidate.position === position;
      const matchesStage = !stage || candidateCases.some((c) => c.status === stage);
      const matchesBilling = !billing || candidateCases.some((c) => derivedPaymentStatus(c.status, c.paymentStatus) === billing);
      return matchesQuery && matchesPosition && matchesStage && matchesBilling;
    });
    total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (requestedPage > totalPages) {
      redirect(buildHref({ query, position, stage, billing, page: totalPages }));
    }
    candidates = filtered
      .slice((requestedPage - 1) * PAGE_SIZE, requestedPage * PAGE_SIZE)
      .map((candidate) => ({ ...candidate, caseCount: casesByPatientId[candidate.id]?.length ?? 0 }));
  } else {
    const filters: CandidateSearchFilters = {
      query,
      position,
      caseStage: stage,
      caseBilling: billing as CandidateSearchFilters['caseBilling']
    };
    const result = await searchCandidates(filters, requestedPage, PAGE_SIZE);
    candidates = result.rows;
    total = result.total;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // Corrects the URL itself rather than showing 0 rows from the out-of-range page under a
    // "Page N of M" label that implies real rows exist there.
    if (requestedPage > totalPages) {
      redirect(buildHref({ query, position, stage, billing, page: totalPages }));
    }

    // Queried scoped to just this page's candidates via SQL IN (listCasesForPatients), not
    // fetched-and-decrypted for every case in the system and filtered afterward.
    const cases = await listCasesForPatients(candidates.map((candidate) => candidate.id));
    casesByPatientId = buildCasesByPatientId(cases);
  }

  const stats = await getCandidateStats(isPatient ? session.user.id : undefined);
  const positions = await listCandidatePositions();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6 p-6">
      <CandidatesStats
        total={stats.total}
        newThisMonth={stats.newThisMonth}
        portalAccessGranted={stats.portalAccessGranted}
        noMedicalsYet={stats.noMedicalsYet}
      />

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
        <CandidatesTable
          candidates={candidates}
          casesByPatientId={casesByPatientId}
          canUpdate={canUpdate}
          positions={positions}
          query={query}
          position={position}
          stage={stage}
          billing={billing}
          page={requestedPage}
          totalPages={totalPages}
          buildHref={buildHref}
        />
      </SectionCard>
    </div>
  );
}
