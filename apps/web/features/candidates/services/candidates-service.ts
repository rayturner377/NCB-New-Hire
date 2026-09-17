import { randomBytes } from 'node:crypto';
import { auditRepository, candidatesRepository, type CandidateSearchFilters } from '@ncb/database';
import { loadMasterKey } from '../../../lib/master-key';
import { createUser } from '../../users/services/users-service';
import type { CreateCandidateSchemaInput, UpdateCandidateSchemaInput } from '../schemas/candidate';
import type { CandidatePayload } from '../types';

/** Ported from server.js randomToken (~L5717-5719). */
function randomToken(bytes: number): string {
  return randomBytes(bytes).toString('base64url');
}

export interface CreateCandidateInput extends CreateCandidateSchemaInput {
  createdBy: string;
  createdByName: string;
  /** HR's "grant portal access" checkbox — only takes effect when an email is also present. */
  grantPortalAccess?: boolean;
  /** How long the activation code this issues should stay redeemable — see activation-code-ttl.ts's presets and CreateUserInput's own doc comment. Only meaningful alongside grantPortalAccess. */
  activationCodeTtlMs?: number;
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
      linkedUserId: payload.linkedUserId || undefined,
      status: payload.status,
      position: payload.position,
      payload
    },
    masterKey
  );
}

/**
 * Ported from server.js sanitizeCandidate (~L3011-3039). Checking "grant
 * portal access" (with an email present) grants it at creation time (old
 * app.js did this as a separate later step, POST /api/candidates/:id/user —
 * see createUser/DuplicateEmailError, reused here so both flows create the
 * account identically).
 */
export async function createCandidate(input: CreateCandidateInput): Promise<CandidatePayload> {
  const now = new Date().toISOString();

  let linkedUserId = '';
  if (input.grantPortalAccess && input.email) {
    const user = await createUser({
      email: input.email,
      displayName: input.fullName,
      role: 'patient',
      activationCodeTtlMs: input.activationCodeTtlMs
    });
    linkedUserId = user.id;
  }

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
    addressLine1: input.addressLine1 ?? '',
    addressLine2: input.addressLine2 ?? '',
    city: input.city ?? '',
    state: input.state ?? '',
    country: input.country ?? '',
    emergencyContactName: input.emergencyContactName ?? '',
    emergencyContactNumber: input.emergencyContactNumber ?? '',
    primaryPhysicianName: input.primaryPhysicianName ?? '',
    primaryPhysicianNumber: input.primaryPhysicianNumber ?? '',
    position: input.position,
    medicationInformation: input.medicationInformation ?? '',
    linkedUserId
  };

  await persist(payload);

  await auditRepository.append({
    eventType: 'candidate_created',
    actorUserId: input.createdBy,
    entityType: 'candidate',
    entityId: payload.id,
    details: { fullName: payload.fullName, portalAccessGranted: Boolean(linkedUserId) }
  });

  return payload;
}

export async function listCandidates(): Promise<CandidatePayload[]> {
  const masterKey = loadMasterKey();
  const rows = await candidatesRepository.listAll<CandidatePayload>(masterKey);
  return rows.map((row) => row.payload).filter((payload): payload is CandidatePayload => payload !== null);
}

export interface CandidateListRow extends CandidatePayload {
  /** From Prisma's own _count aggregate — see candidatesRepository.search's own doc comment on why this isn't a full case fetch. */
  caseCount: number;
}

/** The paginated, filtered equivalent of listCandidates — query/status/position/caseStage/caseBilling all match plain columns or the cases relation on PatientProfile now (see candidatesRepository.search's own doc comment), so this decrypts only the page actually returned instead of every candidate in the system. */
export async function searchCandidates(
  filters: CandidateSearchFilters,
  page: number,
  pageSize: number
): Promise<{ rows: CandidateListRow[]; total: number }> {
  const masterKey = loadMasterKey();
  const { rows, total } = await candidatesRepository.search<CandidatePayload>(filters, page, pageSize, masterKey);
  return {
    rows: rows
      .filter((row): row is typeof row & { payload: CandidatePayload } => row.payload !== null)
      .map((row) => ({ ...row.payload, caseCount: row.caseCount })),
    total
  };
}

/** Every distinct position on file, for the candidates list's position filter dropdown. */
export async function listCandidatePositions(): Promise<string[]> {
  return candidatesRepository.listDistinctPositions();
}

export async function listCandidatesForUser(linkedUserId: string): Promise<CandidatePayload[]> {
  const masterKey = loadMasterKey();
  const rows = await candidatesRepository.listForUser<CandidatePayload>(linkedUserId, masterKey);
  return rows.map((row) => row.payload).filter((payload): payload is CandidatePayload => payload !== null);
}

/** The candidates list's stat cards — a role-wide (or, for a patient viewer, their own-record-only) count, independent of whichever page of the list is currently showing. */
export async function getCandidateStats(linkedUserId?: string) {
  return candidatesRepository.getStats(linkedUserId);
}

export async function getCandidateById(id: string): Promise<CandidatePayload | null> {
  const masterKey = loadMasterKey();
  const row = await candidatesRepository.findById<CandidatePayload>(id, masterKey);
  return row?.payload ?? null;
}

/**
 * Plain 1:1 profile fields — patching one over the existing row is always just "take the caller's
 * value if they sent one." assignedClinicianId/assignedClinicianName/status have follow-on effects
 * (see updateCandidate below) and are deliberately not in this list.
 */
const CANDIDATE_PATCHABLE_FIELDS = [
  'fullName',
  'employeeId',
  'nationalId',
  'dateOfBirth',
  'email',
  'contactNumber',
  'addressLine1',
  'addressLine2',
  'city',
  'state',
  'country',
  'emergencyContactName',
  'emergencyContactNumber',
  'primaryPhysicianName',
  'primaryPhysicianNumber',
  'position',
  'medicationInformation',
  'withdrawalReason'
] as const satisfies readonly (keyof CandidatePayload)[];

/** Applies whichever CANDIDATE_PATCHABLE_FIELDS the caller actually included — an omitted field is
 * left untouched, distinct from one explicitly sent as an empty string. */
function applyCandidateProfilePatch(existing: CandidatePayload, patch: UpdateCandidateSchemaInput): CandidatePayload {
  const definedFields = CANDIDATE_PATCHABLE_FIELDS.filter((field) => patch[field] !== undefined).map(
    (field) => [field, patch[field]] as const
  );
  return { ...existing, ...Object.fromEntries(definedFields) };
}

/**
 * Ported from server.js updateCandidateFromReviewer (~L3041-3064). Every caller — HR editing a
 * candidate's own profile fields, a patient editing their own via update-own-profile.ts, and the
 * more specific withdraw/assign actions — routes through here, so `actorId` is required and every
 * write gets an audit event: 'candidate_updated' by default, or the caller's own more specific
 * `audit.eventType` (e.g. 'candidate_withdrawn') when this same patch also represents a distinct,
 * nameable action worth its own label in the audit log rather than a generic "updated."
 */
export async function updateCandidate(
  id: string,
  patch: UpdateCandidateSchemaInput,
  actorId: string,
  audit?: { eventType: string; details?: Record<string, unknown> }
): Promise<CandidatePayload> {
  const existing = await getCandidateById(id);
  if (!existing) {
    throw new Error(`Candidate not found: ${id}`);
  }

  const updated = applyCandidateProfilePatch(existing, patch);

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

  await auditRepository.append({
    eventType: audit?.eventType ?? 'candidate_updated',
    actorUserId: actorId,
    entityType: 'candidate',
    entityId: id,
    details: audit?.details
  });

  return updated;
}
