import { z } from 'zod';

export const createMedicalOfficeSchema = z.object({
  name: z.string().trim().min(1, 'Facility name is required').max(180),
  addressLine1: z.string().trim().max(120).optional().default(''),
  addressLine2: z.string().trim().max(120).optional().default(''),
  city: z.string().trim().max(80).optional().default(''),
  state: z.string().trim().max(80).optional().default(''),
  country: z.string().trim().max(80).optional().default(''),
  phone: z.string().trim().max(50).optional().default(''),
  email: z.string().trim().max(254).optional().default(''),
  defaultMedicalFee: z
    .string()
    .trim()
    .optional()
    .default('')
    .transform((value) => (value === '' ? 0 : Number(value)))
    .refine((value) => Number.isFinite(value) && value >= 0, 'Default rate must be a non-negative number')
});

export type CreateMedicalOfficeSchemaInput = z.infer<typeof createMedicalOfficeSchema>;

/** Same shape as create — every field resubmitted together from the edit form, not a sparse patch. */
export const updateMedicalOfficeSchema = createMedicalOfficeSchema;

export type UpdateMedicalOfficeSchemaInput = z.infer<typeof updateMedicalOfficeSchema>;
