/**
 * Status vocabulary ported from server.js's CASE_STATUSES (~L295-306) plus the
 * payment/review status strings used throughout (payment_status column check
 * constraint in packages/database's schema; review status values from
 * README.md's "pending, reviewed, needs follow-up, archived").
 */
export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger';

interface StatusInfo {
  label: string;
  tone: StatusTone;
}

const STATUS_INFO: Record<string, StatusInfo> = {
  draft: { label: 'Draft', tone: 'neutral' },
  sent_to_patient: { label: 'Sent to patient', tone: 'neutral' },
  patient_completed: { label: 'Patient completed', tone: 'neutral' },
  sent_to_doctor: { label: 'Sent to doctor', tone: 'neutral' },
  doctor_submitted: { label: 'Doctor submitted', tone: 'warning' },
  canceled_by_doctor: { label: 'Canceled by doctor', tone: 'danger' },
  review_pending: { label: 'Review pending', tone: 'warning' },
  reviewed: { label: 'Reviewed', tone: 'success' },
  archived: { label: 'Archived', tone: 'neutral' },
  withdrawn: { label: 'Withdrawn', tone: 'danger' },
  pending: { label: 'Pending', tone: 'warning' },
  needs_follow_up: { label: 'Needs follow-up', tone: 'warning' },
  unpaid: { label: 'Unpaid', tone: 'warning' },
  paid: { label: 'Paid', tone: 'success' },
  not_payable: { label: 'Not payable', tone: 'neutral' },
  active: { label: 'Active', tone: 'success' },
  inactive: { label: 'Inactive', tone: 'danger' }
};

function toTitleCase(value: string): string {
  return value
    .split('_')
    .map((word) => (word ? word[0]!.toUpperCase() + word.slice(1) : word))
    .join(' ');
}

export function statusLabel(status: string): string {
  return STATUS_INFO[status]?.label ?? toTitleCase(status);
}

export function statusTone(status: string): StatusTone {
  return STATUS_INFO[status]?.tone ?? 'neutral';
}
