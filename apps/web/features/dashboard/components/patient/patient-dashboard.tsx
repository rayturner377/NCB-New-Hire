import Link from 'next/link';
import { StatCard } from '../../../../components/dashboard/stat-card';
import { SectionCard } from '../../../../components/dashboard/section-card';
import { Button } from '../../../../components/ui/button';
import { statusLabel } from '../../../../lib/status-labels';
import { isCaseClosed } from '../../../cases/types';
import type { PatientCaseRow, PatientDashboardData } from '../../services/patient/patient-dashboard-service';
import { PatientMedicalTable } from './patient-medical-table';

export interface PatientDashboardProps {
  data: PatientDashboardData;
}

/** No `patientCaseData` saved yet means the patient has never opened/started this case — used to tell "Open" from "Continue". */
function hasStarted(row: PatientCaseRow): boolean {
  return Boolean(row.payload?.patientCaseData);
}

/**
 * Ported from server.js renderMyMedicalRows (public/app.js ~L9288-9326): an
 * action panel for cases needing the patient's attention, then case history.
 * A patient normally only ever has the one pre-employment medical (a
 * candidate starting a second one of their own isn't supported yet), so:
 * - A case still at `sent_to_patient` lives in "Action required" only —
 *   there's nothing to "review" yet, so it doesn't also show up in history.
 * - Once submitted, it moves into "Medical case history" instead, even if
 *   it's the only case the patient has ever had — that's where they go to
 *   review what they filled in (read-only, via the same intake form).
 * - No cases at all gets its own plain empty state rather than stat cards
 *   for all-zero numbers.
 */
export function PatientDashboard({ data }: PatientDashboardProps) {
  const { cases } = data;

  if (cases.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold">My Medicals</h1>
        <div className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed p-12 text-center">
          <p className="text-sm font-medium">Nothing here yet</p>
          <p className="text-sm text-muted-foreground">You don&apos;t have a medical case yet. Once one is assigned to you, it&apos;ll show up here.</p>
        </div>
      </div>
    );
  }

  const actionCases = cases.filter((c) => c.status === 'sent_to_patient');
  const historyCases = cases.filter((c) => c.status !== 'sent_to_patient');
  const active = cases.filter((c) => !isCaseClosed(c.status)).length;
  const completed = cases.filter((c) => c.status === 'reviewed').length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">My Medicals</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Active medicals" value={active} />
        <StatCard label="Awaiting your action" value={actionCases.length} />
        <StatCard label="Completed" value={completed} />
      </div>

      {actionCases.length > 0 ? (
        <SectionCard title="Action required">
          <ul className="flex flex-col divide-y divide-border">
            {actionCases.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-4 py-2">
                <span className="flex flex-col">
                  <span className="text-sm font-medium">Pre-employment medical</span>
                  <span className="text-xs text-muted-foreground">{statusLabel(row.status)}</span>
                </span>
                <Button size="sm" asChild>
                  <Link href={`/cases/${row.id}`}>{hasStarted(row) ? 'Continue medical case' : 'Open medical case'}</Link>
                </Button>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {historyCases.length > 0 ? (
        <SectionCard title="Medical case history" description={`${historyCases.length} case${historyCases.length === 1 ? '' : 's'} on file`}>
          <PatientMedicalTable cases={historyCases} />
        </SectionCard>
      ) : null}
    </div>
  );
}
