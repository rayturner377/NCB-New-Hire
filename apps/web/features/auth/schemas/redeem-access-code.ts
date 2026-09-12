import { z } from 'zod';

/** email + code + a new chosen password — same password shape as changePasswordSchema, extended for the /forgot-password redemption form (covers both account activation and password reset, see access-codes-service.ts's redeemAccessCode). */
export const redeemAccessCodeSchema = z
  .object({
    email: z.string().trim().min(1, 'Email is required').max(254).email('Enter a valid email address'),
    code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from your email'),
    password: z.string().min(12, 'Password must be at least 12 characters').max(200),
    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

export type RedeemAccessCodeSchemaInput = z.infer<typeof redeemAccessCodeSchema>;
