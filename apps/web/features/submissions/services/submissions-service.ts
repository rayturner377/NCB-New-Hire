import { randomBytes } from 'node:crypto';
import { submissionsRepository } from '@ncb/database';
import { loadMasterKey } from '../../../lib/master-key';
import type { CreateSubmissionSchemaInput } from '../schemas/submission';
import type { SubmissionPayload } from '../types';

/** Ported from server.js randomToken (~L5717-5719). */
function randomToken(bytes: number): string {
  return randomBytes(bytes).toString('base64url');
}

export interface CreateSubmissionInput extends CreateSubmissionSchemaInput {
  /**
   * The real medical_cases.id this submission is filed against (FK-enforced by
   * the schema). Deliberately NOT derived from candidate.caseId/candidateId
   * the way server.js's sanitizeSubmission (~L1411-1416) loosely did — those
   * text fields are just denormalized display copies in the encrypted
   * payload; the repository-level caseId must be a real case that exists.
   */
  caseId: string;
  submittedBy: string;
  submittedByName: string;
  submittedByEmail: string;
}

/** Ported from server.js sanitizeSubmission (~L1385-1511). */
export async function createSubmission(input: CreateSubmissionInput): Promise<SubmissionPayload> {
  const masterKey = loadMasterKey();
  const now = new Date().toISOString();
  const id = `med_${Date.now().toString(36)}_${randomToken(8)}`;

  const payload: SubmissionPayload = {
    id,
    version: 1,
    status: 'submitted',
    submittedAt: now,
    submittedBy: input.submittedBy,
    submittedByName: input.submittedByName,
    submittedByEmail: input.submittedByEmail,
    caseId: input.caseId,
    patientId: input.candidate.patientId,
    candidate: {
      candidateId: input.candidate.candidateId || input.candidate.caseId || '',
      caseId: input.candidate.caseId || input.candidate.candidateId || '',
      patientId: input.candidate.patientId,
      fullName: input.candidate.fullName,
      employeeId: input.candidate.employeeId,
      nationalId: input.candidate.nationalId,
      dateOfBirth: input.candidate.dateOfBirth,
      email: input.candidate.email,
      contactNumber: input.candidate.contactNumber,
      position: input.candidate.position,
      medicationInformation: input.candidate.medicationInformation
    },
    assessment: input.assessment,
    vitals: input.vitals,
    medicalHistory: input.medicalHistory,
    familyHistory: input.familyHistory,
    physicalExam: input.physicalExam,
    labResults: input.labResults,
    determination: input.determination,
    customFields: input.customFields,
    attestation: input.attestation,
    consent: input.consent,
    review: {
      status: 'pending',
      notes: '',
      reviewedAt: '',
      reviewedBy: '',
      reviewedByName: ''
    }
  };

  await submissionsRepository.save({ id, caseId: input.caseId, submittedBy: input.submittedBy, payload }, masterKey);

  return payload;
}

export async function listSubmissions(): Promise<SubmissionPayload[]> {
  const masterKey = loadMasterKey();
  const rows = await submissionsRepository.listAll();
  return rows.map((row) => submissionsRepository.decrypt<SubmissionPayload>(row, masterKey));
}

export async function listSubmissionsForCase(caseId: string): Promise<SubmissionPayload[]> {
  const masterKey = loadMasterKey();
  const rows = await submissionsRepository.listForCase(caseId);
  return rows.map((row) => submissionsRepository.decrypt<SubmissionPayload>(row, masterKey));
}

export async function getSubmissionById(id: string): Promise<SubmissionPayload | null> {
  const masterKey = loadMasterKey();
  const row = await submissionsRepository.findById(id);
  if (!row) return null;
  return submissionsRepository.decrypt<SubmissionPayload>(row, masterKey);
}
