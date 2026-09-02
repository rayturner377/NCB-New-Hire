import { describe, expect, it } from 'vitest';
import { createCaseSchema } from '../../case';

describe('createCaseSchema', () => {
  it('accepts a patient-routed case with no clinician assigned', () => {
    const result = createCaseSchema.safeParse({ patientId: 'cand_1', route: 'patient' });
    expect(result.success).toBe(true);
  });

  it('accepts a doctor-routed case with a clinician assigned', () => {
    const result = createCaseSchema.safeParse({
      patientId: 'cand_1',
      route: 'doctor',
      assignedClinicianId: 'usr_doctor_demo'
    });
    expect(result.success).toBe(true);
  });

  it('rejects a doctor-routed case with no clinician assigned', () => {
    const result = createCaseSchema.safeParse({ patientId: 'cand_1', route: 'doctor' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing patient id', () => {
    const result = createCaseSchema.safeParse({ patientId: '', route: 'patient' });
    expect(result.success).toBe(false);
  });

  it('rejects an unrecognized route', () => {
    const result = createCaseSchema.safeParse({ patientId: 'cand_1', route: 'carrier-pigeon' });
    expect(result.success).toBe(false);
  });
});
