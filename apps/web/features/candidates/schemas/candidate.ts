import { z } from 'zod';

/** Field-length limits ported from server.js sanitizeCandidate (~L3011-3039). */
export const candidateStatusSchema = z.enum(['assigned', 'submitted', 'withdrawn', 'archived']);

const candidateBaseSchema = z.object({
  fullName: z.string().trim().min(1, 'Candidate full name is required').max(140),
  employeeId: z.string().trim().max(80).optional().default(''),
  nationalId: z.string().trim().max(80).optional().default(''),
  dateOfBirth: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Date of birth must be a valid date'),
  email: z.string().trim().max(254).optional().default(''),
  contactNumber: z.string().trim().max(50).optional().default(''),
  addressLine1: z.string().trim().max(120).optional().default(''),
  addressLine2: z.string().trim().max(120).optional().default(''),
  city: z.string().trim().max(80).optional().default(''),
  state: z.string().trim().max(80).optional().default(''),
  country: z.string().trim().max(80).optional().default(''),
  emergencyContactName: z.string().trim().max(140).optional().default(''),
  emergencyContactNumber: z.string().trim().max(50).optional().default(''),
  primaryPhysicianName: z.string().trim().max(140).optional().default(''),
  primaryPhysicianNumber: z.string().trim().max(50).optional().default(''),
  position: z.string().trim().min(1, 'Position applied for is required').max(140),
  medicationInformation: z.string().trim().max(2000).optional().default(''),
  assignedClinicianId: z.string().trim().max(80).optional().default(''),
  assignedClinicianName: z.string().trim().max(140).optional().default(''),
  password: z.string().trim().max(200).optional().default('')
});

/**
 * Ported from server.js's candidateSetupForm (public/app.js ~L8243-8254) for
 * the profile fields, plus an optional password — the old app granted
 * portal access as a separate later step (POST /api/candidates/:id/user);
 * this form combines the two so HR can do both at once. A password (if any)
 * logs the candidate in with the email above, so email becomes required
 * once a password is set.
 */
export const createCandidateSchema = candidateBaseSchema
  .refine((data) => data.password === '' || data.password.length >= 12, {
    message: 'Password must be at least 12 characters',
    path: ['password']
  })
  .refine((data) => data.password === '' || data.email !== '', {
    message: 'An email is required to grant portal access',
    path: ['email']
  });

export type CreateCandidateSchemaInput = z.infer<typeof createCandidateSchema>;

export const updateCandidateSchema = candidateBaseSchema.partial().extend({
  status: candidateStatusSchema.optional(),
  withdrawalReason: z.string().trim().max(1000).optional()
});

export type UpdateCandidateSchemaInput = z.infer<typeof updateCandidateSchema>;
