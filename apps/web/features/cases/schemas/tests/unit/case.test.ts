import { describe, expect, it } from 'vitest';
import { createCaseSchema } from '../../case';

describe('createCaseSchema', () => {
  it('accepts a candidate with no doctor assigned', () => {
    const result = createCaseSchema.safeParse({ patientId: 'cand_1', caseType: 'pre_employment', positionAppliedFor: 'Teller' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.assignedClinicianId).toBe('');
    }
  });

  it('accepts a candidate with a doctor assigned', () => {
    const result = createCaseSchema.safeParse({
      patientId: 'cand_1',
      assignedClinicianId: 'usr_doctor_demo',
      caseType: 'required_medical',
      positionAppliedFor: 'Teller'
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing candidate id', () => {
    const result = createCaseSchema.safeParse({ patientId: '', caseType: 'pre_employment', positionAppliedFor: 'Teller' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing position applied for', () => {
    const result = createCaseSchema.safeParse({ patientId: 'cand_1', caseType: 'pre_employment' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing or unrecognized case type', () => {
    expect(createCaseSchema.safeParse({ patientId: 'cand_1', positionAppliedFor: 'Teller' }).success).toBe(false);
    expect(
      createCaseSchema.safeParse({ patientId: 'cand_1', positionAppliedFor: 'Teller', caseType: 'not-a-real-type' }).success
    ).toBe(false);
  });
});
