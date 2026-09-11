import { describe, expect, it } from 'vitest';
import type { SlaDefinition } from '../../../settings/types';
import { computeSlaStatus, overallSlaStatus, type SlaCaseInput } from '../../sla';

const NOW = new Date('2026-01-10T00:00:00.000Z');

function baseCase(overrides: Partial<SlaCaseInput> = {}): SlaCaseInput {
  return {
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    assignedAt: null,
    doctorSubmittedAt: null,
    reviewedAt: null,
    paymentConfirmedAt: null,
    ...overrides
  };
}

function definition(overrides: Partial<SlaDefinition> = {}): SlaDefinition {
  return {
    key: 'test_policy',
    name: 'Test policy',
    startEvent: 'doctor_submitted',
    endEvent: 'hr_reviewed',
    targetHours: 48,
    warningPercent: 80,
    enabled: true,
    ...overrides
  };
}

describe('computeSlaStatus', () => {
  it('is not_applicable when the start milestone has not happened yet', () => {
    const [result] = computeSlaStatus(baseCase(), [definition()], NOW);
    expect(result?.status).toBe('not_applicable');
  });

  it('is on_track while running and under the warning threshold', () => {
    const medicalCase = baseCase({ doctorSubmittedAt: new Date('2026-01-09T12:00:00.000Z') });
    const [result] = computeSlaStatus(medicalCase, [definition({ targetHours: 48, warningPercent: 80 })], NOW);
    expect(result?.status).toBe('on_track');
  });

  it('is at_risk once elapsed time passes the warning threshold but before the target', () => {
    const medicalCase = baseCase({ doctorSubmittedAt: new Date('2026-01-08T05:00:00.000Z') });
    const [result] = computeSlaStatus(medicalCase, [definition({ targetHours: 48, warningPercent: 80 })], NOW);
    expect(result?.status).toBe('at_risk');
  });

  it('is breached once still running past the target', () => {
    const medicalCase = baseCase({ doctorSubmittedAt: new Date('2026-01-01T00:00:00.000Z') });
    const [result] = computeSlaStatus(medicalCase, [definition({ targetHours: 48 })], NOW);
    expect(result?.status).toBe('breached');
  });

  it('is met when it finished within the target', () => {
    const medicalCase = baseCase({
      doctorSubmittedAt: new Date('2026-01-08T00:00:00.000Z'),
      reviewedAt: new Date('2026-01-09T00:00:00.000Z')
    });
    const [result] = computeSlaStatus(medicalCase, [definition({ targetHours: 48 })], NOW);
    expect(result?.status).toBe('met');
    expect(result?.elapsedHours).toBe(24);
  });

  it('is breached when it finished past the target', () => {
    const medicalCase = baseCase({
      doctorSubmittedAt: new Date('2026-01-01T00:00:00.000Z'),
      reviewedAt: new Date('2026-01-05T00:00:00.000Z')
    });
    const [result] = computeSlaStatus(medicalCase, [definition({ targetHours: 48 })], NOW);
    expect(result?.status).toBe('breached');
  });

  it('skips disabled policies', () => {
    const results = computeSlaStatus(baseCase(), [definition({ enabled: false })], NOW);
    expect(results).toHaveLength(0);
  });

  it('measures the end-to-end assignment-to-payment policy across the whole case lifecycle', () => {
    const medicalCase = baseCase({
      assignedAt: new Date('2025-12-20T00:00:00.000Z'),
      doctorSubmittedAt: new Date('2025-12-27T00:00:00.000Z'),
      reviewedAt: new Date('2025-12-29T00:00:00.000Z'),
      paymentConfirmedAt: new Date('2026-01-02T00:00:00.000Z')
    });
    const [result] = computeSlaStatus(
      medicalCase,
      [definition({ startEvent: 'assigned', endEvent: 'payment_confirmed', targetHours: 336 })],
      NOW
    );
    expect(result?.status).toBe('met');
    expect(result?.elapsedHours).toBe(13 * 24);
  });
});

describe('overallSlaStatus', () => {
  it('is not_applicable when every stage is not_applicable', () => {
    expect(overallSlaStatus([{ key: 'a', label: 'A', targetHours: 1, elapsedHours: 0, status: 'not_applicable' }])).toBe('not_applicable');
  });

  it('prioritizes breached over at_risk and on_track', () => {
    const status = overallSlaStatus([
      { key: 'a', label: 'A', targetHours: 1, elapsedHours: 0, status: 'on_track' },
      { key: 'b', label: 'B', targetHours: 1, elapsedHours: 0, status: 'at_risk' },
      { key: 'c', label: 'C', targetHours: 1, elapsedHours: 0, status: 'breached' }
    ]);
    expect(status).toBe('breached');
  });

  it('prioritizes at_risk over on_track and met', () => {
    const status = overallSlaStatus([
      { key: 'a', label: 'A', targetHours: 1, elapsedHours: 0, status: 'met' },
      { key: 'b', label: 'B', targetHours: 1, elapsedHours: 0, status: 'at_risk' }
    ]);
    expect(status).toBe('at_risk');
  });
});
