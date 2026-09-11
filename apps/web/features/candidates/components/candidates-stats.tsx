import { CalendarPlus, FileX2, KeyRound, Users } from 'lucide-react';
import { StatCard } from '../../../components/dashboard/stat-card';
import type { CandidatePayload } from '../types';
import type { CandidateCaseSummary } from './candidates-table';

export interface CandidatesStatsProps {
  candidates: CandidatePayload[];
  casesByPatientId: Record<string, CandidateCaseSummary[]>;
}

function isSameMonth(date: Date, reference: Date): boolean {
  return date.getUTCFullYear() === reference.getUTCFullYear() && date.getUTCMonth() === reference.getUTCMonth();
}

/** Real counts over whatever candidate list the container already loaded (scoped per role — see candidates-container.tsx). */
export function CandidatesStats({ candidates, casesByPatientId }: CandidatesStatsProps) {
  const now = new Date();
  const newThisMonth = candidates.filter((candidate) => isSameMonth(new Date(candidate.createdAt), now)).length;
  const portalAccessGranted = candidates.filter((candidate) => Boolean(candidate.linkedUserId)).length;
  const noMedicalsYet = candidates.filter((candidate) => !casesByPatientId[candidate.id]?.length).length;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Total candidates" value={candidates.length} icon={Users} />
      <StatCard label="New this month" value={newThisMonth} icon={CalendarPlus} />
      <StatCard label="Portal access granted" value={portalAccessGranted} icon={KeyRound} />
      <StatCard label="No medicals yet" value={noMedicalsYet} icon={FileX2} />
    </div>
  );
}
