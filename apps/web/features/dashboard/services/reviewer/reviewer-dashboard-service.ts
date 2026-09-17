import { auditRepository } from '@ncb/database';
import { eventLabel } from '../../../../lib/audit-event-labels';
import { roleLabel } from '../../../../lib/role-labels';
import { LIST_PATH_BY_ROLE } from '../../../../lib/role-list-paths';
import { derivedPaymentStatus } from '../../../cases/billing-status';
import { hasDoctorSubmitted, listCasesWithPatient, REVIEW_QUEUE_STATUSES } from '../../../cases/services/cases-service';
import { isCancelledCase } from '../../../cases/types';
import { listUsers } from '../../../users/services/users-service';

export interface ReviewerDashboardCounts {
  openCases: number;
  awaitingPatient: number;
  withDoctor: number;
  hrReview: number;
}

export interface ReviewerPeriodCounts {
  created: number;
  completed: number;
  averageTurnaroundDays: number;
}

export interface ReviewerOutstandingBilling {
  count: number;
  amount: number;
}

export interface ReviewQueuePreviewRow {
  id: string;
  patientName: string;
  employeeId: string;
  positionAppliedFor: string;
  assignedClinicianName: string;
  status: string;
  doctorSubmittedAt: string;
}

export interface RecentUpdateRow {
  id: string;
  action: string;
  actorName: string;
  actorRole: string;
  occurredAt: string;
  href: string;
  impactedLabel: string;
  impactedKind: string;
}

export interface ReviewerDashboardData {
  counts: ReviewerDashboardCounts;
  period: ReviewerPeriodCounts;
  billing: ReviewerOutstandingBilling;
  queueRows: ReviewQueuePreviewRow[];
  recentUpdates: RecentUpdateRow[];
}

/**
 * Statuses that mean a case is off the reviewer's plate entirely — deliberately narrower than
 * isCaseClosed (types.ts): a reviewed-but-unpaid case still counts toward "Open cases" below since
 * it still has work left (see cases-service.ts's listReviewQueueCases).
 */
const CLOSED_FOR_QUEUE_STATUSES = new Set(['archived', 'withdrawn', 'canceled_by_doctor']);

/** Case- and user-lifecycle events surfaced in the dashboard's "Recent updates" feed — deliberately excludes login/logout/access-denied noise, which is session activity rather than a change to a case or account (the full /audit log still shows all of it). */
const RECENT_UPDATE_EVENT_TYPES = new Set([
  'case_created',
  'case_transition',
  'case_reassigned',
  'case_payment_confirmed',
  'case_hidden',
  'case_unhidden',
  'user_created',
  'user_deleted',
  'user_activated',
  'user_deactivated',
  'user_password_reset',
  'settings_updated'
]);

function daysBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
}

function withinRange(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end;
}

/**
 * Real replacement for features/dashboard/mock-data.ts's mockCounts/
 * mockPeriodCounts/mockOutstandingBilling/mockOldestQueueRows/
 * mockRecentUpdates — same shapes the reviewer/admin dashboard components
 * already render, just sourced from the actual cases/audit tables instead of
 * a fixed placeholder dataset. `from`/`to` are inclusive "YYYY-MM-DD" strings
 * straight from the dashboard's date-range filter.
 */
