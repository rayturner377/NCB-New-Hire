import { describe, expect, it } from 'vitest';
import { caseRouteLabel, caseStageLabel } from '../../case-stage';

describe('caseRouteLabel', () => {
  it('labels the patient-first route', () => {
    expect(caseRouteLabel('patient')).toBe('Sent to patient first');
  });

  it('labels the direct-to-doctor route', () => {
    expect(caseRouteLabel('doctor')).toBe('Sent directly to doctor');
  });

  it('falls back to the raw value for an unknown route', () => {
    expect(caseRouteLabel('something_else')).toBe('something_else');
  });
});

describe('caseStageLabel', () => {
  it.each([
    ['draft', 'HR creation'],
    ['sent_to_patient', 'Patient action'],
    ['patient_completed', 'Patient action'],
    ['sent_to_doctor', 'Medical office action'],
    ['review_pending', 'Medical office action'],
    ['doctor_submitted', 'HR review'],
    ['reviewed', 'Completed'],
    ['canceled_by_doctor', 'Closed'],
    ['withdrawn', 'Closed'],
    ['archived', 'Closed']
  ])('labels %s as %s', (status, expected) => {
    expect(caseStageLabel(status)).toBe(expected);
  });

  it('falls back to the raw value for an unknown status', () => {
    expect(caseStageLabel('mystery_status')).toBe('mystery_status');
  });
});
