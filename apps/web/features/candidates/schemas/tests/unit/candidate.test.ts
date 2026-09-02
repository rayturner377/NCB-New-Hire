import { describe, expect, it } from 'vitest';
import { createCandidateSchema, updateCandidateSchema } from '../../candidate';

describe('createCandidateSchema', () => {
  const valid = { fullName: 'Jane Doe', dateOfBirth: '1990-01-01', position: 'Teller' };

  it('accepts the minimum required fields and defaults the rest to empty strings', () => {
    const result = createCandidateSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.employeeId).toBe('');
      expect(result.data.medicationInformation).toBe('');
    }
  });

  it('rejects a missing full name', () => {
    expect(createCandidateSchema.safeParse({ ...valid, fullName: '' }).success).toBe(false);
  });

  it('rejects a missing position', () => {
    expect(createCandidateSchema.safeParse({ ...valid, position: '' }).success).toBe(false);
  });

  it('rejects an invalid date of birth', () => {
    expect(createCandidateSchema.safeParse({ ...valid, dateOfBirth: 'not-a-date' }).success).toBe(false);
  });
});

describe('updateCandidateSchema', () => {
  it('accepts a partial update with just a status change', () => {
    const result = updateCandidateSchema.safeParse({ status: 'withdrawn', withdrawalReason: 'No longer needed' });
    expect(result.success).toBe(true);
  });

  it('rejects an unrecognized status', () => {
    const result = updateCandidateSchema.safeParse({ status: 'not-a-status' });
    expect(result.success).toBe(false);
  });

  it('accepts an empty patch', () => {
    expect(updateCandidateSchema.safeParse({}).success).toBe(true);
  });
});
