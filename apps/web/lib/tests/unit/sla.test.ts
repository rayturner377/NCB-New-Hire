import { describe, expect, it } from 'vitest';
import { reviewQueueSlaStatus, slaRowClassName } from '../../sla';

describe('reviewQueueSlaStatus', () => {
  it('is "On track" at 2 days or fewer', () => {
    expect(reviewQueueSlaStatus(2)).toEqual({ label: 'On track', tone: 'success' });
  });

  it('is "At risk" between 3 and 5 days', () => {
    expect(reviewQueueSlaStatus(5)).toEqual({ label: 'At risk', tone: 'warning' });
  });

  it('is "Overdue" past 5 days', () => {
    expect(reviewQueueSlaStatus(6)).toEqual({ label: 'Overdue', tone: 'destructive' });
  });
});

describe('slaRowClassName', () => {
  it('is blank for success so on-track rows stay visually quiet', () => {
    expect(slaRowClassName('success')).toBeUndefined();
  });

  it('tints warning and destructive rows', () => {
    expect(slaRowClassName('warning')).toContain('amber');
    expect(slaRowClassName('destructive')).toContain('destructive');
  });
});
