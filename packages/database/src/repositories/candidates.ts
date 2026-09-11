import { decryptJson, encryptJson, type EncryptedRecord } from '@ncb/shared';
import type { PatientProfile, PrismaClient } from '../generated/client/index.js';
import { prisma } from '../client.js';

export interface CandidateInput {
  id: string;
  fullName: string;
  email?: string;
  employeeId?: string;
  dateOfBirth?: Date;
  contactNumber?: string;
  createdBy?: string;
  linkedUserId?: string;
  /** Full candidate object; encrypted into profile_payload. */
  payload: unknown;
}

export interface CandidateWithPayload<T = unknown> extends PatientProfile {
  payload: T | null;
}

function decryptCandidate<T = unknown>(row: PatientProfile, masterKey: Buffer): CandidateWithPayload<T> {
  if (!row.profilePayload) return { ...row, payload: null };
  const record = JSON.parse(Buffer.from(row.profilePayload).toString('utf8')) as EncryptedRecord;
  return { ...row, payload: decryptJson<T>(masterKey, record) };
}

export function createCandidatesRepository(db: PrismaClient) {
  return {
    async listAll<T = unknown>(masterKey: Buffer): Promise<CandidateWithPayload<T>[]> {
      const rows = await db.patientProfile.findMany({ where: { deletedAt: null } });
      return rows.map((row) => decryptCandidate<T>(row, masterKey));
    },

    async findById<T = unknown>(id: string, masterKey: Buffer): Promise<CandidateWithPayload<T> | null> {
      const row = await db.patientProfile.findFirst({ where: { id, deletedAt: null } });
      return row ? decryptCandidate<T>(row, masterKey) : null;
    },

    async listForUser<T = unknown>(linkedUserId: string, masterKey: Buffer): Promise<CandidateWithPayload<T>[]> {
      const rows = await db.patientProfile.findMany({ where: { linkedUserId, deletedAt: null } });
      return rows.map((row) => decryptCandidate<T>(row, masterKey));
    },

    async save(input: CandidateInput, masterKey: Buffer): Promise<PatientProfile> {
      const record = encryptJson(masterKey, input.payload);
      const profilePayload = Buffer.from(JSON.stringify(record), 'utf8');
      const data = {
        fullName: input.fullName,
        email: input.email,
        employeeId: input.employeeId,
        dateOfBirth: input.dateOfBirth,
        contactNumber: input.contactNumber,
        createdBy: input.createdBy,
        linkedUserId: input.linkedUserId,
        profilePayload,
        // Fixed at 1 until a real key-rotation mechanism (KMS or multi-key
        // masterKey) is introduced; the column exists to support that later.
        payloadKeyVersion: 1
      };
      return db.patientProfile.upsert({
        where: { id: input.id },
        create: { id: input.id, ...data },
        update: data
      });
    }
  };
}

export const candidatesRepository = createCandidatesRepository(prisma);
