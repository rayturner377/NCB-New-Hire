import { describe, expect, it } from 'vitest';
import { createUserSchema, updateUserSchema } from '../../user';

describe('createUserSchema', () => {
  const valid = {
    email: 'doctor@ncb.local',
    displayName: 'Demo Doctor',
    role: 'clinician'
  };

  it('accepts a valid payload', () => {
    expect(createUserSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an invalid email', () => {
    expect(createUserSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
  });

  it('rejects a missing display name', () => {
    expect(createUserSchema.safeParse({ ...valid, displayName: '' }).success).toBe(false);
  });

  it('rejects an unrecognized role', () => {
    expect(createUserSchema.safeParse({ ...valid, role: 'superadmin' }).success).toBe(false);
  });

  it('accepts a delegate with a doctor chosen', () => {
    expect(
      createUserSchema.safeParse({ ...valid, role: 'delegate', delegateForClinicianId: 'usr_doctor_demo' }).success
    ).toBe(true);
  });

  it('rejects a delegate with no doctor chosen', () => {
    expect(createUserSchema.safeParse({ ...valid, role: 'delegate' }).success).toBe(false);
  });

  it('does not require delegateForClinicianId for a non-delegate role', () => {
    expect(createUserSchema.safeParse(valid).success).toBe(true);
  });
});

describe('updateUserSchema', () => {
  it('accepts an empty patch', () => {
    expect(updateUserSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a role-only patch', () => {
    expect(updateUserSchema.safeParse({ role: 'reviewer' }).success).toBe(true);
  });

  it('rejects an unrecognized role', () => {
    expect(updateUserSchema.safeParse({ role: 'not-a-role' }).success).toBe(false);
  });

  it('accepts reassigning a delegate to a different doctor', () => {
    expect(updateUserSchema.safeParse({ delegateForClinicianId: 'usr_doctor_new' }).success).toBe(true);
  });
});
