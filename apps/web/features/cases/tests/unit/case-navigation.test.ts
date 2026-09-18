import { describe, expect, it } from 'vitest';
import { caseActivityHref, resolveCaseTab } from '../../case-navigation';

describe('case activity destinations', () => {
  it.each([
    ['case_created', {}, '/cases/case_1'],
    ['case_reassigned', {}, '/cases/case_1'],
    ['case_payment_confirmed', {}, '/cases/case_1?tab=billing'],
    ['case_billing_updated', {}, '/cases/case_1?tab=billing'],
    ['case_transition', { to: 'reviewed' }, '/cases/case_1?tab=billing'],
    ['case_transition', { to: 'paid' }, '/cases/case_1?tab=billing'],
    ['case_transition', { to: 'doctor_submitted' }, '/cases/case_1?tab=doctor'],
    ['case_transition', { to: 'patient_completed' }, '/cases/case_1?tab=patient'],
    ['case_transition', { to: 'withdrawn' }, '/cases/case_1?tab=history'],
    ['case_attachment_uploaded', {}, '/cases/case_1?tab=documents'],
    ['case_attachment_deleted', {}, '/cases/case_1?tab=documents'],
    ['case_attachment_downloaded', {}, '/cases/case_1?tab=documents'],
    ['case_hidden', null, '/cases/case_1?tab=history'],
    ['case_transition', 'bad historical details', '/cases/case_1?tab=history']
  ])('%s with %j opens the relevant section', (eventType, details, expected) => {
    expect(caseActivityHref('case_1', eventType as string, details)).toBe(expected);
  });

  it('encodes IDs as path segments', () => {
    expect(caseActivityHref('case/1?other=true', 'case_created', null)).toBe('/cases/case%2F1%3Fother%3Dtrue');
  });

  it('falls back for unknown tabs and history that is not visible to this viewer', () => {
    expect(resolveCaseTab(null, true)).toBe('overview');
    expect(resolveCaseTab('invalid', true)).toBe('overview');
    expect(resolveCaseTab('history', false)).toBe('overview');
    expect(resolveCaseTab('history', true)).toBe('history');
    expect(resolveCaseTab('billing', true)).toBe('billing');
  });
});
