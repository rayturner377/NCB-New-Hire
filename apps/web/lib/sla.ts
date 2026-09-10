export type SlaTone = 'success' | 'warning' | 'destructive';

export interface SlaStatus {
  label: string;
  tone: SlaTone;
}

/** Simple day-based SLA tiers for a case sitting in the HR review queue. Thresholds are a starting point, not a policy decision. */
export function reviewQueueSlaStatus(daysWaiting: number): SlaStatus {
  if (daysWaiting <= 2) return { label: 'On track', tone: 'success' };
  if (daysWaiting <= 5) return { label: 'At risk', tone: 'warning' };
  return { label: 'Overdue', tone: 'destructive' };
}

const ROW_TINT_CLASSES: Record<SlaTone, string | undefined> = {
  success: undefined,
  warning: 'bg-amber-500/5',
  destructive: 'bg-destructive/5'
};

/** Faint full-row tint for a scannable "this needs attention" signal — deliberately blank for 'success' so on-track rows stay visually quiet. */
export function slaRowClassName(tone: SlaTone): string | undefined {
  return ROW_TINT_CLASSES[tone];
}
