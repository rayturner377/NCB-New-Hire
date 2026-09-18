import { describe, expect, it } from 'vitest';
import { CASE_MILESTONES, isCaseMilestoneKey, milestoneLabel, milestonesFrom } from '../../case-milestones';

describe('isCaseMilestoneKey', () => {
  it('accepts every real milestone key', () => {
    for (const milestone of CASE_MILESTONES) {
      expect(isCaseMilestoneKey(milestone.key)).toBe(true);
    }
  });

  it('rejects an arbitrary string', () => {
    expect(isCaseMilestoneKey('somethingElse')).toBe(false);
  });
});

describe('milestoneLabel', () => {
  it('resolves a known key to its human label', () => {
    expect(milestoneLabel('doctorSubmittedAt')).toBe('Doctor submitted');
  });
});

describe('milestonesFrom', () => {
  it('includes the given milestone itself and everything after it', () => {
    expect(milestonesFrom('assignedAt').map((m) => m.key)).toEqual([
      'assignedAt',
      'doctorSubmittedAt',
      'reviewedAt',
      'paymentConfirmedAt'
    ]);
  });

  it('returns every milestone when starting from the first one', () => {
    expect(milestonesFrom('createdAt')).toHaveLength(CASE_MILESTONES.length);
  });

  it('returns only the last milestone when starting from it', () => {
    expect(milestonesFrom('paymentConfirmedAt').map((m) => m.key)).toEqual(['paymentConfirmedAt']);
  });
});
