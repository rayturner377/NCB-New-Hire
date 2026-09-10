import type { SlaDefinition } from '../settings/types';
import type { SlaEventKey } from '../settings/sla-events';

export type SlaStageStatus = 'on_track' | 'at_risk' | 'breached' | 'met' | 'not_applicable';

export interface SlaStageResult {
  key: string;
  label: string;
  targetHours: number;
  elapsedHours: number;
  status: SlaStageStatus;
}

/** The subset of a case's real timestamps an SLA policy can start or end against — see settings/sla-events.ts's SLA_EVENT_POINTS, which this must stay in sync with. */
export interface SlaCaseInput {
  createdAt: Date;
  assignedAt: Date | null;
  doctorSubmittedAt: Date | null;
  reviewedAt: Date | null;
  paymentConfirmedAt: Date | null;
}

function hoursBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

function eventTimestamp(medicalCase: SlaCaseInput, event: SlaEventKey): Date | null {
  switch (event) {
    case 'case_created':
      return medicalCase.createdAt;
    case 'assigned':
      return medicalCase.assignedAt;
    case 'doctor_submitted':
      return medicalCase.doctorSubmittedAt;
    case 'hr_reviewed':
      return medicalCase.reviewedAt;
    case 'payment_confirmed':
      return medicalCase.paymentConfirmedAt;
  }
}

/**
 * Evaluates every enabled SLA policy (Settings → SLA, see settings/types.ts's
 * SlaDefinition) against a case's real milestone timestamps:
 *  - `not_applicable` when the policy's start milestone hasn't happened yet
 *    (there's nothing to clock).
 *  - Still running (end milestone hasn't happened): `on_track` while under
 *    `warningPercent` of the target, `at_risk` once past it, `breached` once
 *    past 100%.
 *  - Finished (end milestone happened): `met` or `breached` depending on how
 *    long it actually took.
 */
export function computeSlaStatus(medicalCase: SlaCaseInput, definitions: SlaDefinition[], now: Date = new Date()): SlaStageResult[] {
  const results: SlaStageResult[] = [];

  for (const definition of definitions) {
    if (!definition.enabled) continue;

    const start = eventTimestamp(medicalCase, definition.startEvent);
    if (!start) {
      results.push({ key: definition.key, label: definition.name, targetHours: definition.targetHours, elapsedHours: 0, status: 'not_applicable' });
      continue;
    }

    const end = eventTimestamp(medicalCase, definition.endEvent);
    const elapsedHours = hoursBetween(start, end ?? now);
    const warningHours = definition.targetHours * (definition.warningPercent / 100);

    let status: SlaStageStatus;
    if (end) {
      status = elapsedHours <= definition.targetHours ? 'met' : 'breached';
    } else if (elapsedHours > definition.targetHours) {
      status = 'breached';
    } else if (elapsedHours >= warningHours) {
      status = 'at_risk';
    } else {
      status = 'on_track';
    }

    results.push({ key: definition.key, label: definition.name, targetHours: definition.targetHours, elapsedHours, status });
  }

  return results;
}

/** Worst status across every applicable stage — breached > at_risk > on_track > met > not_applicable — for a single summary badge (the cases list column, the overview tab). */
export function overallSlaStatus(stages: SlaStageResult[]): SlaStageStatus {
  const applicable = stages.filter((stage) => stage.status !== 'not_applicable');
  if (applicable.length === 0) return 'not_applicable';
  if (applicable.some((stage) => stage.status === 'breached')) return 'breached';
  if (applicable.some((stage) => stage.status === 'at_risk')) return 'at_risk';
  if (applicable.some((stage) => stage.status === 'on_track')) return 'on_track';
  return 'met';
}
