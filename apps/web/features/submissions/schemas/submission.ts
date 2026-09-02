import { z } from 'zod';

export const determinationStatusSchema = z.enum([
  'fit',
  'fit_with_restrictions',
  'temporarily_deferred',
  'not_fit'
]);

const validDateString = z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Must be a valid date');

/** Clinical detail sections with no business logic branching on individual keys (see types.ts). */
const looseRecord = z.record(z.union([z.string(), z.boolean()])).optional().default({});

/** Ported from server.js sanitizeSubmission (~L1385-1511), same required fields and consent gate. */
export const createSubmissionSchema = z.object({
  candidate: z.object({
    candidateId: z.string().trim().max(80).optional().default(''),
    caseId: z.string().trim().max(80).optional().default(''),
    patientId: z.string().trim().max(80).optional().default(''),
    fullName: z.string().trim().min(1, 'Candidate full name is required').max(140),
    employeeId: z.string().trim().max(80).optional().default(''),
    nationalId: z.string().trim().max(80).optional().default(''),
    dateOfBirth: validDateString,
    email: z.string().trim().max(254).optional().default(''),
    contactNumber: z.string().trim().max(50).optional().default(''),
    position: z.string().trim().min(1, 'Position applied for is required').max(140),
    medicationInformation: z.string().trim().max(2000).optional().default('')
  }),
  assessment: z.object({
    facilityName: z.string().trim().min(1, 'Medical facility is required').max(180),
    facilityAddress: z.string().trim().max(260).optional().default(''),
    assessmentDate: validDateString,
    clinicianName: z.string().trim().min(1, 'Clinician name is required').max(140),
    clinicianRegistrationNumber: z.string().trim().max(100).optional().default(''),
    telephoneNumber: z.string().trim().max(50).optional().default(''),
    faxNumber: z.string().trim().max(50).optional().default(''),
    emailAddress: z.string().trim().max(254).optional().default('')
  }),
  vitals: looseRecord,
  medicalHistory: looseRecord,
  familyHistory: looseRecord,
  physicalExam: looseRecord,
  labResults: looseRecord,
  customFields: z.record(z.unknown()).optional().default({}),
  determination: z.object({
    status: determinationStatusSchema,
    conclusions: z.string().trim().max(2000).optional().default(''),
    restrictions: z.string().trim().max(1400).optional().default(''),
    recommendation: z.string().trim().max(1400).optional().default(''),
    followUpDate: z.string().optional().default('')
  }),
  attestation: z
    .object({
      signedBy: z.string().trim().min(1, 'Clinician attestation name is required').max(140),
      signatureDate: validDateString,
      consentConfirmed: z.coerce.boolean(),
      signatureDataUrl: z.string().optional().default('')
    })
    .refine((data) => data.consentConfirmed === true, {
      message: 'Consent confirmation is required before submission.',
      path: ['consentConfirmed']
    }),
  consent: z
    .object({
      accepted: z.coerce.boolean().optional().default(false),
      signedBy: z.string().trim().max(140).optional().default(''),
      signedAt: z.string().optional().default(''),
      signatureDataUrl: z.string().optional().default('')
    })
    .optional()
    .default({ accepted: false, signedBy: '', signedAt: '', signatureDataUrl: '' })
});

export type CreateSubmissionSchemaInput = z.infer<typeof createSubmissionSchema>;
