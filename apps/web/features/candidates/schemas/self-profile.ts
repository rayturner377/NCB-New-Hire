import { z } from 'zod';

/**
 * A deliberately narrow subset of updateCandidateSchema's fields — only what
 * a candidate should ever be able to change about themselves (contact
 * details, address, next of kin). Identity fields (name, position,
 * employeeId, nationalId), status, and assignment stay HR/admin-only via the
 * existing /candidates/[id] form (updateCandidateSchema), never reachable
 * from this self-service one.
 */
export const selfProfileSchema = z.object({
  dateOfBirth: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Date.parse(value)), 'Date of birth must be a valid date')
    .optional()
    .default(''),
  contactNumber: z.string().trim().max(50).optional().default(''),
  addressLine1: z.string().trim().max(120).optional().default(''),
  addressLine2: z.string().trim().max(120).optional().default(''),
  city: z.string().trim().max(80).optional().default(''),
  state: z.string().trim().max(80).optional().default(''),
  country: z.string().trim().max(80).optional().default(''),
  emergencyContactName: z.string().trim().max(140).optional().default(''),
  emergencyContactNumber: z.string().trim().max(50).optional().default('')
});

export type SelfProfileSchemaInput = z.infer<typeof selfProfileSchema>;
