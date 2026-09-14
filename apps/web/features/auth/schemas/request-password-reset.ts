import { z } from 'zod';

/** The unified sign-in page's "Forgot password?" trigger — just an email, since the whole point is that the caller may not remember anything else. */
export const requestPasswordResetSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').max(254).email('Enter a valid email address')
});

export type RequestPasswordResetSchemaInput = z.infer<typeof requestPasswordResetSchema>;
