import { randomBytes } from 'node:crypto';
import { casesRepository } from '@ncb/database';
import { loadMasterKey } from '../../../lib/master-key';
import type { CreateCaseSchemaInput } from '../schemas/case';
import type { CaseStatus } from '../types';

/** Ported from server.js randomToken (~L5717-5719). */
function randomToken(bytes: number): string {
  return randomBytes(bytes).toString('base64url');
}

export interface CreateCaseInput extends CreateCaseSchemaInput {
  createdBy: string;
}

/** Ported from server.js sanitizeMedicalCase (~L2535-2560): status follows from the chosen route. */
export async function createCase(input: CreateCaseInput) {
  const masterKey = loadMasterKey();
  const id = `case_${Date.now().toString(36)}_${randomToken(8)}`;
  const status: CaseStatus = input.route === 'patient' ? 'sent_to_patient' : 'sent_to_doctor';

  return casesRepository.create(
    {
      id,
      patientId: input.patientId,
      createdBy: input.createdBy,
      assignedOfficeId: input.assignedOfficeId || undefined,
      assignedClinicianId: input.assignedClinicianId || undefined,
      route: input.route,
      status
    },
    masterKey
  );
}

export async function listCases() {
  const masterKey = loadMasterKey();
  return casesRepository.listAll(masterKey);
}

export async function getCaseById(id: string) {
  const masterKey = loadMasterKey();
  return casesRepository.findById(id, masterKey);
}

/**
 * Optimistic-concurrency status transition via the transition_medical_case
 * stored procedure (packages/database's casesRepository.transition) — on a
 * stale expectedVersion this throws, which callers should surface as a
 * conflict rather than retry blindly.
 */
export async function transitionCase(
  caseId: string,
  expectedVersion: number,
  newStatus: CaseStatus,
  actorId: string
): Promise<number> {
  return casesRepository.transition(caseId, expectedVersion, newStatus, actorId);
}
