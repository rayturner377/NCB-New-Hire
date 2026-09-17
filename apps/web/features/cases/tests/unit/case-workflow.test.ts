import { describe, expect, it } from 'vitest';
import { hasDoctorSubmitted } from '../../case-workflow';

describe('hasDoctorSubmitted', () => {
  it.each(['draft', 'sent_to_patient', 'patient_completed', 'sent_to_doctor'])('is false while pre-doctor (%s)', (status) => {
    expect(hasDoctorSubmitted(status)).toBe(false);
  });

  it.each(['doctor_submitted', 'reviewed', 'archived', 'withdrawn'])('is true once past the doctor stage (%s)', (status) => {
    expect(hasDoctorSubmitted(status)).toBe(true);
  });
});
