import { z } from 'zod';

/** Ported from server.js ROLES (~L205-210). */
export const userRoleSchema = z.enum(['admin', 'reviewer', 'auditor', 'clinician', 'patient']);

export const createUserSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').max(254).email('Enter a valid email address'),
  displayName: z.string().trim().min(1, 'Display name is required').max(140),
  role: userRoleSchema
});

export type CreateUserSchemaInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  displayName: z.string().trim().min(1).max(140).optional(),
  role: userRoleSchema.optional()
});

export type UpdateUserSchemaInput = z.infer<typeof updateUserSchema>;
