import { describe, expect, it } from 'vitest';
import { formatCaseHistory } from '../../case-history';

function auditEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 1n,
    occurredAt: new Date('2026-01-15T10:00:00.000Z'),
    actorUserId: 'usr_reviewer_demo',
    eventType: 'case_transition',
    entityType: 'case',
    entityId: 'case_1',
    requestId: null,
    sourceIpHash: null,
    details: {},
    prevHash: null,
    eventHash: 'x',
    ...overrides
  };
}

describe('formatCaseHistory', () => {
  const users = new Map([
    ['usr_reviewer_demo', { displayName: 'Jane Reviewer', role: 'reviewer' }],
    ['usr_doctor_old', { displayName: 'Dr. Old', role: 'clinician' }],
    ['usr_doctor_new', { displayName: 'Dr. New', role: 'clinician' }]
  ]);

  it('describes a case_transition event with the real actor name/role and separate from/to', () => {
    const [entry] = formatCaseHistory(
      [auditEvent({ eventType: 'case_transition', details: { from: 'sent_to_doctor', to: 'doctor_submitted' } })],
      users
    );

    expect(entry?.actorName).toBe('Jane Reviewer');
    expect(entry?.actorRole).toBe('Reviewer');
    expect(entry?.eventLabel).toBe('Status change');
    expect(entry?.from).toBe('Sent to doctor');
    expect(entry?.to).toBe('Doctor submitted');
  });

  it('describes a case_reassigned event with both doctors named', () => {
    const [entry] = formatCaseHistory(
      [auditEvent({ eventType: 'case_reassigned', details: { from: 'usr_doctor_old', to: 'usr_doctor_new' } })],
      users
    );

    expect(entry?.eventLabel).toBe('Reassignment');
    expect(entry?.from).toBe('Dr. Old');
    expect(entry?.to).toBe('Dr. New');
  });

  it('falls back gracefully for an unknown actor or unset "from"', () => {
    const [entry] = formatCaseHistory(
      [auditEvent({ actorUserId: 'usr_unknown', eventType: 'case_transition', details: { to: 'sent_to_doctor' } })],
      users
    );

    expect(entry?.actorName).toBe('Unknown user');
    expect(entry?.actorRole).toBe('—');
    expect(entry?.from).toBe('the start');
    expect(entry?.to).toBe('Sent to doctor');
  });

  it('attributes a null actor to "System"', () => {
    const [entry] = formatCaseHistory([auditEvent({ actorUserId: null })], users);
    expect(entry?.actorName).toBe('System');
    expect(entry?.actorRole).toBe('—');
  });

  it('appends the reason to a case_transition\'s "to" column when one was given (a paid-case reopen)', () => {
    const [entry] = formatCaseHistory(
      [auditEvent({ eventType: 'case_transition', details: { from: 'reviewed', to: 'sent_to_doctor', reason: 'Wrong candidate name' } })],
      users
    );

    expect(entry?.to).toBe('Sent to doctor — Wrong candidate name');
  });

  it('does not append anything for an ordinary case_transition with no reason', () => {
    const [entry] = formatCaseHistory(
      [auditEvent({ eventType: 'case_transition', details: { from: 'sent_to_patient', to: 'sent_to_doctor' } })],
      users
    );

    expect(entry?.to).toBe('Sent to doctor');
  });

  it('describes a case_payment_corrected event with the new date and reason', () => {
    const [entry] = formatCaseHistory(
      [auditEvent({ eventType: 'case_payment_corrected', details: { paidOn: '2026-01-10', reason: 'Original date was a typo' } })],
      users
    );

    expect(entry?.eventLabel).toBe('Payment date corrected');
    expect(entry?.from).toBe('Paid');
    expect(entry?.to).toBe('Paid (2026-01-10) — Original date was a typo');
  });
});
