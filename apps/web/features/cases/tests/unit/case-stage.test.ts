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
    ['canceled_by_doctor', 'Closed'],
    ['withdrawn', 'Closed'],
    ['archived', 'Closed']
  ])('labels %s as %s regardless of payment status', (status, expected) => {
    expect(caseStageLabel(status, null)).toBe(expected);
    expect(caseStageLabel(status, 'paid')).toBe(expected);
  });

  it('labels a reviewed, unpaid case as "Unpaid" rather than a flat "Completed"', () => {
    expect(caseStageLabel('reviewed', 'unpaid')).toBe('Unpaid');
    expect(caseStageLabel('reviewed', null)).toBe('Unpaid');
  });

  it('labels a reviewed, paid case as "Paid"', () => {
    expect(caseStageLabel('reviewed', 'paid')).toBe('Paid');
  });

  it('labels a reviewed case explicitly marked not payable', () => {
    expect(caseStageLabel('reviewed', 'not_payable')).toBe('Not payable');
  });

  it('falls back to the raw value for an unknown status', () => {
    expect(caseStageLabel('mystery_status', null)).toBe('mystery_status');
  });
});
