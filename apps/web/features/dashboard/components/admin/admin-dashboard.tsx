import { AdminShortcutsGrid } from './admin-shortcuts-grid';
import { ReviewerDashboard, type ReviewerDashboardProps } from '../reviewer/reviewer-dashboard';

/** Admin sees everything the reviewer dashboard shows, plus admin-only shortcuts. */
export function AdminDashboard({ from, to }: ReviewerDashboardProps) {
  return (
    <div className="flex flex-col gap-6">
      <ReviewerDashboard from={from} to={to} />
      <AdminShortcutsGrid />
    </div>
  );
}
