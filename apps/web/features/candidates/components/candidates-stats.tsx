import { CalendarPlus, FileX2, KeyRound, Users } from 'lucide-react';
import { StatCard } from '../../../components/dashboard/stat-card';

export interface CandidatesStatsProps {
  total: number;
  newThisMonth: number;
  portalAccessGranted: number;
  noMedicalsYet: number;
}

/** Real counts from the database (see getCandidateStats), scoped per role the same way the row list is — independent of whichever page of the list is currently showing. */
export function CandidatesStats({ total, newThisMonth, portalAccessGranted, noMedicalsYet }: CandidatesStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Total candidates" value={total} icon={Users} />
      <StatCard label="New this month" value={newThisMonth} icon={CalendarPlus} />
      <StatCard label="Portal access granted" value={portalAccessGranted} icon={KeyRound} />
      <StatCard label="No medicals yet" value={noMedicalsYet} icon={FileX2} />
    </div>
  );
}
