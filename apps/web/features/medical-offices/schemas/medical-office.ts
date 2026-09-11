import { z } from 'zod';

export const createMedicalOfficeSchema = z.object({
  name: z.string().trim().min(1, 'Facility name is required').max(180),
  address: z.string().trim().max(500).optional().default(''),
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
