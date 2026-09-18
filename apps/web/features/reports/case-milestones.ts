/**
 * Every point in a case's lifecycle that's actually timestamped on the case row itself
 * (packages/database/prisma/schema.prisma's MedicalCase), in the order they normally occur — used
 * to build the turnaround report's "from"/"to" pickers. Order matters here: it's what lets the "to"
 * picker only offer milestones at or after whichever one is picked as "from", so a person can't
 * accidentally ask for a turnaround that runs backwards (e.g. payment confirmed → case created).
 * Not every case passes through every one of these (a case created with a doctor pre-selected
 * skips patientSubmittedAt entirely, for instance) — a case missing either endpoint for whatever
 * pair is selected is simply left out of the report, not shown with a bogus/negative duration.
 */
export const CASE_MILESTONES = [
  { key: 'createdAt', label: 'Case created' },
  { key: 'patientSubmittedAt', label: 'Patient submitted' },
  { key: 'assignedAt', label: 'Case reached doctor' },
  { key: 'doctorSubmittedAt', label: 'Doctor submitted' },
  { key: 'reviewedAt', label: 'HR reviewed' },
  { key: 'paymentConfirmedAt', label: 'Payment confirmed' }
] as const;

export type CaseMilestoneKey = (typeof CASE_MILESTONES)[number]['key'];

export function isCaseMilestoneKey(value: string): value is CaseMilestoneKey {
  return CASE_MILESTONES.some((milestone) => milestone.key === value);
}

export function milestoneLabel(key: CaseMilestoneKey): string {
  return CASE_MILESTONES.find((milestone) => milestone.key === key)?.label ?? key;
}

function milestoneIndex(key: CaseMilestoneKey): number {
  return CASE_MILESTONES.findIndex((milestone) => milestone.key === key);
}

/** Every milestone at or after `from` in the canonical lifecycle order — what the "to" picker offers once "from" is chosen. */
export function milestonesFrom(from: CaseMilestoneKey): typeof CASE_MILESTONES[number][] {
  const start = milestoneIndex(from);
  return CASE_MILESTONES.filter((_, index) => index >= start);
}
