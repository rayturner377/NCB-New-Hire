import { randomBytes } from 'node:crypto';
import { candidatesRepository } from '@ncb/database';
import { loadMasterKey } from '../../../lib/master-key';
import type { CreateCandidateSchemaInput, UpdateCandidateSchemaInput } from '../schemas/candidate';
import type { CandidatePayload } from '../types';

/** Ported from server.js randomToken (~L5717-5719). */
function randomToken(bytes: number): string {
  return randomBytes(bytes).toString('base64url');
}

export interface CreateCandidateInput extends CreateCandidateSchemaInput {
  createdBy: string;
  createdByName: string;
}

async function persist(payload: CandidatePayload): Promise<void> {
  const masterKey = loadMasterKey();
  await candidatesRepository.save(
    {
      id: payload.id,
      fullName: payload.fullName,
      email: payload.email || undefined,
      employeeId: payload.employeeId || undefined,
      dateOfBirth: new Date(payload.dateOfBirth),
      contactNumber: payload.contactNumber || undefined,
      createdBy: payload.createdBy,
      payload
    },
    masterKey
  );
}

/** Ported from server.js sanitizeCandidate (~L3011-3039). */
export async function createCandidate(input: CreateCandidateInput): Promise<CandidatePayload> {
  const now = new Date().toISOString();
  const payload: CandidatePayload = {
    id: `cand_${Date.now().toString(36)}_${randomToken(8)}`,
    createdAt: now,
    createdBy: input.createdBy,
    createdByName: input.createdByName,
    assignedAt: now,
    assignedClinicianId: input.assignedClinicianId ?? '',
    assignedClinicianName: input.assignedClinicianName ?? '',
    status: 'assigned',
    withdrawalReason: '',
    submittedAt: '',
    submissionId: '',
    fullName: input.fullName,
    employeeId: input.employeeId ?? '',
    nationalId: input.nationalId ?? '',
    dateOfBirth: input.dateOfBirth,
    email: input.email ?? '',
    contactNumber: input.contactNumber ?? '',
    address: input.address ?? '',
    emergencyContactName: input.emergencyContactName ?? '',
    emergencyContactNumber: input.emergencyContactNumber ?? '',
    primaryPhysician: input.primaryPhysician ?? '',
    position: input.position,
    medicationInformation: input.medicationInformation ?? ''
  };

  await persist(payload);
  return payload;
}

export async function listCandidates(): Promise<CandidatePayload[]> {
  const masterKey = loadMasterKey();
  const rows = await candidatesRepository.listAll<CandidatePayload>(masterKey);
  return rows.map((row) => row.payload).filter((payload): payload is CandidatePayload => payload !== null);
}

export async function listCandidatesForUser(linkedUserId: string): Promise<CandidatePayload[]> {
  const masterKey = loadMasterKey();
  const rows = await candidatesRepository.listForUser<CandidatePayload>(linkedUserId, masterKey);
  return rows.map((row) => row.payload).filter((payload): payload is CandidatePayload => payload !== null);
}

export async function getCandidateById(id: string): Promise<CandidatePayload | null> {
  const masterKey = loadMasterKey();
  const row = await candidatesRepository.findById<CandidatePayload>(id, masterKey);
  return row?.payload ?? null;
}

/** Ported from server.js updateCandidateFromReviewer (~L3041-3064). */
export async function updateCandidate(id: string, patch: UpdateCandidateSchemaInput): Promise<CandidatePayload> {
  const existing = await getCandidateById(id);
  if (!existing) {
    throw new Error(`Candidate not found: ${id}`);
  }

  const updated: CandidatePayload = { ...existing };
  if (patch.fullName !== undefined) updated.fullName = patch.fullName;
  if (patch.employeeId !== undefined) updated.employeeId = patch.employeeId;
  if (patch.nationalId !== undefined) updated.nationalId = patch.nationalId;
  if (patch.dateOfBirth !== undefined) updated.dateOfBirth = patch.dateOfBirth;
  if (patch.email !== undefined) updated.email = patch.email;
  if (patch.contactNumber !== undefined) updated.contactNumber = patch.contactNumber;
  if (patch.address !== undefined) updated.address = patch.address;
  if (patch.emergencyContactName !== undefined) updated.emergencyContactName = patch.emergencyContactName;
  if (patch.emergencyContactNumber !== undefined) updated.emergencyContactNumber = patch.emergencyContactNumber;
  if (patch.primaryPhysician !== undefined) updated.primaryPhysician = patch.primaryPhysician;
  if (patch.position !== undefined) updated.position = patch.position;
  if (patch.medicationInformation !== undefined) updated.medicationInformation = patch.medicationInformation;
  if (patch.withdrawalReason !== undefined) updated.withdrawalReason = patch.withdrawalReason;

  if (patch.assignedClinicianId !== undefined) {
    updated.assignedClinicianId = patch.assignedClinicianId;
    updated.assignedClinicianName = patch.assignedClinicianName ?? '';
    updated.assignedAt = new Date().toISOString();
    if (updated.status === 'withdrawn') updated.status = 'assigned';
  }

  if (patch.status !== undefined) {
    updated.status = patch.status;
  }

  await persist(updated);
  return updated;
}
