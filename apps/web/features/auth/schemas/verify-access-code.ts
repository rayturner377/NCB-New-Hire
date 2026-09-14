import { z } from 'zod';

/** The unified sign-in page's intermediate "does this code match" step — see access-codes-service.ts's verifyAccessCode, which checks without consuming. */
export const verifyAccessCodeSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').max(254).email('Enter a valid email address'),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from your email')
});

export type VerifyAccessCodeSchemaInput = z.infer<typeof verifyAccessCodeSchema>;
