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
});
