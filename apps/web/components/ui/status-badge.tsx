import { statusLabel, statusTone } from '../../lib/status-labels';

export interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`ui-status-badge ui-status-badge-${statusTone(status)}`}>{statusLabel(status)}</span>;
}
