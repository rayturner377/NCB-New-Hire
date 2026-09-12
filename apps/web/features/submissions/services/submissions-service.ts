import { randomBytes } from 'node:crypto';
import { submissionsRepository } from '@ncb/database';
import { loadMasterKey } from '../../../lib/master-key';
import { finalizeCaseTransition } from '../../cases/services/cases-service';
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

  // A case sent back to the doctor for revision resubmits against the same case id — this has to
  // be the actual next version, not a hardcoded 1, or the new submission ties with the old one and
  // listSubmissionsForCase's ordering can no longer reliably tell which is newer (see
  // packages/database's submissions repository — this was exactly why a HR reviewer could still see
  // a doctor's earlier answers after a resubmission).
  const existingSubmissions = await submissionsRepository.listForCase(input.caseId);
  const nextVersion = (existingSubmissions[0]?.submissionVersion ?? 0) + 1;

  const payload: SubmissionPayload = {
    id,
    version: nextVersion,
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

  await submissionsRepository.save(
    { id, caseId: input.caseId, submittedBy: input.submittedBy, submissionVersion: nextVersion, payload },
    masterKey
  );

  return payload;
}

/**
 * Atomic counterpart to createSubmission + a case transition — a doctor's real "submit
 * assessment" action needs both to succeed or neither to (see submissionsRepository.saveAndTransition's
 * own doc comment for the orphaned-write problem this replaces). The billing snapshot and case
 * transition happen inside the same DB transaction as the submission insert; audit/notification
 * only run afterward, once that transaction has actually committed.
 */
export async function createSubmissionAndTransitionCase(
  input: CreateSubmissionInput,
  expectedVersion: number,
  billing?: { payableAmount: number; paymentStatus: string }
): Promise<{ payload: SubmissionPayload; newCaseVersion: number }> {
  const masterKey = loadMasterKey();
  const now = new Date().toISOString();
  const id = `med_${Date.now().toString(36)}_${randomToken(8)}`;

  const result = await submissionsRepository.saveAndTransition(
    {
      id,
      caseId: input.caseId,
      submittedBy: input.submittedBy,
      expectedVersion,
      newStatus: 'doctor_submitted',
      actorId: input.submittedBy,
      billing
    },
    masterKey,
    (submissionVersion): SubmissionPayload => ({
      id,
      version: submissionVersion,
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
    })
  );

  await finalizeCaseTransition(input.caseId, input.submittedBy, result.previousStatus, 'doctor_submitted');

  return { payload: result.payload as SubmissionPayload, newCaseVersion: result.newCaseVersion };
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
