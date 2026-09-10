import { UserCheck, UserX, Users } from 'lucide-react';
import { StatCard } from '../../../components/dashboard/stat-card';
import type { UserSummary } from '../types';

export interface UserStatsProps {
  users: UserSummary[];
  /** Plural label for this role, e.g. "Doctors". */
  label: string;
}

/** Real counts (not mock data) over whatever role-filtered list the caller already loaded. */
export function UserStats({ users, label }: UserStatsProps) {
  const total = users.length;
  const active = users.filter((user) => user.active).length;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      <StatCard label={`Total ${label.toLowerCase()}`} value={total} icon={Users} />
      <StatCard label="Active" value={active} icon={UserCheck} />
      <StatCard label="Inactive" value={total - active} icon={UserX} />
    </div>
  );
}