export async function getReviewerDashboardData(from: string, to: string): Promise<ReviewerDashboardData> {
  const [cases, allUsers, auditEvents] = await Promise.all([
    listCasesWithPatient(),
    listUsers(),
    auditRepository.list(50)
  ]);

  const usersById = new Map(allUsers.map((user) => [user.id, user]));

  const openCases = cases.filter((item) => !CLOSED_FOR_QUEUE_STATUSES.has(item.status)).length;
  const awaitingPatient = cases.filter((item) => item.status === 'sent_to_patient').length;
  const withDoctor = cases.filter((item) => item.status === 'sent_to_doctor').length;
  const hrReview = cases.filter((item) => item.status === 'doctor_submitted').length;

  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T23:59:59.999Z`);
  const created = cases.filter((item) => withinRange(item.createdAt, start, end)).length;
  const completedCases = cases.filter((item) => item.status === 'reviewed' && item.reviewedAt && withinRange(item.reviewedAt, start, end));
  const averageTurnaroundDays = completedCases.length
    ? completedCases.reduce((total, item) => total + daysBetween(item.createdAt, item.reviewedAt!), 0) / completedCases.length
    : 0;

  const unpaidCases = cases.filter(
    (item) => hasDoctorSubmitted(item.status) && !isCancelledCase(item.status) && derivedPaymentStatus(item.status, item.paymentStatus) === 'unpaid'
  );
  const billing: ReviewerOutstandingBilling = {
    count: unpaidCases.length,
    amount: unpaidCases.reduce((total, item) => total + Number(item.payableAmount ?? 0), 0)
  };

  // Same membership rule as listReviewQueueCases, applied directly against the
  // list already fetched above rather than a second full decrypt pass.
  const queueCases = cases.filter(
    (item) => (REVIEW_QUEUE_STATUSES as readonly string[]).includes(item.status) && item.paymentStatus !== 'paid'
  );
  const queueRows: ReviewQueuePreviewRow[] = [...queueCases]
    .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      patientName: item.patient.fullName,
      employeeId: item.patient.employeeId ?? '',
      positionAppliedFor: item.payload?.positionAppliedFor ?? '',
      assignedClinicianName: item.assignedClinicianId ? usersById.get(item.assignedClinicianId)?.displayName ?? 'Unknown doctor' : 'Unassigned',
      status: item.status,
      doctorSubmittedAt: (item.doctorSubmittedAt ?? item.updatedAt).toISOString()
    }));

  const casesById = new Map(cases.map((item) => [item.id, item]));
  const recentUpdates: RecentUpdateRow[] = auditEvents
    .filter((event) => RECENT_UPDATE_EVENT_TYPES.has(event.eventType))
    // A case-related event whose case is no longer in listCasesWithPatient() (e.g. it referenced
    // an id this snapshot doesn't have) has nothing useful to show — drop it rather than render a
    // dead-end row, same as the old entityType==='case' filter used to do implicitly.
    .filter((event) => event.entityType !== 'case' || (event.entityId && casesById.has(event.entityId)))
    .slice(0, 5)
    .map((event) => {
      const actor = event.actorUserId ? usersById.get(event.actorUserId) : undefined;
      const actorName = event.actorUserId ? actor?.displayName ?? 'Unknown user' : 'System';
      const actorRole = event.actorUserId ? roleLabel(actor?.role ?? '') : '—';
      const base = {
        id: String(event.id),
        action: eventLabel(event.eventType),
        actorName,
        actorRole,
        occurredAt: event.occurredAt.toISOString()
      };

      if (event.entityType === 'case' && event.entityId) {
        const relatedCase = casesById.get(event.entityId)!;
        return { ...base, href: `/cases/${relatedCase.id}`, impactedLabel: relatedCase.patient.fullName, impactedKind: 'Patient case' };
      }

      if (event.entityType === 'user' && event.entityId) {
        const targetUser = usersById.get(event.entityId);
        const details = event.details as { displayName?: string; role?: string } | null;
        return {
          ...base,
          href: LIST_PATH_BY_ROLE[targetUser?.role ?? details?.role ?? ''] ?? '/users',
          impactedLabel: targetUser?.displayName ?? details?.displayName ?? 'Unknown user',
          impactedKind: 'User account'
        };
      }

      if (event.entityType === 'settings') {
        return { ...base, href: '/settings', impactedLabel: 'Settings', impactedKind: 'System settings' };
      }

      return { ...base, href: '/cases', impactedLabel: '—', impactedKind: '—' };
    });

  return {
    counts: { openCases, awaitingPatient, withDoctor, hrReview },
    period: { created, completed: completedCases.length, averageTurnaroundDays },
    billing,
    queueRows,
    recentUpdates
  };
}
