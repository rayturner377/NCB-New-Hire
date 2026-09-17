import { UserCheck, UserX, Users } from 'lucide-react';
import { StatCard } from '../../../components/dashboard/stat-card';

export interface UserStatsProps {
  total: number;
  active: number;
  /** Plural label for this role, e.g. "Doctors". */
  label: string;
}

/** Real counts (not mock data) — a role-wide total/active count from the database, independent of whichever page of the role's list is currently showing (see getUserRoleStats). */
export function UserStats({ total, active, label }: UserStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      <StatCard label={`Total ${label.toLowerCase()}`} value={total} icon={Users} />
      <StatCard label="Active" value={active} icon={UserCheck} />
      <StatCard label="Inactive" value={total - active} icon={UserX} />
    </div>
  );
}
