import type { SlaStageStatus } from '../../features/cases/sla';

export interface SlaBadgeProps {
  status: SlaStageStatus;
}

const LABEL: Record<SlaStageStatus, string> = {
  on_track: 'On track',
  at_risk: 'At risk',
  met: 'Met SLA',
  breached: 'SLA breached',
  not_applicable: 'Not started'
};

const TONE: Record<SlaStageStatus, string> = {
  on_track: 'ui-status-badge-neutral',
  at_risk: 'ui-status-badge-warning',
  met: 'ui-status-badge-success',
  breached: 'ui-status-badge-danger',
  not_applicable: 'ui-status-badge-neutral'
};

/** Same visual language as StatusBadge — reused CSS classes from globals.css's .ui-status-badge-* set — for the SLA column on the cases list and the case detail Overview tab. */
export function SlaBadge({ status }: SlaBadgeProps) {
  return <span className={`ui-status-badge ${TONE[status]}`}>{LABEL[status]}</span>;
}
