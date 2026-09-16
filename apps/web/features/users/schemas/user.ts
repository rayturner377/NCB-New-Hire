import { z } from 'zod';

/** Ported from server.js ROLES (~L205-210), plus 'delegate' (an assistant acting on behalf of exactly one doctor — see permissions.ts's ROLES.DELEGATE). */
export const userRoleSchema = z.enum(['admin', 'reviewer', 'auditor', 'clinician', 'delegate', 'patient']);

export const createUserSchema = z
  .object({
    email: z.string().trim().min(1, 'Email is required').max(254).email('Enter a valid email address'),
    displayName: z.string().trim().min(1, 'Display name is required').max(140),
    role: userRoleSchema,
    /** Required only for role === 'delegate' — which doctor this assistant acts on behalf of. */
    delegateForClinicianId: z.string().trim().max(80).optional()
  })
  .refine((data) => data.role !== 'delegate' || Boolean(data.delegateForClinicianId), {
    message: 'Choose which doctor this delegate supports.',
    path: ['delegateForClinicianId']
  });

export type CreateUserSchemaInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  displayName: z.string().trim().min(1).max(140).optional(),
  role: userRoleSchema.optional(),
  /** Reassigning a delegate to a different doctor, or unlinking (empty string -> null downstream). */
  delegateForClinicianId: z.string().trim().max(80).optional()
});

export type UpdateUserSchemaInput = z.infer<typeof updateUserSchema>;
