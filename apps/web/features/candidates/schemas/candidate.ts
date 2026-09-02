import { z } from 'zod';

/** Field-length limits ported from server.js sanitizeCandidate (~L3011-3039). */
export const candidateStatusSchema = z.enum(['assigned', 'submitted', 'withdrawn', 'archived']);

export const createCandidateSchema = z.object({
  fullName: z.string().trim().min(1, 'Candidate full name is required').max(140),
  employeeId: z.string().trim().max(80).optional().default(''),
  nationalId: z.string().trim().max(80).optional().default(''),
  dateOfBirth: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Date of birth must be a valid date'),
  email: z.string().trim().max(254).optional().default(''),
  contactNumber: z.string().trim().max(50).optional().default(''),
  address: z.string().trim().max(260).optional().default(''),
  emergencyContactName: z.string().trim().max(140).optional().default(''),
  emergencyContactNumber: z.string().trim().max(50).optional().default(''),
  primaryPhysician: z.string().trim().max(140).optional().default(''),
  position: z.string().trim().min(1, 'Position applied for is required').max(140),
  medicationInformation: z.string().trim().max(2000).optional().default(''),
  assignedClinicianId: z.string().trim().max(80).optional().default(''),
  assignedClinicianName: z.string().trim().max(140).optional().default('')
});

export type CreateCandidateSchemaInput = z.infer<typeof createCandidateSchema>;

export const updateCandidateSchema = createCandidateSchema.partial().extend({
  status: candidateStatusSchema.optional(),
  withdrawalReason: z.string().trim().max(1000).optional()
});

export type UpdateCandidateSchemaInput = z.infer<typeof updateCandidateSchema>;
