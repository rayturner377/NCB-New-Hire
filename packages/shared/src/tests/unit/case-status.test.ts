import { describe, expect, it } from 'vitest';
import { CANCELLED_CASE_STATUSES, isCancelledCase } from '../../case-status.js';

describe('case-status', () => {
  it('treats canceled_by_doctor and withdrawn as cancelled', () => {
    for (const status of CANCELLED_CASE_STATUSES) {
      expect(isCancelledCase(status)).toBe(true);
    }
  });

  it('treats every other status as not cancelled', () => {
    for (const status of ['draft', 'sent_to_patient', 'reviewed', 'archived', 'review_pending']) {
      expect(isCancelledCase(status)).toBe(false);
    }
  });
});
