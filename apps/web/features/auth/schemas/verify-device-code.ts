import { z } from 'zod';

/** Same 6-digit shape as redeem-access-code.ts's own code field — no email/password needed here, since identity was already proven at the sign-in step this follows (see verify-device-code.ts). */
export const verifyDeviceCodeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from your email')
});

export type VerifyDeviceCodeSchemaInput = z.infer<typeof verifyDeviceCodeSchema>;
