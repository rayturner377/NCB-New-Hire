import { Briefcase, Building2, CheckCircle2, ClipboardCheck, Clock, DollarSign, FilePlus, Timer } from 'lucide-react';
import { DateRangeFilter } from '../../../../components/dashboard/date-range-filter';
import { StatCard } from '../../../../components/dashboard/stat-card';
import { formatCurrency } from '../../../../lib/currency';
import { getReviewerDashboardData } from '../../services/reviewer/reviewer-dashboard-service';
import { RecentUpdatesPanel } from './recent-updates-panel';
import { ReviewQueuePreviewPanel } from './review-queue-preview-panel';

export interface ReviewerDashboardProps {
  from: string;
  to: string;
}

function formatRange(from: string, to: string): string {
  const format = (value: string) =>
    new Date(`${value}T00:00:00.000Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return `${format(from)} – ${format(to)}`;
}

/**
 * Ported from server.js renderHrDashboard (public/app.js ~L2004-2073), plus a
 * date-range filter and four metrics that didn't exist in the old app
 * (cases created/completed, average turnaround, outstanding billing). Data
 * comes from reviewer-dashboard-service.ts — real queries against the cases/
 * audit tables.
 */
export async function ReviewerDashboard({ from, to }: ReviewerDashboardProps) {
  const { counts, period, billing, queueRows, recentUpdates } = await getReviewerDashboardData(from, to);
  const rangeLabel = formatRange(from, to);
  const snapshotLabel = `Snapshot as of ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div className="flex flex-col gap-6">
      <DateRangeFilter from={from} to={to} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Period metrics — recompute from the date range above. */}
        <StatCard label="Cases created" value={period.created} description={rangeLabel} icon={FilePlus} />
        {/* "Reviewed" — HR has signed off (status reviewed), not that the doctor's been paid; see billing's own Outstanding billing card below for that. */}
        <StatCard label="Cases reviewed" value={period.completed} description={rangeLabel} icon={CheckCircle2} />
        <StatCard
          label="Avg. completion time"
          value={`${period.averageTurnaroundDays.toFixed(1)}d`}
          description={rangeLabel}
          icon={Timer}
        />
        <StatCard label="HR review" value={counts.hrReview} description={snapshotLabel} href="/cases" icon={ClipboardCheck} />

        {/* Snapshot metrics — current state, unaffected by the date range. */}
        <StatCard label="Open cases" value={counts.openCases} description={snapshotLabel} href="/cases" icon={Briefcase} />
        <StatCard label="With patient" value={counts.awaitingPatient} description={snapshotLabel} href="/cases" icon={Clock} />
        <StatCard label="With medical office" value={counts.withDoctor} description={snapshotLabel} href="/cases" icon={Building2} />
        <StatCard
          label="Outstanding billing"
          value={formatCurrency(billing.amount)}
          description={`${billing.count} unpaid case${billing.count === 1 ? '' : 's'}`}
          icon={DollarSign}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ReviewQueuePreviewPanel rows={queueRows} />
        <RecentUpdatesPanel events={recentUpdates} />
      </div>
    </div>
  );
}
