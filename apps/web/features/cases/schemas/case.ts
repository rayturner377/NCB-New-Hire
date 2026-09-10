import { z } from 'zod';
import { CASE_TYPES } from '../case-types';

export const caseRouteSchema = z.enum(['patient', 'doctor']);

export const caseTypeSchema = z.enum(CASE_TYPES, { errorMap: () => ({ message: 'Choose the type of medical.' }) });

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

/**
 * Ported from server.js's renderNewCaseForm (public/app.js ~L8738-8799), with
 * medical-office management deferred — instead of the old app's office
 * picker (which auto-derived a hidden clinician from the office's roster),
 * HR picks a clinician directly. Route is derived from whether a clinician
 * was picked (one selected -> sent straight to that doctor; left blank ->
 * sent to the candidate first, who'll pick a doctor/office themselves once
 * that intake flow exists) rather than a separate routing control.
 */
export const createCaseSchema = z.object({
  patientId: z.string().trim().min(1, 'Candidate is required').max(80),
  assignedClinicianId: z.string().trim().max(80).optional().default(''),
  caseType: caseTypeSchema,
  // Defaults from the candidate's own profile but is editable here — a candidate can apply for
  // a different role each time a new medical is created for them (see cases-service.ts's CasePayload).
  positionAppliedFor: z.string().trim().min(1, 'Position applied for is required').max(140)
});

export type CreateCaseSchemaInput = z.infer<typeof createCaseSchema>;
