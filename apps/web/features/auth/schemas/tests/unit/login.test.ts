import { describe, expect, it } from 'vitest';
import { loginSchema } from '../../login';

describe('loginSchema', () => {
  it('accepts a valid email and password', () => {
    const result = loginSchema.safeParse({ email: 'Doctor@NCB.local', password: 'hunter2' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('doctor@ncb.local');
    }
  });

  it('rejects an empty password', () => {
    const result = loginSchema.safeParse({ email: 'doctor@ncb.local', password: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing email', () => {
    const result = loginSchema.safeParse({ email: '', password: 'hunter2' });
    expect(result.success).toBe(false);
  });
});
