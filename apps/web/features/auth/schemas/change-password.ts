import { z } from 'zod';

/** Same 12-character minimum as every other password in the app (CredentialsFields, makePasswordRecord). */
export const changePasswordSchema = z
  .object({
    password: z.string().min(12, 'Password must be at least 12 characters').max(200),
    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  });

export type ChangePasswordSchemaInput = z.infer<typeof changePasswordSchema>;
