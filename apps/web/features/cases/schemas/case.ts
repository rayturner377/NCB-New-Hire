import { z } from 'zod';

export const caseRouteSchema = z.enum(['patient', 'doctor']);

export const caseStatusSchema = z.enum([
  'draft',
  'sent_to_patient',
  'patient_completed',
  'sent_to_doctor',
  'doctor_submitted',
  'canceled_by_doctor',
  'review_pending',
  'reviewed',
  'archived',
  'withdrawn'
]);

/** Ported from server.js sanitizeMedicalCase (~L2535-2560): a doctor-routed case must name a clinician. */
export const createCaseSchema = z
  .object({
    patientId: z.string().trim().min(1, 'Patient is required').max(80),
    route: caseRouteSchema,
    assignedClinicianId: z.string().trim().max(80).optional().default(''),
    assignedOfficeId: z.string().trim().max(80).optional().default('')
  })
  .refine((data) => data.route !== 'doctor' || data.assignedClinicianId !== '', {
    message: 'A clinician must be assigned when routing to a doctor.',
    path: ['assignedClinicianId']
  });

export type CreateCaseSchemaInput = z.infer<typeof createCaseSchema>;
